import { sendWhatsApp } from "../src/lib/whatsapp-delivery";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import {
  buildWhatsAppLink,
  renderMessage,
  validateTemplate,
} from "../src/lib/whatsapp";
import { isPushEndpoint, pushSubscriptionSchema } from "../src/lib/push";
import { demoData } from "../src/lib/demo";
import { appointmentTasks, planDailyTasks } from "../src/lib/follow-up-plan";
import { buildMessages } from "../src/lib/notification-builders";
import { dayKey } from "../src/lib/utils";

test("wa.me normaliza Colombia y codifica texto, saltos y variables sin reinterpretar sus valores", async () => {
  const url = new URL(
    buildWhatsAppLink(
      "+57 (300) 123-4567",
      "Hola {nombre}\n{servicio} · {fecha} {hora} · {profesional} · {codigo} · {enlace_reprogramar}",
      {
        nombre: "María & Ana {hora}",
        servicio: "Mani + Pedi",
        fecha: "20 de noviembre",
        hora: "10:30",
        profesional: "Valentina",
        codigo: "ABC123",
        enlace_reprogramar: "https://example.invalid/gestionar/abc?x=1&y=2",
      },
    ),
  );
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/573001234567");
  assert.ok(url.search.includes("%26"));
  assert.ok(
    url.searchParams.get("text")?.includes("María & Ana {hora}\nMani + Pedi"),
  );
  assert.ok(url.searchParams.get("text")?.includes("?x=1&y=2"));
  assert.equal(
    (
      await sendWhatsApp({
        phone: "3001234567",
        template: "Hola {nombre}",
        data: { nombre: "Laura" },
        messageId: "test-message",
      })
    ).mode,
    "link",
  );
});
test("rechaza números inválidos y detecta variables desconocidas", () => {
  for (const phone of ["+15551234567", "javascript:3001234567", "123", ""])
    assert.throws(() => buildWhatsAppLink(phone, "Hola", {}));
  assert.equal(
    validateTemplate(
      "{nombre} {servicio} {fecha} {hora} {profesional} {codigo} {enlace_reprogramar}",
    ),
    true,
  );
  assert.equal(validateTemplate("{contrasena}"), false);
  assert.equal(
    renderMessage("Hola {nombre}", { nombre: "{codigo}" }),
    "Hola {codigo}",
  );
});
test("cada cita obtiene claves de pendientes por versión; las canceladas no generan tareas", () => {
  const d = demoData(),
    base = {
      ...d.appointments[0],
      status: "confirmed" as const,
      ownerConfirmedAt: null,
      startsAt: new Date(Date.now() + 86400000),
      endsAt: new Date(Date.now() + 90000000),
    };
  assert.deepEqual(
    appointmentTasks(base).map((t) => t.kind),
    ["confirmation", "reminder24"],
  );
  assert.equal(
    appointmentTasks({ ...base, version: 2 })[0].dedupeKey,
    `${base.id}:2:confirmation`,
  );
  assert.equal(appointmentTasks({ ...base, status: "cancelled" }).length, 0);
  assert.deepEqual(
    appointmentTasks({ ...base, status: "completed" }).map((t) => t.kind),
    ["thanks"],
  );
});
test("mantenimiento, reactivación y cumpleaños exigen consentimiento; una reserva futura frena la captación", () => {
  const now = new Date("2026-11-17T12:00:00Z"),
    d = demoData(now),
    client = {
      ...d.clients[0],
      marketingConsent: true,
      birthday: "1990-11-17",
    },
    visit = {
      clientId: client.id,
      appointmentId: d.appointments[0].id,
      endsAt: new Date("2026-08-01T17:00:00Z"),
    };
  const input = {
    salonId: d.salon.id,
    now,
    reactivationDays: 60,
    clients: [client],
    upcoming: [],
    recentCompleted: [],
    lastVisits: [visit],
    lastServices: [
      { ...visit, serviceId: d.services[1].id, maintenanceDays: 21 },
    ],
  };
  const first = planDailyTasks(input);
  assert.deepEqual(
    first.map((t) => t.kind),
    ["maintenance", "reactivation", "birthday"],
  );
  assert.deepEqual(
    first.map((t) => t.dedupeKey),
    planDailyTasks(input).map((t) => t.dedupeKey),
  );
  assert.equal(
    planDailyTasks({
      ...input,
      clients: [{ ...client, marketingConsent: false }],
    }).length,
    0,
  );
  const a = {
    ...d.appointments[0],
    clientId: client.id,
    status: "confirmed" as const,
    ownerConfirmedAt: null,
    startsAt: new Date("2026-11-18T15:00:00Z"),
    endsAt: new Date("2026-11-18T16:00:00Z"),
  };
  assert.deepEqual(
    planDailyTasks({ ...input, upcoming: [a] }).map((t) => t.kind),
    ["confirmation", "reminder24", "birthday"],
  );
  assert.equal(
    planDailyTasks({ ...input, now: new Date("2026-11-18T02:00:00Z") }).some(
      (t) => t.kind === "birthday",
    ),
    true,
    "El cumpleaños usa el día colombiano, no UTC.",
  );
});
test("la cola de clientas contiene solo email y mantiene claves estables al reintentar", () => {
  const d = demoData(),
    start = new Date(Date.now() + 4 * 86400000),
    a = {
      ...d.appointments[0],
      status: "confirmed" as const,
      startsAt: start,
      endsAt: new Date(+start + 3600000),
    };
  const first = buildMessages(
      d.salon,
      a,
      d.clients[0],
      "private-test-token",
      ["Manicure"],
      "Vale",
    ),
    second = buildMessages(
      d.salon,
      a,
      d.clients[0],
      "private-test-token",
      ["Manicure"],
      "Vale",
    );
  assert.ok(first.every((m) => m.channel === "email"));
  assert.deepEqual(
    first.map((m) => m.dedupeKey),
    second.map((m) => m.dedupeKey),
  );
  assert.ok(first.some((m) => m.kind === "reminder24"));
  assert.ok(first.every((m) => m.appointmentVersion === a.version));
  assert.equal(
    dayKey(first.find((m) => m.kind === "reminder24")!.scheduledAt),
    dayKey(new Date(+start - 86400000)),
  );
  assert.ok(
    !buildMessages(
      d.salon,
      { ...a, startsAt: new Date(Date.now() + 3600000) },
      d.clients[0],
      "token",
    ).some((m) => m.kind === "reminder24"),
  );
  assert.equal(
    buildMessages(
      { ...d.salon, settings: { ...d.salon.settings, emailEnabled: false } },
      a,
      d.clients[0],
      "token",
    ).length,
    0,
  );
});
test("las suscripciones push no pueden apuntar a localhost ni a servidores arbitrarios", () => {
  for (const endpoint of [
    "http://localhost:3000",
    "https://127.0.0.1",
    "https://example.com",
    "https://fcm.googleapis.com.evil.test/x",
    "https://fcm.googleapis.com:8443/x",
    "https://user:pass@fcm.googleapis.com/x",
  ])
    assert.equal(isPushEndpoint(endpoint), false);
  for (const endpoint of [
    "https://fcm.googleapis.com/fcm/send/test",
    "https://updates.push.services.mozilla.com/wpush/v2/test",
    "https://web.push.apple.com/test",
  ])
    assert.equal(isPushEndpoint(endpoint), true);
  assert.equal(
    pushSubscriptionSchema.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/test",
      keys: {
        p256dh: Buffer.alloc(65).toString("base64url"),
        auth: Buffer.alloc(16).toString("base64url"),
      },
    }).success,
    true,
  );
});
test("el generador VAPID escribe un archivo privado sin imprimir claves y se niega a rotarlas", async () => {
  const directory = await mkdtemp(join(tmpdir(), "glowbook-vapid-"));
  try {
    await writeFile(
      join(directory, ".env.local"),
      "NEXT_PUBLIC_VAPID_PUBLIC_KEY=\nVAPID_PRIVATE_KEY=\nVAPID_SUBJECT=mailto:test@example.invalid\n",
    );
    const output = execFileSync(
      resolve("node_modules/.bin/tsx"),
      [resolve("scripts/generate-vapid.ts")],
      { cwd: directory, encoding: "utf8" },
    );
    const content = await readFile(join(directory, ".env.local"), "utf8"),
      key = content.match(/^VAPID_PRIVATE_KEY=(.+)$/m)?.[1];
    assert.ok(key);
    assert.equal(output.includes(key), false);
    assert.equal(
      (await stat(join(directory, ".env.local"))).mode & 0o777,
      0o600,
    );
    assert.throws(() =>
      execFileSync(
        resolve("node_modules/.bin/tsx"),
        [resolve("scripts/generate-vapid.ts")],
        { cwd: directory, stdio: "pipe" },
      ),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
