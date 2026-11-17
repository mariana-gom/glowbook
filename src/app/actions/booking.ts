"use server";
import { createHash } from "node:crypto";
import { bookingToken } from "@/lib/appointment-contact";
import { z } from "zod";
import { and, eq, gte, lt, inArray, sql } from "drizzle-orm";
import { after } from "next/server";
import { database } from "@/db";
import * as S from "@/db/schema";
import { tenant } from "@/db/tenant";
import { demoData, DEMO_SLUG } from "@/lib/demo";
import { availableSlots, type Slot } from "@/lib/availability";
import { bogotaDate, dayKey } from "@/lib/utils";
import {
  ensureAppointmentTasks,
  invalidateAppointmentTasks,
} from "@/lib/follow-ups";
import { enqueueTeamNotifications } from "@/lib/notification-builders";
import { buildMessages, flushMessages } from "@/lib/messages";
const selection = z.object({
  slug: z.string().min(1).max(100),
  serviceIds: z.array(z.uuid()).min(1).max(8),
  staffId: z.union([z.uuid(), z.literal("any")]),
  day: z.iso.date(),
});
export type Selection = z.infer<typeof selection>;
function supportedStaff(
  staff: (typeof S.staff.$inferSelect)[],
  skills: (typeof S.staffServices.$inferSelect)[],
  ids: string[],
  selected: string,
) {
  return staff
    .filter(
      (p) =>
        p.active &&
        (selected === "any" || p.id === selected) &&
        ids.every((id) =>
          skills.some((s) => s.staffId === p.id && s.serviceId === id),
        ),
    )
    .map((p) => p.id);
}
export async function getSlots(input: Selection): Promise<Slot[]> {
  const parsed = selection.safeParse(input);
  if (!parsed.success) return [];
  const q = parsed.data;
  if (q.slug === DEMO_SLUG) {
    const d = demoData(),
      selected = d.services.filter((s) => q.serviceIds.includes(s.id));
    if (selected.length !== new Set(q.serviceIds).size) return [];
    return availableSlots({
      day: q.day,
      staffIds: supportedStaff(
        d.staff,
        d.staffServices,
        q.serviceIds,
        q.staffId,
      ),
      duration: selected.reduce((n, s) => n + s.duration, 0),
      cleanup: selected.reduce((n, s) => n + s.cleanup, 0),
      hours: d.hours,
      busy: d.appointments,
      timeOff: d.timeOff,
      noticeHours: d.salon.settings.minNoticeHours,
      bookingDays: d.salon.settings.bookingDays,
    });
  }
  if (!process.env.DATABASE_URL) return [];
  const { db, close } = database();
  try {
    const [salon] = await db
      .select()
      .from(S.salons)
      .where(and(eq(S.salons.slug, q.slug), eq(S.salons.active, true)));
    if (!salon) return [];
    const t = tenant(salon.id);
    const [services, staff, skills, hours, busy, timeOff] = await Promise.all([
      db
        .select()
        .from(S.services)
        .where(
          t.where(
            S.services,
            inArray(S.services.id, q.serviceIds),
            eq(S.services.active, true),
          ),
        ),
      db
        .select()
        .from(S.staff)
        .where(t.where(S.staff, eq(S.staff.active, true))),
      db.select().from(S.staffServices).where(t.where(S.staffServices)),
      db.select().from(S.workingHours).where(t.where(S.workingHours)),
      db
        .select()
        .from(S.appointments)
        .where(
          t.where(
            S.appointments,
            gte(S.appointments.startsAt, new Date(bogotaDate(q.day, 0))),
            lt(S.appointments.startsAt, new Date(bogotaDate(q.day, 1440))),
          ),
        ),
      db
        .select()
        .from(S.timeOff)
        .where(
          t.where(
            S.timeOff,
            lt(S.timeOff.startsAt, new Date(bogotaDate(q.day, 1440))),
            gte(S.timeOff.endsAt, new Date(bogotaDate(q.day, 0))),
          ),
        ),
    ]);
    if (services.length !== new Set(q.serviceIds).size) return [];
    return availableSlots({
      day: q.day,
      staffIds: supportedStaff(staff, skills, q.serviceIds, q.staffId),
      duration: services.reduce((n, s) => n + s.duration, 0),
      cleanup: services.reduce((n, s) => n + s.cleanup, 0),
      hours,
      busy,
      timeOff,
      noticeHours: salon.settings.minNoticeHours,
      bookingDays: salon.settings.bookingDays,
    });
  } finally {
    await close();
  }
}
const booking = selection.extend({
  startsAt: z.iso.datetime(),
  name: z.string().trim().min(3).max(100),
  phone: z.string().regex(/^(\+57)?3\d{9}$/),
  email: z.email().max(180),
  consent: z.literal(true),
  marketingConsent: z.boolean(),
  requestKey: z.uuid(),
  website: z.literal(""),
});
export type BookingInput = z.infer<typeof booking>;
export async function createBooking(
  input: BookingInput,
): Promise<{ error?: string; url?: string }> {
  const parsed = booking.safeParse(input);
  if (!parsed.success)
    return {
      error: "Revisa tus datos y acepta el tratamiento de datos para reservar.",
    };
  if (!process.env.DATABASE_URL || parsed.data.slug === DEMO_SLUG)
    return { error: "Estás en el demo. No se crean citas reales." };
  if (
    !process.env.BOOKING_TOKEN_SECRET ||
    process.env.BOOKING_TOKEN_SECRET.length < 32 ||
    !process.env.BETTER_AUTH_URL
  )
    return { error: "El salón todavía no ha habilitado las reservas." };
  const q = parsed.data,
    { db, close } = database();
  const token = bookingToken(q.requestKey);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  try {
    await db.transaction(async (tx) => {
      const [salon] = await tx
        .select()
        .from(S.salons)
        .where(and(eq(S.salons.slug, q.slug), eq(S.salons.active, true)));
      if (!salon) throw new Error("Salón no disponible.");
      const t = tenant(salon.id);
      const [existing] = await tx
        .select()
        .from(S.appointments)
        .where(
          t.where(S.appointments, eq(S.appointments.requestKey, q.requestKey)),
        );
      if (existing) return;
      const staffId = q.staffId;
      if (staffId === "any")
        throw new Error("Selecciona un horario con profesional.");
      const [professional] = await tx
        .select()
        .from(S.staff)
        .where(
          t.where(S.staff, eq(S.staff.id, staffId), eq(S.staff.active, true)),
        )
        .for("update");
      if (!professional) throw new Error("Profesional no disponible.");
      const services = await tx
        .select()
        .from(S.services)
        .where(
          t.where(
            S.services,
            inArray(S.services.id, q.serviceIds),
            eq(S.services.active, true),
          ),
        );
      if (services.length !== new Set(q.serviceIds).size)
        throw new Error("Uno de los servicios ya no está disponible.");
      const skills = await tx
        .select()
        .from(S.staffServices)
        .where(t.where(S.staffServices, eq(S.staffServices.staffId, staffId)));
      if (!supportedStaff([professional], skills, q.serviceIds, staffId).length)
        throw new Error("La profesional no realiza todos esos servicios.");
      const hours = await tx
        .select()
        .from(S.workingHours)
        .where(t.where(S.workingHours, eq(S.workingHours.staffId, staffId)));
      const busy = await tx
        .select()
        .from(S.appointments)
        .where(
          t.where(
            S.appointments,
            eq(S.appointments.staffId, staffId),
            gte(S.appointments.busyUntil, new Date(bogotaDate(q.day, 0))),
            lt(S.appointments.startsAt, new Date(bogotaDate(q.day, 1440))),
          ),
        );
      const timeOff = await tx
        .select()
        .from(S.timeOff)
        .where(t.where(S.timeOff, eq(S.timeOff.staffId, staffId)));
      const duration = services.reduce((n, s) => n + s.duration, 0),
        cleanup = services.reduce((n, s) => n + s.cleanup, 0);
      const slots = availableSlots({
        day: q.day,
        staffIds: [staffId],
        duration,
        cleanup,
        hours,
        busy,
        timeOff,
        noticeHours: salon.settings.minNoticeHours,
        bookingDays: salon.settings.bookingDays,
      });
      if (!slots.some((s) => s.startsAt === q.startsAt))
        throw new Error("Ese horario acaba de ocuparse. Elige otro.");
      if (dayKey(new Date(q.startsAt)) !== q.day)
        throw new Error("Horario no disponible.");
      const phone = q.phone.startsWith("+57") ? q.phone : `+57${q.phone}`;
      // Limita reservas públicas por contacto sin modificar la identidad de una clienta existente.
      const [client] = await tx
        .insert(S.clients)
        .values({
          salonId: t.id,
          name: q.name,
          phone,
          email: q.email,
          consentAt: new Date(),
          marketingConsent: q.marketingConsent,
        })
        .onConflictDoUpdate({
          target: [S.clients.salonId, S.clients.phone],
          set: { phone },
        })
        .returning();
      const count = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(S.appointments)
        .where(
          t.where(
            S.appointments,
            eq(S.appointments.clientId, client.id),
            eq(S.appointments.status, "confirmed"),
            gte(S.appointments.startsAt, new Date()),
          ),
        );
      if (count[0].count >= 5)
        throw new Error(
          "Ya tienes varias citas activas. Contacta al salón para reservar otra.",
        );
      const startsAt = new Date(q.startsAt),
        endsAt = new Date(+startsAt + duration * 60000);
      const [appointment] = await tx
        .insert(S.appointments)
        .values({
          salonId: t.id,
          clientId: client.id,
          staffId,
          startsAt,
          endsAt,
          busyUntil: new Date(+endsAt + cleanup * 60000),
          contact: { name: q.name, email: q.email, phone },
          total: services.reduce((n, s) => n + s.price, 0),
          tokenHash,
          requestKey: q.requestKey,
        })
        .returning();
      await tx.insert(S.appointmentServices).values(
        services.map((s) => ({
          salonId: t.id,
          appointmentId: appointment.id,
          serviceId: s.id,
          name: s.name,
          price: s.price,
          duration: s.duration,
          cleanup: s.cleanup,
        })),
      );
      const messages = buildMessages(
        salon,
        appointment,
        { ...client, name: q.name, email: q.email },
        token,
        services.map((s) => s.name),
        professional.name,
      );
      if (messages.length)
        await tx
          .insert(S.scheduledMessages)
          .values(messages)
          .onConflictDoNothing();
      await ensureAppointmentTasks(tx, appointment);
      await tx
        .update(S.followUpTasks)
        .set({ status: "dismissed" })
        .where(
          t.where(
            S.followUpTasks,
            eq(S.followUpTasks.clientId, client.id),
            eq(S.followUpTasks.status, "pending"),
            inArray(S.followUpTasks.kind, ["maintenance", "reactivation"]),
          ),
        );
      await enqueueTeamNotifications(tx, salon, appointment, "created");
    });
    after(async () => {
      try {
        await flushMessages();
      } catch {
        console.error("No se procesó la cola inmediata; el cron la retomará.");
      }
    });
    return { url: `/gestionar/${token}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    return {
      error: /horario|disponible|servicios|Selecciona|varias citas/.test(msg)
        ? msg
        : "No pudimos confirmar la cita. Actualiza los horarios e intenta nuevamente.",
    };
  } finally {
    await close();
  }
}
export async function manageBooking(
  token: string,
  action: "cancel" | "reschedule" | "review",
  values: { startsAt?: string; rating?: number; comment?: string },
) {
  if (!/^[a-f0-9]{64}$/.test(token) || !process.env.DATABASE_URL)
    return { error: "Enlace no válido." };
  const { db, close } = database();
  try {
    await db.transaction(async (tx) => {
      const hash = createHash("sha256").update(token).digest("hex");
      // El token aleatorio es la autorización de la clienta; a partir de él se fija el tenant.
      const [lookup] = await tx
        .select({
          salonId: S.appointments.salonId,
          staffId: S.appointments.staffId,
        })
        .from(S.appointments)
        .where(eq(S.appointments.tokenHash, hash));
      if (!lookup) throw new Error("Enlace no válido.");
      const t = tenant(lookup.salonId);
      await tx
        .select()
        .from(S.staff)
        .where(t.where(S.staff, eq(S.staff.id, lookup.staffId)))
        .for("update");
      const [a] = await tx
        .select()
        .from(S.appointments)
        .where(t.where(S.appointments, eq(S.appointments.tokenHash, hash)))
        .for("update");
      const [salon] = await tx
        .select()
        .from(S.salons)
        .where(and(eq(S.salons.id, t.id), eq(S.salons.active, true)));
      if (!salon) throw new Error("Salón no disponible.");
      if (action === "review") {
        if (a.status !== "completed")
          throw new Error(
            "Podrás dejar tu reseña después de que el salón complete la cita.",
          );
        const v = z
          .object({
            rating: z.number().int().min(1).max(5),
            comment: z.string().trim().min(10).max(1000),
          })
          .parse(values);
        const [client] = await tx
          .select()
          .from(S.clients)
          .where(t.where(S.clients, eq(S.clients.id, a.clientId)));
        await tx
          .insert(S.reviews)
          .values({
            salonId: t.id,
            appointmentId: a.id,
            clientId: a.clientId,
            author: client.name,
            rating: v.rating,
            comment: v.comment,
          })
          .onConflictDoNothing();
        return;
      }
      if (a.status === "cancelled" && action === "cancel") return;
      if (
        action === "reschedule" &&
        values.startsAt === a.startsAt.toISOString()
      )
        return;
      if (
        a.status !== "confirmed" ||
        +a.startsAt - Date.now() < salon.settings.cancellationHours * 3600000
      )
        throw new Error(
          `Los cambios requieren al menos ${salon.settings.cancellationHours} horas de anticipación. Contacta al salón.`,
        );
      await tx
        .update(S.scheduledMessages)
        .set({ status: "cancelled" })
        .where(
          t.where(
            S.scheduledMessages,
            eq(S.scheduledMessages.appointmentId, a.id),
            inArray(S.scheduledMessages.status, ["pending", "processing"]),
          ),
        );
      await invalidateAppointmentTasks(tx, t.id, a.id);
      if (action === "cancel") {
        const [cancelled] = await tx
          .update(S.appointments)
          .set({ status: "cancelled", version: a.version + 1 })
          .where(t.where(S.appointments, eq(S.appointments.id, a.id)))
          .returning();
        await enqueueTeamNotifications(tx, salon, cancelled, "cancelled");
        return;
      }
      const startsAt = new Date(z.iso.datetime().parse(values.startsAt));
      const duration = (+a.endsAt - +a.startsAt) / 60000,
        cleanup = (+a.busyUntil - +a.endsAt) / 60000;
      const hours = await tx
        .select()
        .from(S.workingHours)
        .where(t.where(S.workingHours, eq(S.workingHours.staffId, a.staffId)));
      const busy = await tx
        .select()
        .from(S.appointments)
        .where(
          t.where(
            S.appointments,
            eq(S.appointments.staffId, a.staffId),
            sql`${S.appointments.id} <> ${a.id}`,
            gte(
              S.appointments.busyUntil,
              new Date(bogotaDate(dayKey(startsAt), 0)),
            ),
            lt(
              S.appointments.startsAt,
              new Date(bogotaDate(dayKey(startsAt), 1440)),
            ),
          ),
        );
      const timeOff = await tx
        .select()
        .from(S.timeOff)
        .where(t.where(S.timeOff, eq(S.timeOff.staffId, a.staffId)));
      if (
        !availableSlots({
          day: dayKey(startsAt),
          staffIds: [a.staffId],
          duration,
          cleanup,
          hours,
          busy,
          timeOff,
          noticeHours: salon.settings.minNoticeHours,
          bookingDays: salon.settings.bookingDays,
        }).some((s) => s.startsAt === startsAt.toISOString())
      )
        throw new Error("Ese horario no está disponible.");
      const endsAt = new Date(+startsAt + duration * 60000);
      const [updated] = await tx
        .update(S.appointments)
        .set({
          startsAt,
          endsAt,
          busyUntil: new Date(+endsAt + cleanup * 60000),
          version: a.version + 1,
          ownerConfirmedAt: null,
        })
        .where(t.where(S.appointments, eq(S.appointments.id, a.id)))
        .returning();
      const [client] = await tx
        .select()
        .from(S.clients)
        .where(t.where(S.clients, eq(S.clients.id, a.clientId)));
      const detail = await tx
        .select()
        .from(S.appointmentServices)
        .where(
          t.where(
            S.appointmentServices,
            eq(S.appointmentServices.appointmentId, a.id),
          ),
        );
      const [professional] = await tx
        .select()
        .from(S.staff)
        .where(t.where(S.staff, eq(S.staff.id, a.staffId)));
      const messages = buildMessages(
        salon,
        updated,
        client,
        token,
        detail.map((s) => s.name),
        professional?.name ?? "Tu profesional",
      );
      await ensureAppointmentTasks(tx, updated);
      await enqueueTeamNotifications(tx, salon, updated, "rescheduled");
      if (messages.length)
        await tx
          .insert(S.scheduledMessages)
          .values(messages)
          .onConflictDoNothing();
    });
    if (action !== "review")
      after(async () => {
        try {
          await flushMessages();
        } catch {
          console.error("La cola retomará los avisos de cambio.");
        }
      });
    return { ok: true };
  } catch (e) {
    return {
      error:
        e instanceof z.ZodError
          ? "Revisa los datos ingresados."
          : e instanceof Error
            ? e.message
            : "No fue posible guardar.",
    };
  } finally {
    await close();
  }
}
