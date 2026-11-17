import { eq, desc, gte, inArray, sql } from "drizzle-orm";
import { database, type Transaction } from "@/db";
import * as S from "@/db/schema";
import { tenant } from "@/db/tenant";
import { demoData, demoId } from "./demo";
import { dayKey, bogotaDate } from "./utils";
import { planDailyTasks, appointmentTasks } from "./follow-up-plan";
import { appointmentWhatsAppData, publicOrigin } from "./appointment-contact";
import {
  defaultWhatsAppMessages,
  sendWhatsApp,
  type WhatsAppData,
} from "./whatsapp";
export type FollowUpItem = {
  id: string;
  kind: S.FollowUpKind;
  name: string;
  detail: string;
  dueOn: string;
  status: (typeof S.followUpTasks.$inferSelect)["status"];
};
export async function ensureAppointmentTasks(
  tx: Transaction,
  a: typeof S.appointments.$inferSelect,
) {
  const rows = appointmentTasks(a);
  if (rows.length)
    await tx.insert(S.followUpTasks).values(rows).onConflictDoNothing();
}
export async function invalidateAppointmentTasks(
  tx: Transaction,
  salonId: string,
  appointmentId: string,
) {
  const t = tenant(salonId);
  await tx
    .update(S.followUpTasks)
    .set({ status: "dismissed" })
    .where(
      t.where(
        S.followUpTasks,
        eq(S.followUpTasks.appointmentId, appointmentId),
        eq(S.followUpTasks.status, "pending"),
      ),
    );
}
export async function prepareFollowUps(
  tx: Transaction,
  salon: typeof S.salons.$inferSelect,
  now: Date,
) {
  const t = tenant(salon.id),
    start = new Date(bogotaDate(dayKey(now), 0));
  const [clients, upcoming, recentCompleted, lastVisits, lastServices] =
    await Promise.all([
      tx.select().from(S.clients).where(t.where(S.clients)),
      tx
        .select()
        .from(S.appointments)
        .where(
          t.where(
            S.appointments,
            eq(S.appointments.status, "confirmed"),
            gte(S.appointments.endsAt, start),
          ),
        ),
      tx
        .select()
        .from(S.appointments)
        .where(
          t.where(
            S.appointments,
            eq(S.appointments.status, "completed"),
            gte(S.appointments.endsAt, new Date(+start - 7 * 86400000)),
          ),
        ),
      tx
        .selectDistinctOn([S.appointments.clientId], {
          clientId: S.appointments.clientId,
          appointmentId: S.appointments.id,
          endsAt: S.appointments.endsAt,
        })
        .from(S.appointments)
        .where(t.where(S.appointments, eq(S.appointments.status, "completed")))
        .orderBy(S.appointments.clientId, desc(S.appointments.endsAt)),
      tx
        .selectDistinctOn(
          [S.appointments.clientId, S.appointmentServices.serviceId],
          {
            clientId: S.appointments.clientId,
            appointmentId: S.appointments.id,
            endsAt: S.appointments.endsAt,
            serviceId: S.appointmentServices.serviceId,
            maintenanceDays: S.services.maintenanceDays,
          },
        )
        .from(S.appointmentServices)
        .innerJoin(
          S.appointments,
          sql`${S.appointments.id}=${S.appointmentServices.appointmentId} AND ${S.appointments.salonId}=${S.appointmentServices.salonId}`,
        )
        .innerJoin(
          S.services,
          sql`${S.services.id}=${S.appointmentServices.serviceId} AND ${S.services.salonId}=${S.appointmentServices.salonId}`,
        )
        .where(
          t.where(
            S.appointmentServices,
            eq(S.appointments.status, "completed"),
            sql`${S.services.maintenanceDays} > 0`,
          ),
        )
        .orderBy(
          S.appointments.clientId,
          S.appointmentServices.serviceId,
          desc(S.appointments.endsAt),
        ),
    ]);
  const planned = planDailyTasks({
    salonId: t.id,
    now,
    reactivationDays: salon.settings.reactivationDays ?? 60,
    clients,
    upcoming,
    recentCompleted,
    lastVisits,
    lastServices: lastServices.map((s) => ({
      ...s,
      maintenanceDays: s.maintenanceDays!,
    })),
  });
  // Descarta seguimientos que dejaron de aplicar; no altera el registro histórico de toques.
  const ids = planned.map((p) => p.dedupeKey);
  await tx
    .update(S.followUpTasks)
    .set({ status: "dismissed" })
    .where(
      t.where(
        S.followUpTasks,
        eq(S.followUpTasks.status, "pending"),
        sql`${S.followUpTasks.dueOn} <= ${dayKey(now)}`,
        ids.length
          ? sql`${S.followUpTasks.dedupeKey} NOT IN (${sql.join(
              ids.map((k) => sql`${k}`),
              sql`, `,
            )})`
          : undefined,
      ),
    );
  // En lotes para no superar los límites de parámetros de Postgres.
  for (let i = 0; i < planned.length; i += 200)
    await tx
      .insert(S.followUpTasks)
      .values(planned.slice(i, i + 200))
      .onConflictDoUpdate({
        target: [S.followUpTasks.salonId, S.followUpTasks.dedupeKey],
        set: {
          status: sql`CASE WHEN ${S.followUpTasks.status}='dismissed' THEN 'pending' ELSE ${S.followUpTasks.status} END`,
        },
      });
  return planned.length;
}
export function demoFollowUps(now = new Date()) {
  const d = demoData(now),
    completed = d.appointments
      .filter((a) => a.status === "completed")
      .sort((a, b) => +b.endsAt - +a.endsAt);
  const lastVisits = completed
    .filter(
      (a, i, rows) => rows.findIndex((v) => v.clientId === a.clientId) === i,
    )
    .map((a) => ({
      clientId: a.clientId,
      appointmentId: a.id,
      endsAt: a.endsAt,
    }));
  const lastServices = completed
    .flatMap((a) =>
      d.appointmentServices
        .filter((s) => s.appointmentId === a.id)
        .map((s) => ({
          clientId: a.clientId,
          appointmentId: a.id,
          endsAt: a.endsAt,
          serviceId: s.serviceId,
          maintenanceDays:
            d.services.find((v) => v.id === s.serviceId)?.maintenanceDays ?? 0,
        })),
    )
    .filter(
      (s, i, rows) =>
        s.maintenanceDays > 0 &&
        rows.findIndex(
          (v) => v.clientId === s.clientId && v.serviceId === s.serviceId,
        ) === i,
    );
  return planDailyTasks({
    salonId: d.salon.id,
    now,
    reactivationDays: d.salon.settings.reactivationDays,
    clients: d.clients,
    upcoming: d.appointments.filter((a) => a.status === "confirmed"),
    recentCompleted: completed.filter((a) => dayKey(a.endsAt) === dayKey(now)),
    lastVisits,
    lastServices,
  }).map((row) => ({
    ...row,
    id: demoId(row.dedupeKey),
    status: "pending" as const,
  }));
}
export async function listFollowUps(
  salonId: string,
  demo = false,
): Promise<FollowUpItem[]> {
  const today = dayKey();
  if (demo) {
    const d = demoData();
    return demoFollowUps()
      .filter((r) => r.dueOn <= today)
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        name: d.clients.find((c) => c.id === r.clientId)!.name,
        detail: r.appointmentId
          ? d.appointmentServices
              .filter(
                (s) =>
                  s.appointmentId === r.appointmentId &&
                  (!r.serviceId || s.serviceId === r.serviceId),
              )
              .map((s) => s.name)
              .join(" + ")
          : "Un detalle de tu salón",
        dueOn: r.dueOn,
        status: r.status,
      }));
  }
  const { db, close } = database(),
    t = tenant(salonId);
  try {
    return await db
      .select({
        id: S.followUpTasks.id,
        kind: S.followUpTasks.kind,
        name: S.clients.name,
        detail: S.clients.phone,
        dueOn: S.followUpTasks.dueOn,
        status: S.followUpTasks.status,
      })
      .from(S.followUpTasks)
      .innerJoin(
        S.clients,
        sql`${S.clients.id}=${S.followUpTasks.clientId} AND ${S.clients.salonId}=${S.followUpTasks.salonId}`,
      )
      .where(
        t.where(
          S.followUpTasks,
          sql`${S.followUpTasks.dueOn} <= ${today}`,
          inArray(S.followUpTasks.status, ["pending", "marked_sent"]),
          sql`(${S.followUpTasks.status}='pending' OR ${S.followUpTasks.markedAt} >= ${new Date(bogotaDate(today, 0))})`,
        ),
      )
      .orderBy(
        sql`CASE WHEN ${S.followUpTasks.status}='pending' THEN 0 ELSE 1 END`,
        S.followUpTasks.dueOn,
      )
      .limit(300);
  } finally {
    await close();
  }
}
export async function taskWhatsApp(
  tx: Transaction,
  salon: typeof S.salons.$inferSelect,
  task: typeof S.followUpTasks.$inferSelect,
) {
  const t = tenant(salon.id),
    [client] = await tx
      .select()
      .from(S.clients)
      .where(t.where(S.clients, eq(S.clients.id, task.clientId)));
  if (!client) throw new Error("Clienta no disponible.");
  const marketing = ["maintenance", "reactivation", "birthday"].includes(
    task.kind,
  );
  if (marketing && !client.marketingConsent)
    throw new Error("La clienta no autorizó comunicaciones comerciales.");
  let data: WhatsAppData = {
    nombre: client.name,
    salon: salon.name,
    servicio: "",
    fecha: "",
    hora: "",
    profesional: "",
    codigo: "",
    enlace_reprogramar: `${publicOrigin()}/${salon.slug}/reservar`,
    enlace: `${publicOrigin()}/${salon.slug}/reservar`,
  };
  if (task.appointmentId) {
    const [appointment] = await tx
      .select()
      .from(S.appointments)
      .where(t.where(S.appointments, eq(S.appointments.id, task.appointmentId)))
      .for("update");
    if (
      !appointment ||
      ["cancelled", "no_show"].includes(appointment.status) ||
      (task.appointmentVersion !== null &&
        task.appointmentVersion !== appointment.version)
    )
      throw new Error("La cita cambió. Actualiza los pendientes.");
    if (task.kind === "thanks" && appointment.status !== "completed")
      throw new Error("Completa primero la cita.");
    if (
      ["confirmation", "reminder24"].includes(task.kind) &&
      (appointment.status !== "confirmed" || +appointment.endsAt < Date.now())
    )
      throw new Error("Esta cita ya no puede confirmarse ni recordarse.");
    const [professional] = await tx
      .select()
      .from(S.staff)
      .where(t.where(S.staff, eq(S.staff.id, appointment.staffId)));
    const services = await tx
      .select()
      .from(S.appointmentServices)
      .where(
        t.where(
          S.appointmentServices,
          eq(S.appointmentServices.appointmentId, appointment.id),
          task.serviceId
            ? eq(S.appointmentServices.serviceId, task.serviceId)
            : undefined,
        ),
      );
    data = appointmentWhatsAppData(
      salon,
      appointment,
      services.map((s) => s.name),
      professional?.name ?? "Tu profesional",
    );
    if (marketing) {
      data.enlace_reprogramar = `${publicOrigin()}/${salon.slug}/reservar`;
      data.enlace = data.enlace_reprogramar;
    }
    if (task.kind === "confirmation")
      await tx
        .update(S.appointments)
        .set({ ownerConfirmedAt: new Date() })
        .where(t.where(S.appointments, eq(S.appointments.id, appointment.id)));
  }
  return sendWhatsApp(
    client.phone,
    { ...defaultWhatsAppMessages, ...salon.settings.whatsappMessages }[
      task.kind
    ],
    data,
  ).url;
}
