import { Resend } from "resend";
import { AppointmentEmail } from "@/emails/appointment";
import { eq, sql, and, inArray } from "drizzle-orm";
import { database } from "@/db";
import * as S from "@/db/schema";
import { tenant } from "@/db/tenant";
import { prettyDate, clock } from "./utils";
export function buildMessages(
  salon: typeof S.salons.$inferSelect,
  appointment: typeof S.appointments.$inferSelect,
  client: typeof S.clients.$inferSelect,
  token: string,
) {
  client = { ...client, ...appointment.contact };
  const settings = salon.settings;
  const url = `${process.env.BETTER_AUTH_URL}/gestionar/${token}`;
  const timings = [
    { kind: "confirmation", at: Date.now() },
    { kind: "reminder24", at: +appointment.startsAt - 24 * 3600000 },
    { kind: "reminder2", at: +appointment.startsAt - 2 * 3600000 },
    { kind: "thanks", at: +appointment.endsAt + 2 * 3600000 },
  ] as const;
  return timings
    .filter((x) => x.kind === "confirmation" || x.at > Date.now())
    .flatMap(({ kind, at }) =>
      (["email", "whatsapp"] as const)
        .filter((channel) =>
          channel === "email"
            ? settings.emailEnabled
            : settings.whatsappEnabled,
        )
        .map((channel) => ({
          salonId: salon.id,
          appointmentId: appointment.id,
          clientId: client.id,
          kind,
          channel,
          dedupeKey: `${appointment.id}:${appointment.version}:${kind}:${channel}`,
          scheduledAt: new Date(at),
          payload: {
            name: client.name,
            email: client.email,
            phone: client.phone,
            salon: salon.name,
            text: settings.messages[kind]
              .replaceAll("{nombre}", client.name)
              .replaceAll("{salon}", salon.name)
              .replaceAll(
                "{fecha}",
                `${prettyDate(appointment.startsAt)} a las ${clock(appointment.startsAt)}`,
              )
              .replaceAll("{enlace}", url),
            managementUrl: url,
            template: settings.whatsappTemplates[kind],
          },
        })),
    );
}
class DeliveryError extends Error {
  constructor(
    message: string,
    public retryable = false,
    public uncertain = false,
  ) {
    super(message);
  }
}
// Único punto de integración con Meta: las plantillas aprobadas deben tener dos parámetros: texto y enlace.
export async function sendWhatsApp(input: {
  phone: string;
  template?: string;
  text: string;
  managementUrl: string;
}) {
  if (
    !process.env.WHATSAPP_TOKEN ||
    !process.env.WHATSAPP_PHONE_NUMBER_ID ||
    !input.template
  )
    throw new DeliveryError(
      "Faltan credenciales o plantilla aprobada de WhatsApp.",
    );
  let response: Response;
  try {
    response = await fetch(
      `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION ?? "v23.0"}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: input.phone.replace("+", ""),
          type: "template",
          template: {
            name: input.template,
            language: { code: "es_CO" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: input.text },
                  { type: "text", text: input.managementUrl },
                ],
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(12000),
      },
    );
  } catch {
    throw new DeliveryError(
      "Respuesta de Meta incierta; revisar en el proveedor antes de reenviar.",
      false,
      true,
    );
  }
  if (!response.ok)
    throw new DeliveryError(
      `Meta HTTP ${response.status}`,
      response.status === 429,
      response.status >= 500,
    );
  const body = await response.json();
  if (!body.messages?.[0]?.id)
    throw new DeliveryError(
      "Meta no confirmó el identificador del envío.",
      false,
      true,
    );
  return body.messages[0].id as string;
}
export async function processMessages() {
  const { db, close } = database();
  const stats = { sent: 0, failed: 0, uncertain: 0, skipped: 0 };
  try {
    // Un envío abandonado puede haber llegado al proveedor: nunca se reenvía automáticamente.
    await db
      .update(S.scheduledMessages)
      .set({
        status: "uncertain",
        lastError:
          "El proceso perdió su bloqueo. Verificar entrega con el proveedor.",
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
          ),
        )
        .orderBy(S.scheduledMessages.scheduledAt)
        .limit(8)
        .for("update", { skipLocked: true });
      if (rows.length)
        await tx
          .update(S.scheduledMessages)
          .set({
            status: "processing",
            lockedAt: new Date(),
            firstAttemptAt: sql`coalesce(${S.scheduledMessages.firstAttemptAt}, now())`,
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
    async function deliver(message: typeof S.scheduledMessages.$inferSelect) {
      const t = tenant(message.salonId);
      // Serializa envío vs cancelación/reprogramación y vuelve a validar el estado actual.
      await db.transaction(async (tx) => {
        const [salon] = await tx
          .select()
          .from(S.salons)
          .where(eq(S.salons.id, t.id));
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
        if (current.status !== "processing") return;
        const where = t.where(
          S.scheduledMessages,
          eq(S.scheduledMessages.id, message.id),
        );
        if (
          !salon?.active ||
          (message.appointmentId &&
            (!appointment ||
              ["cancelled", "no_show"].includes(appointment.status)))
        ) {
          await tx
            .update(S.scheduledMessages)
            .set({ status: "cancelled" })
            .where(where);
          stats.skipped++;
          return;
        }
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
        if (
          message.kind.startsWith("reminder") &&
          appointment &&
          +appointment.startsAt <= Date.now()
        ) {
          await tx
            .update(S.scheduledMessages)
            .set({ status: "cancelled" })
            .where(where);
          stats.skipped++;
          return;
        }
        try {
          let providerId: string;
          if (message.channel === "whatsapp")
            providerId = await sendWhatsApp(message.payload);
          else {
            if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
              throw new DeliveryError(
                "Configura Resend y un remitente verificado.",
              );
            // Resend conserva las claves de idempotencia 24h. Fuera de ese plazo se revisa manualmente.
            if (
              message.attempts > 0 &&
              message.firstAttemptAt &&
              Date.now() - +message.firstAttemptAt > 23 * 3600000
            )
              throw new DeliveryError(
                "La ventana de idempotencia expiró.",
                false,
                true,
              );
            const resend = new Resend(process.env.RESEND_API_KEY);
            const result = await resend.emails.send(
              {
                from: process.env.EMAIL_FROM,
                to: message.payload.email,
                subject: `${message.payload.salon} · ${message.kind === "thanks" ? "¿Cómo estuvo tu visita?" : "Tu cita"}`,
                react: (
                  <AppointmentEmail
                    salon={message.payload.salon}
                    text={message.payload.text}
                    url={message.payload.managementUrl}
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
                "Resend no confirmó el envío.",
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
                  "Entrega incierta. Consultar el proveedor.",
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
                Date.now() + Math.pow(2, message.attempts + 1) * 60000,
              ),
            })
            .where(where);
          if (status === "uncertain") stats.uncertain++;
          else stats.failed++;
        }
      });
    }
    // Dos envíos paralelos mantienen la carga y el tiempo de ejecución acotados.
    for (let i = 0; i < claimed.length; i += 2)
      await Promise.all(claimed.slice(i, i + 2).map(deliver));
    return stats;
  } finally {
    await close();
  }
}
