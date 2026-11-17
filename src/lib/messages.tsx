import { Resend } from "resend";
import { eq, sql, and, inArray } from "drizzle-orm";
import { database } from "@/db";
import * as S from "@/db/schema";
import { tenant } from "@/db/tenant";
import { AppointmentEmail } from "@/emails/appointment";
import { sendPush, pushConfigured } from "./push";
export { buildMessages } from "./notification-builders";
class DeliveryError extends Error {
  constructor(
    message: string,
    public retryable = false,
    public uncertain = false,
  ) {
    super(message);
  }
}
export async function processMessages() {
  const { db, close } = database();
  const stats = { claimed: 0, sent: 0, failed: 0, uncertain: 0, skipped: 0 };
  try {
    // No se conserva ningún envío automático de WhatsApp del modelo anterior.
    await db
      .update(S.scheduledMessages)
      .set({
        status: "cancelled",
        lastError: "WhatsApp funciona mediante enlaces manuales.",
      })
      .where(
        and(
          eq(S.scheduledMessages.channel, "whatsapp"),
          inArray(S.scheduledMessages.status, ["pending", "processing"]),
        ),
      );
    await db
      .update(S.scheduledMessages)
      .set({
        status: "uncertain",
        lastError:
          "Proceso interrumpido. Verifica la entrega antes de reenviar.",
      })
      .where(
        and(
          eq(S.scheduledMessages.status, "processing"),
          sql`${S.scheduledMessages.lockedAt} < now() - interval '10 minutes'`,
        ),
      );
    const claimed = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(S.scheduledMessages)
        .where(
          and(
            eq(S.scheduledMessages.status, "pending"),
            sql`${S.scheduledMessages.scheduledAt} <= now()`,
            pushConfigured()
              ? inArray(S.scheduledMessages.channel, ["email", "push"])
              : eq(S.scheduledMessages.channel, "email"),
          ),
        )
        .orderBy(S.scheduledMessages.scheduledAt)
        .limit(4)
        .for("update", { skipLocked: true });
      if (rows.length)
        await tx
          .update(S.scheduledMessages)
          .set({
            status: "processing",
            lockedAt: new Date(),
            firstAttemptAt: sql`coalesce(${S.scheduledMessages.firstAttemptAt},now())`,
            attempts: sql`${S.scheduledMessages.attempts}+1`,
          })
          .where(
            inArray(
              S.scheduledMessages.id,
              rows.map((r) => r.id),
            ),
          );
      return rows;
    });
    stats.claimed = claimed.length;
    async function deliver(message: typeof S.scheduledMessages.$inferSelect) {
      const t = tenant(message.salonId);
      await db.transaction(async (tx) => {
        const [salon] = await tx
          .select()
          .from(S.salons)
          .where(eq(S.salons.id, t.id));
        // Mantiene el mismo orden de bloqueos que cancelar y reprogramar.
        const [appointment] = message.appointmentId
          ? await tx
              .select()
              .from(S.appointments)
              .where(
                t.where(
                  S.appointments,
                  eq(S.appointments.id, message.appointmentId),
                ),
              )
              .for("update")
          : [];
        const [current] = await tx
          .select()
          .from(S.scheduledMessages)
          .where(
            t.where(
              S.scheduledMessages,
              eq(S.scheduledMessages.id, message.id),
            ),
          )
          .for("update");
        if (!current || current.status !== "processing") return;
        const where = t.where(
          S.scheduledMessages,
          eq(S.scheduledMessages.id, message.id),
        );
        async function cancel(reason: string) {
          await tx
            .update(S.scheduledMessages)
            .set({ status: "cancelled", lastError: reason })
            .where(where);
          stats.skipped++;
        }
        const team =
          message.kind.startsWith("owner_") || message.kind === "daily_digest";
        if (!salon?.active) return cancel("Salón suspendido.");
        if (
          message.appointmentId &&
          (!appointment ||
            (message.appointmentVersion !== null &&
              message.appointmentVersion !== appointment.version))
        )
          return cancel("La cita cambió de versión.");
        if (
          appointment &&
          (message.kind === "owner_cancelled"
            ? appointment.status !== "cancelled"
            : ["cancelled", "no_show"].includes(appointment.status))
        )
          return cancel("Estado de cita incompatible.");
        if (team) {
          if (!message.userId) return cancel("Falta destinatario del equipo.");
          const [member] = await tx
            .select()
            .from(S.memberships)
            .where(
              t.where(S.memberships, eq(S.memberships.userId, message.userId)),
            );
          const [staff] = appointment
            ? await tx
                .select()
                .from(S.staff)
                .where(t.where(S.staff, eq(S.staff.id, appointment.staffId)))
            : [];
          if (
            !member ||
            (member.role !== "owner" &&
              !(
                message.channel === "push" &&
                member.role === "staff" &&
                staff?.userId === member.userId
              ))
          )
            return cancel("El destinatario ya no tiene permiso.");
          if (
            message.channel === "email" &&
            !(salon.settings.ownerEmailEnabled ?? true)
          )
            return cancel("Correos de la dueña deshabilitados.");
        } else if (!salon.settings.emailEnabled)
          return cancel("Correos a clientas deshabilitados.");
        if (
          message.kind.startsWith("reminder") &&
          appointment &&
          (appointment.status !== "confirmed" ||
            +appointment.startsAt <= Date.now())
        )
          return cancel("Recordatorio vencido.");
        if (message.kind === "thanks" && appointment?.status !== "completed") {
          await tx
            .update(S.scheduledMessages)
            .set({
              status:
                appointment && Date.now() - +appointment.endsAt < 48 * 3600000
                  ? "pending"
                  : "cancelled",
              scheduledAt: new Date(Date.now() + 3600000),
            })
            .where(where);
          stats.skipped++;
          return;
        }
        try {
          let providerId: string;
          if (message.channel === "push") {
            const [subscription] = message.subscriptionId
              ? await tx
                  .select()
                  .from(S.pushSubscriptions)
                  .where(
                    t.where(
                      S.pushSubscriptions,
                      eq(S.pushSubscriptions.id, message.subscriptionId),
                      eq(S.pushSubscriptions.userId, message.userId!),
                    ),
                  )
              : [];
            if (!subscription)
              return cancel("Suscripción de este dispositivo eliminada.");
            try {
              providerId = await sendPush(subscription, {
                title: salon.name,
                body: message.payload.text,
                url:
                  new URL(message.payload.managementUrl).pathname +
                  new URL(message.payload.managementUrl).search,
                tag: message.dedupeKey,
              });
            } catch (e) {
              const status = (e as { statusCode?: number }).statusCode;
              if (status === 404 || status === 410) {
                await tx
                  .delete(S.pushSubscriptions)
                  .where(
                    t.where(
                      S.pushSubscriptions,
                      eq(S.pushSubscriptions.id, subscription.id),
                    ),
                  );
                stats.skipped++;
                return;
              }
              throw new DeliveryError(
                status
                  ? `Web Push HTTP ${status}`
                  : "Web Push sin respuesta confirmada.",
                status === 429 || Boolean(status && status >= 500),
                !status,
              );
            }
          } else {
            if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
              throw new DeliveryError(
                "Configura Resend y un remitente verificado.",
              );
            if (
              message.firstAttemptAt &&
              Date.now() - +message.firstAttemptAt > 23 * 3600000
            )
              throw new DeliveryError(
                "Ventana de idempotencia expirada.",
                false,
                true,
              );
            const subject =
              message.kind === "daily_digest"
                ? "Tu agenda de hoy"
                : message.kind.startsWith("owner_")
                  ? {
                      owner_new: "Nueva cita",
                      owner_rescheduled: "Cita reprogramada",
                      owner_cancelled: "Cita cancelada",
                    }[message.kind as "owner_new"]
                  : "Tu cita";
            const result = await new Resend(
              process.env.RESEND_API_KEY,
            ).emails.send(
              {
                from: process.env.EMAIL_FROM,
                to: message.payload.email,
                subject: `${salon.name} · ${subject}`,
                react: (
                  <AppointmentEmail
                    salon={salon.name}
                    text={message.payload.text}
                    url={message.payload.managementUrl}
                    team={team}
                  />
                ),
              },
              {
                idempotencyKey: message.dedupeKey,
                signal: AbortSignal.timeout(12000),
              },
            );
            if (result.error)
              throw new DeliveryError(
                `Resend: ${result.error.name}`,
                [
                  "rate_limit_exceeded",
                  "application_error",
                  "internal_server_error",
                ].includes(result.error.name),
              );
            if (!result.data?.id)
              throw new DeliveryError(
                "Resend no confirmó la aceptación.",
                false,
                true,
              );
            providerId = result.data.id;
          }
          await tx
            .update(S.scheduledMessages)
            .set({
              status: "sent",
              sentAt: new Date(),
              providerId,
              lastError: null,
            })
            .where(where);
          stats.sent++;
        } catch (error) {
          const e =
            error instanceof DeliveryError
              ? error
              : new DeliveryError(
                  "Entrega incierta. Revisar el proveedor.",
                  false,
                  true,
                );
          const status = e.uncertain
            ? "uncertain"
            : e.retryable && message.attempts < 4
              ? "pending"
              : "failed";
          await tx
            .update(S.scheduledMessages)
            .set({
              status,
              lastError: e.message,
              scheduledAt: new Date(
                Date.now() + 2 ** (message.attempts + 1) * 60000,
              ),
            })
            .where(where);
          if (status === "uncertain") stats.uncertain++;
          else stats.failed++;
        }
      });
    }
    for (let i = 0; i < claimed.length; i += 2)
      await Promise.all(claimed.slice(i, i + 2).map(deliver));
    return stats;
  } finally {
    await close();
  }
}

// Agota los lotes inmediatos sin depender del cron de mañana. Cada lote tiene tiempo acotado.
export async function flushMessages() {
  const start = Date.now();
  let batch;
  do {
    batch = await processMessages();
  } while (batch.claimed === 4 && Date.now() - start < 130000);
}
