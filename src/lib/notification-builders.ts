import { eq, gte, lt } from "drizzle-orm";
import type { Transaction } from "@/db";
import * as S from "@/db/schema";
import { tenant } from "@/db/tenant";
import { appointmentWhatsAppData, publicOrigin } from "./appointment-contact";
import { renderMessage } from "./whatsapp";
import { bogotaDate, dayKey, clock, prettyDate } from "./utils";
export type QueueMessage = typeof S.scheduledMessages.$inferInsert;
export type AppointmentEvent = "created" | "rescheduled" | "cancelled";
export function buildMessages(
  salon: typeof S.salons.$inferSelect,
  appointment: typeof S.appointments.$inferSelect,
  client: typeof S.clients.$inferSelect,
  token: string,
  serviceNames: string[] = [],
  professional = "",
): QueueMessage[] {
  if (!salon.settings.emailEnabled) return [];
  const contact = { ...client, ...appointment.contact },
    data = appointmentWhatsAppData(
      salon,
      appointment,
      serviceNames,
      professional,
      token,
    );
  // El cron diario envía el recordatorio el día anterior, no a un minuto exacto.
  const previousDay = dayKey(new Date(+appointment.startsAt - 86400000));
  const timings = [
    { kind: "confirmation", at: Date.now() },
    { kind: "reminder24", at: bogotaDate(previousDay, 420) },
    { kind: "thanks", at: +appointment.endsAt + 2 * 3600000 },
  ] as const;
  return timings
    .filter(
      (x) =>
        x.kind !== "reminder24" || bogotaDate(previousDay, 420) > Date.now(),
    )
    .map(({ kind, at }) => ({
      salonId: salon.id,
      appointmentId: appointment.id,
      appointmentVersion: appointment.version,
      clientId: client.id,
      kind,
      channel: "email",
      dedupeKey: `${appointment.id}:${appointment.version}:${kind}:email`,
      scheduledAt: new Date(at),
      payload: {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        salon: salon.name,
        // Compatibilidad con plantillas antiguas que incluían la hora dentro de {fecha}.
        text: renderMessage(salon.settings.messages[kind], {
          ...data,
          fecha: salon.settings.messages[kind].includes("{hora}")
            ? data.fecha
            : `${data.fecha} a las ${data.hora}`,
        }),
        managementUrl: data.enlace_reprogramar!,
      },
    }));
}
export async function enqueueTeamNotifications(
  tx: Transaction,
  salon: typeof S.salons.$inferSelect,
  appointment: typeof S.appointments.$inferSelect,
  event: AppointmentEvent,
) {
  const t = tenant(salon.id),
    kind = (
      {
        created: "owner_new",
        rescheduled: "owner_rescheduled",
        cancelled: "owner_cancelled",
      } as const
    )[event];
  const members = await tx
    .select({
      userId: S.users.id,
      email: S.users.email,
      name: S.users.name,
      role: S.memberships.role,
    })
    .from(S.memberships)
    .innerJoin(S.users, eq(S.users.id, S.memberships.userId))
    .where(t.where(S.memberships));
  const [professional] = await tx
    .select()
    .from(S.staff)
    .where(t.where(S.staff, eq(S.staff.id, appointment.staffId)));
  const recipients = members.filter(
    (m) =>
      m.role === "owner" ||
      (m.role === "staff" && m.userId === professional?.userId),
  );
  const subscriptions = await tx
    .select()
    .from(S.pushSubscriptions)
    .where(t.where(S.pushSubscriptions));
  const label = (
    {
      created: "Nueva cita",
      rescheduled: "Cita reprogramada",
      cancelled: "Cita cancelada",
    } as const
  )[event];
  const url = `${publicOrigin()}/panel/agenda?dia=${dayKey(appointment.startsAt)}`;
  const rows: QueueMessage[] = [];
  for (const member of recipients) {
    const payload = {
      name: member.name,
      email: member.email,
      phone: "",
      salon: salon.name,
      text: `${label}: ${appointment.contact.name}, ${prettyDate(appointment.startsAt)} a las ${clock(appointment.startsAt)}. Código ${appointment.id.slice(0, 8).toUpperCase()}. Consulta los detalles en tu agenda.`,
      managementUrl: url,
    };
    if (member.role === "owner" && (salon.settings.ownerEmailEnabled ?? true))
      rows.push({
        salonId: t.id,
        appointmentId: appointment.id,
        appointmentVersion: appointment.version,
        userId: member.userId,
        kind,
        channel: "email",
        dedupeKey: `${appointment.id}:${appointment.version}:${kind}:${member.userId}:email`,
        scheduledAt: new Date(),
        payload,
      });
    for (const sub of subscriptions.filter((s) => s.userId === member.userId))
      rows.push({
        salonId: t.id,
        appointmentId: appointment.id,
        appointmentVersion: appointment.version,
        userId: member.userId,
        subscriptionId: sub.id,
        kind,
        channel: "push",
        dedupeKey: `${appointment.id}:${appointment.version}:${kind}:${sub.id}:push`,
        scheduledAt: new Date(),
        payload: {
          ...payload,
          text: `${label} en ${salon.name}. Abre tu agenda para ver los detalles.`,
        },
      });
  }
  if (rows.length)
    await tx.insert(S.scheduledMessages).values(rows).onConflictDoNothing();
}
export async function enqueueDailyDigest(
  tx: Transaction,
  salon: typeof S.salons.$inferSelect,
  day: string,
) {
  if (!(salon.settings.ownerEmailEnabled ?? true)) return;
  const t = tenant(salon.id),
    start = new Date(bogotaDate(day, 0)),
    end = new Date(bogotaDate(day, 1440));
  const appointments = await tx
    .select()
    .from(S.appointments)
    .where(
      t.where(
        S.appointments,
        eq(S.appointments.status, "confirmed"),
        gte(S.appointments.startsAt, start),
        lt(S.appointments.startsAt, end),
      ),
    );
  const today = appointments
    .filter((a) => +a.startsAt >= +start && +a.startsAt < +end)
    .sort((a, b) => +a.startsAt - +b.startsAt);
  const owners = await tx
    .select({ id: S.users.id, email: S.users.email, name: S.users.name })
    .from(S.memberships)
    .innerJoin(S.users, eq(S.users.id, S.memberships.userId))
    .where(t.where(S.memberships, eq(S.memberships.role, "owner")));
  const text = `Agenda del ${prettyDate(start)}: ${today.length} citas.\n${today.map((a) => `${clock(a.startsAt)} · ${a.contact.name} · Código ${a.id.slice(0, 8).toUpperCase()}`).join("\n") || "Hoy tienes espacio para nuevas reservas."}`;
  if (owners.length)
    await tx
      .insert(S.scheduledMessages)
      .values(
        owners.map((o) => ({
          salonId: t.id,
          userId: o.id,
          kind: "daily_digest" as const,
          channel: "email" as const,
          dedupeKey: `digest:${salon.id}:${day}:${o.id}`,
          scheduledAt: new Date(),
          payload: {
            name: o.name,
            email: o.email,
            phone: "",
            salon: salon.name,
            text,
            managementUrl: `${publicOrigin()}/panel/agenda?dia=${day}`,
          },
        })),
      )
      .onConflictDoNothing();
}
