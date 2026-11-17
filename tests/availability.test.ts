import { test } from "node:test";
import assert from "node:assert/strict";
import { availableSlots } from "../src/lib/availability";
import { bogotaDate, dayKey } from "../src/lib/utils";
import { demoData } from "../src/lib/demo";
const base = {
  day: "2026-11-18",
  staffIds: ["a"],
  duration: 60,
  cleanup: 15,
  hours: [{ staffId: "a", weekday: 3, startMinute: 540, endMinute: 720 }],
  busy: [],
  timeOff: [],
  noticeHours: 0,
  bookingDays: 45,
  now: new Date("2026-11-17T12:00:00Z"),
};
test("incluye limpieza y permite citas contiguas sin solaparse", () => {
  const slots = availableSlots({
    ...base,
    busy: [
      {
        staffId: "a",
        startsAt: new Date(bogotaDate(base.day, 540)),
        busyUntil: new Date(bogotaDate(base.day, 615)),
        status: "confirmed",
      },
    ],
  });
  assert.equal(slots[0]?.label, "10:15");
  assert.equal(slots.at(-1)?.label, "10:45");
});
test("una cita cancelada libera el cupo y las ausencias lo bloquean", () => {
  const busy = [
    {
      staffId: "a",
      startsAt: new Date(bogotaDate(base.day, 540)),
      busyUntil: new Date(bogotaDate(base.day, 720)),
      status: "cancelled",
    },
  ];
  assert.ok(availableSlots({ ...base, busy }).length);
  assert.equal(
    availableSlots({
      ...base,
      busy,
      timeOff: [
        {
          staffId: "a",
          startsAt: new Date(bogotaDate(base.day, 540)),
          endsAt: new Date(bogotaDate(base.day, 720)),
        },
      ],
    }).length,
    0,
  );
});
test("el horario de otra profesional no ocupa el de la seleccionada", () => {
  assert.equal(
    availableSlots({
      ...base,
      busy: [
        {
          staffId: "b",
          startsAt: new Date(bogotaDate(base.day, 540)),
          busyUntil: new Date(bogotaDate(base.day, 720)),
          status: "confirmed",
        },
      ],
    }).length,
    availableSlots(base).length,
  );
});
test("respeta anticipación mínima y horizonte de reserva", () => {
  assert.equal(availableSlots({ ...base, noticeHours: 72 }).length, 0);
  assert.equal(availableSlots({ ...base, day: "2027-04-01" }).length, 0);
  assert.equal(availableSlots({ ...base, day: "2026-11-15" }).length, 0);
});
test("fecha colombiana es correcta cerca de medianoche UTC", () => {
  assert.equal(dayKey(new Date("2026-11-18T02:00:00Z")), "2026-11-17");
  assert.equal(
    new Date(bogotaDate("2026-11-18", 540)).toISOString(),
    "2026-11-18T14:00:00.000Z",
  );
});
test("el seed cumple volúmenes, asignaciones y no cruza horarios", () => {
  const d = demoData(new Date("2026-11-17T15:00:00Z"));
  assert.equal(d.services.length, 25);
  assert.equal(d.staff.length, 3);
  assert.equal(d.clients.length, 100);
  assert.ok(d.appointments.length > 300);
  for (const a of d.appointments) {
    const other = d.appointments.find(
      (b) =>
        a.id !== b.id &&
        b.staffId === a.staffId &&
        !["cancelled", "no_show"].includes(b.status) &&
        !["cancelled", "no_show"].includes(a.status) &&
        +a.startsAt < +b.busyUntil &&
        +a.busyUntil > +b.startsAt,
    );
    assert.equal(other, undefined);
  }
});
