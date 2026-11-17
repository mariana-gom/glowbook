import type * as S from "@/db/schema";
import { dayKey } from "./utils";
export type TaskPlan = Pick<
  typeof S.followUpTasks.$inferInsert,
  | "salonId"
  | "clientId"
  | "appointmentId"
  | "appointmentVersion"
  | "serviceId"
  | "kind"
  | "dedupeKey"
  | "dueOn"
>;
export type LatestVisit = {
  clientId: string;
  appointmentId: string;
  endsAt: Date;
};
export type LatestService = LatestVisit & {
  serviceId: string;
  maintenanceDays: number;
};
export function appointmentTasks(
  a: typeof S.appointments.$inferSelect,
  now = new Date(),
): TaskPlan[] {
  const base = {
    salonId: a.salonId,
    clientId: a.clientId,
    appointmentId: a.id,
    appointmentVersion: a.version,
  };
  if (a.status === "completed")
    return [
      {
        ...base,
        kind: "thanks",
        dedupeKey: `${a.id}:${a.version}:thanks`,
        dueOn: dayKey(a.endsAt),
      },
    ];
  if (a.status !== "confirmed" || +a.endsAt <= +now) return [];
  return [
    ...(!a.ownerConfirmedAt
      ? [
          {
            ...base,
            kind: "confirmation" as const,
            dedupeKey: `${a.id}:${a.version}:confirmation`,
            dueOn: dayKey(now),
          },
        ]
      : []),
    {
      ...base,
      kind: "reminder24",
      dedupeKey: `${a.id}:${a.version}:reminder24`,
      dueOn: dayKey(a.startsAt),
    },
  ];
}
export function planDailyTasks(input: {
  salonId: string;
  now: Date;
  reactivationDays: number;
  clients: (typeof S.clients.$inferSelect)[];
  upcoming: (typeof S.appointments.$inferSelect)[];
  recentCompleted: (typeof S.appointments.$inferSelect)[];
  lastVisits: LatestVisit[];
  lastServices: LatestService[];
}): TaskPlan[] {
  const today = dayKey(input.now),
    hasBooking = new Set(
      input.upcoming
        .filter((a) => a.status === "confirmed" && +a.endsAt > +input.now)
        .map((a) => a.clientId),
    );
  const rows = [...input.upcoming, ...input.recentCompleted].flatMap((a) =>
    appointmentTasks(a, input.now),
  );
  const allowed = new Set(
    input.clients.filter((c) => c.marketingConsent).map((c) => c.id),
  );
  for (const service of input.lastServices) {
    if (!allowed.has(service.clientId) || hasBooking.has(service.clientId))
      continue;
    const dueOn = dayKey(
      new Date(+service.endsAt + service.maintenanceDays * 86400000),
    );
    if (dueOn <= today)
      rows.push({
        salonId: input.salonId,
        clientId: service.clientId,
        appointmentId: service.appointmentId,
        serviceId: service.serviceId,
        kind: "maintenance",
        dedupeKey: `maintenance:${service.appointmentId}:${service.serviceId}`,
        dueOn,
      });
  }
  for (const visit of input.lastVisits) {
    const dueOn = dayKey(
      new Date(+visit.endsAt + input.reactivationDays * 86400000),
    );
    if (
      allowed.has(visit.clientId) &&
      !hasBooking.has(visit.clientId) &&
      dueOn <= today
    )
      rows.push({
        salonId: input.salonId,
        clientId: visit.clientId,
        appointmentId: visit.appointmentId,
        kind: "reactivation",
        dedupeKey: `reactivation:${visit.clientId}:${visit.appointmentId}`,
        dueOn,
      });
  }
  for (const client of input.clients) {
    if (client.marketingConsent && client.birthday?.slice(5) === today.slice(5))
      rows.push({
        salonId: input.salonId,
        clientId: client.id,
        kind: "birthday",
        dedupeKey: `birthday:${client.id}:${today.slice(0, 4)}`,
        dueOn: today,
      });
  }
  return rows;
}
