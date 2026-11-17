import { bogotaDate, dayKey } from "./utils";
export type Busy = {
  staffId: string;
  startsAt: Date;
  busyUntil: Date;
  status: string;
};
export type Hours = {
  staffId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
};
export type Slot = { staffId: string; startsAt: string; label: string };
export function availableSlots(input: {
  day: string;
  staffIds: string[];
  duration: number;
  cleanup: number;
  hours: Hours[];
  busy: Busy[];
  timeOff: { staffId: string; startsAt: Date; endsAt: Date }[];
  noticeHours: number;
  bookingDays: number;
  now?: Date;
}): Slot[] {
  const now = input.now ?? new Date();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.day) ||
    input.day < dayKey(now) ||
    input.day > dayKey(new Date(+now + input.bookingDays * 86400000))
  )
    return [];
  const weekday = new Date(bogotaDate(input.day, 720)).getUTCDay();
  const result: Slot[] = [];
  for (const staffId of input.staffIds)
    for (const h of input.hours.filter(
      (h) => h.staffId === staffId && h.weekday === weekday,
    )) {
      for (
        let m = h.startMinute;
        m + input.duration + input.cleanup <= h.endMinute;
        m += 15
      ) {
        const start = bogotaDate(input.day, m),
          end = start + (input.duration + input.cleanup) * 60000;
        if (start < +now + input.noticeHours * 3600000) continue;
        const conflict =
          input.busy.some(
            (a) =>
              a.staffId === staffId &&
              !["cancelled", "no_show"].includes(a.status) &&
              +a.startsAt < end &&
              +a.busyUntil > start,
          ) ||
          input.timeOff.some(
            (a) =>
              a.staffId === staffId && +a.startsAt < end && +a.endsAt > start,
          );
        if (!conflict)
          result.push({
            staffId,
            startsAt: new Date(start).toISOString(),
            label: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
          });
      }
    }
  return result.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
