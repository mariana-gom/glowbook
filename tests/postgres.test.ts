import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { prepareDailySalon } from "../src/lib/daily-preparation";
import type { Transaction } from "../src/db";
import {
  ensureAppointmentTasks,
  prepareFollowUps,
  taskWhatsApp,
} from "../src/lib/follow-ups";
import {
  enqueueTeamNotifications,
  enqueueDailyDigest,
} from "../src/lib/notification-builders";
import { dayKey } from "../src/lib/utils";
import { eq } from "drizzle-orm";
import * as S from "../src/db/schema";
import { demoData } from "../src/lib/demo";
const url = process.env.TEST_DATABASE_URL;
test(
  "PostgreSQL real: migraciones, aislamiento, concurrencia e idempotencia",
  { skip: !url },
  async (t) => {
    const parsed = new URL(url!);
    assert.ok(
      parsed.pathname.endsWith("glowbook_test"),
      "Solo se ejecuta en una base aislada terminada en glowbook_test.",
    );
    const pool = new Pool({ connectionString: url }),
      db = drizzle(pool);
    try {
      const count = await pool.query(
        "select count(*) from information_schema.tables where table_schema='public'",
      );
      assert.equal(
        Number(count.rows[0].count),
        0,
        "La base de prueba debe estar vacía. No se borra ninguna tabla automáticamente.",
      );
      const journal = JSON.parse(
        await readFile("drizzle/meta/_journal.json", "utf8"),
      );
      for (const entry of journal.entries) {
        const script = await readFile(`drizzle/${entry.tag}.sql`, "utf8");
        await pool.query(script);
      }
      const d = demoData();
      await db.insert(S.salons).values(d.salon);
      await db.insert(S.serviceCategories).values(d.categories);
      await db.insert(S.services).values(d.services);
      await db.insert(S.staff).values(d.staff);
      await db.insert(S.staffServices).values(d.staffServices);
      await db.insert(S.workingHours).values(d.hours);
      await db.insert(S.clients).values(d.clients);
      await db.insert(S.appointments).values(d.appointments);
      await db.insert(S.appointmentServices).values(d.appointmentServices);
      await db.insert(S.reviews).values(d.reviews);
      const template = {
        salonId: d.salon.id,
        staffId: d.staff[0].id,
        clientId: d.clients[0].id,
        contact: {
          name: "Prueba",
          email: "test@example.invalid",
          phone: "+573000000000",
        },
        total: 50000,
        status: "confirmed" as const,
      };
      const values = (key: string, start = "2050-01-01T14:00:00Z") => ({
        ...template,
        startsAt: new Date(start),
        endsAt: new Date(+new Date(start) + 60 * 60000),
        busyUntil: new Date(+new Date(start) + 75 * 60000),
        requestKey: key,
        tokenHash: key,
      });
      await t.test("la migración permite cargar todo el seed", async () => {
        const result = await pool.query("select count(*) from appointments");
        assert.equal(Number(result.rows[0].count), d.appointments.length);
      });
      await t.test(
        "rechaza solapamientos incluso al omitir la aplicación",
        async () => {
          await db.insert(S.appointments).values(values("first"));
          await assert.rejects(
            db
              .insert(S.appointments)
              .values(values("overlap", "2050-01-01T15:00:00Z")),
            (e) => (e as { cause?: { code?: string } }).cause?.code === "23P01",
          );
        },
      );
      await t.test(
        "permite iniciar exactamente al terminar la limpieza",
        async () => {
          await db
            .insert(S.appointments)
            .values(values("contiguous", "2050-01-01T15:15:00Z"));
        },
      );
      await t.test("impide citas con clientas de otro salón", async () => {
        const [other] = await db
          .insert(S.salons)
          .values({
            name: "Segundo salón",
            slug: "segundo",
            settings: d.salon.settings,
          })
          .returning();
        await assert.rejects(
          db.insert(S.appointments).values({
            ...values("cross-salon", "2050-02-01T14:00:00Z"),
            salonId: other.id,
          }),
          (e) => (e as { cause?: { code?: string } }).cause?.code === "23503",
        );
      });
      await t.test(
        "idempotencia: el requestKey no se puede repetir",
        async () => {
          await assert.rejects(
            db.insert(S.appointments).values({
              ...values("first", "2050-03-01T14:00:00Z"),
              tokenHash: "another-token",
            }),
            (e) => (e as { cause?: { code?: string } }).cause?.code === "23505",
          );
        },
      );
      await t.test(
        "dos escrituras concurrentes solo consiguen un cupo",
        async () => {
          const a = values("race-a", "2050-04-01T14:00:00Z"),
            b = values("race-b", "2050-04-01T14:00:00Z");
          const results = await Promise.allSettled([
            db.insert(S.appointments).values(a),
            db.insert(S.appointments).values(b),
          ]);
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert.equal(
            results.filter((r) => r.status === "rejected").length,
            1,
          );
        },
      );
      await t.test(
        "rollback atómico cuando falla una cita de la transacción",
        async () => {
          await assert.rejects(
            db.transaction(async (tx) => {
              await tx
                .insert(S.appointments)
                .values(values("rollback-first", "2050-05-01T14:00:00Z"));
              await tx
                .insert(S.appointments)
                .values(values("rollback-second", "2050-05-01T14:15:00Z"));
            }),
          );
          const rows = await db
            .select()
            .from(S.appointments)
            .where(eq(S.appointments.requestKey, "rollback-first"));
          assert.equal(rows.length, 0);
        },
      );
      await t.test("una cancelación libera el intervalo", async () => {
        await db
          .update(S.appointments)
          .set({ status: "cancelled" })
          .where(eq(S.appointments.requestKey, "first"));
        await db.insert(S.appointments).values(values("reused"));
      });
      await t.test(
        "la cola solo admite una clave de deduplicación por salón",
        async () => {
          const message = {
            salonId: d.salon.id,
            clientId: d.clients[0].id,
            kind: "confirmation" as const,
            channel: "email" as const,
            dedupeKey: "one-message",
            scheduledAt: new Date(),
            payload: {
              name: "Prueba",
              email: "test@example.invalid",
              phone: "+573000000000",
              salon: "Demo",
              text: "Prueba",
              managementUrl: "https://example.invalid",
            },
          };
          await db.insert(S.scheduledMessages).values(message);
          await assert.rejects(
            db.insert(S.scheduledMessages).values(message),
            (e) => (e as { cause?: { code?: string } }).cause?.code === "23505",
          );
        },
      );

      await t.test(
        "prepara tareas y resúmenes sin duplicarlos; push solo a dueña y profesional asignada",
        async () => {
          const ownerId = "test-owner",
            staffId = "test-staff",
            otherId = "test-other-staff";
          await db.insert(S.users).values([
            { id: ownerId, name: "Dueña", email: "owner@example.invalid" },
            {
              id: staffId,
              name: "Profesional",
              email: "staff@example.invalid",
            },
            {
              id: otherId,
              name: "Otra profesional",
              email: "other@example.invalid",
            },
          ]);
          await db.insert(S.memberships).values([
            { salonId: d.salon.id, userId: ownerId, role: "owner" },
            { salonId: d.salon.id, userId: staffId, role: "staff" },
            { salonId: d.salon.id, userId: otherId, role: "staff" },
          ]);
          await db
            .update(S.staff)
            .set({ userId: staffId })
            .where(eq(S.staff.id, d.staff[0].id));
          await db
            .update(S.staff)
            .set({ userId: otherId })
            .where(eq(S.staff.id, d.staff[1].id));
          await db.insert(S.pushSubscriptions).values(
            [ownerId, staffId, otherId].map((userId) => ({
              salonId: d.salon.id,
              userId,
              endpoint: `https://fcm.googleapis.com/fcm/send/${userId}`,
              keys: { p256dh: "test-key", auth: "test-auth" },
            })),
          );
          const [a] = await db
            .select()
            .from(S.appointments)
            .where(eq(S.appointments.requestKey, "reused"));
          for (let i = 0; i < 2; i++)
            await db.transaction(async (tx) => {
              const production = tx as unknown as Transaction;
              await ensureAppointmentTasks(production, a);
              await enqueueTeamNotifications(production, d.salon, a, "created");
              await enqueueDailyDigest(production, d.salon, dayKey());
              await prepareFollowUps(production, d.salon, new Date());
            });
          const tasks = await db.select().from(S.followUpTasks);
          assert.equal(
            new Set(tasks.map((t) => t.dedupeKey)).size,
            tasks.length,
          );
          const queue = await db.select().from(S.scheduledMessages);
          const pushed = queue.filter((m) => m.channel === "push");
          assert.equal(pushed.length, 2);
          assert.deepEqual(
            pushed.map((m) => m.userId).sort(),
            [ownerId, staffId].sort(),
          );
          assert.ok(
            pushed.every((m) => !m.payload.text.includes(a.contact.name)),
          );
          assert.equal(
            queue.filter((m) => m.kind === "owner_new" && m.channel === "email")
              .length,
            1,
          );
          assert.equal(
            queue.filter((m) => m.kind === "daily_digest").length,
            1,
          );
          assert.ok(!queue.some((m) => m.channel === "whatsapp"));
          await assert.rejects(
            db.insert(S.dailyRuns).values([
              { salonId: d.salon.id, day: dayKey() },
              { salonId: d.salon.id, day: dayKey() },
            ]),
          );
        },
      );
      await t.test(
        "el helper de WhatsApp produce un enlace y la confirmación queda en la base sin llamar proveedores",
        async () => {
          const previous = process.env.BOOKING_TOKEN_SECRET;
          process.env.BOOKING_TOKEN_SECRET =
            "glowbook-test-secret-not-for-production-1234";
          try {
            const [a] = await db
              .select()
              .from(S.appointments)
              .where(eq(S.appointments.requestKey, "reused"));
            const [task] = await db
              .select()
              .from(S.followUpTasks)
              .where(
                eq(
                  S.followUpTasks.dedupeKey,
                  `${a.id}:${a.version}:confirmation`,
                ),
              );
            assert.ok(task);
            const delivery = await db.transaction((tx) =>
              taskWhatsApp(tx as unknown as Transaction, d.salon, task),
            );
            assert.equal(delivery.mode, "link");
            if (delivery.mode === "link")
              assert.equal(new URL(delivery.url).origin, "https://wa.me");
            const [updated] = await db
              .select()
              .from(S.appointments)
              .where(eq(S.appointments.id, a.id));
            assert.ok(updated.ownerConfirmedAt);
          } finally {
            if (previous === undefined) delete process.env.BOOKING_TOKEN_SECRET;
            else process.env.BOOKING_TOKEN_SECRET = previous;
          }
        },
      );
      await t.test(
        "PostgreSQL impide asociar una suscripción push de otro salón",
        async () => {
          const [other] = await db
            .select()
            .from(S.salons)
            .where(eq(S.salons.slug, "segundo"));
          const [subscription] = await db.select().from(S.pushSubscriptions);
          await assert.rejects(
            db.insert(S.scheduledMessages).values({
              salonId: other.id,
              userId: subscription.userId,
              subscriptionId: subscription.id,
              kind: "owner_new",
              channel: "push",
              dedupeKey: "cross-push",
              scheduledAt: new Date(),
              payload: {
                name: "Test",
                email: "test@example.invalid",
                phone: "",
                salon: "Segundo",
                text: "Test",
                managementUrl: "https://example.invalid/panel",
              },
            }),
            (e) => (e as { cause?: { code?: string } }).cause?.code === "23503",
          );
        },
      );

      await t.test(
        "dos cron concurrentes solo preparan un lote diario por salón",
        async () => {
          const now = new Date(Date.now() + 86400000);
          const results = await Promise.all([
            db.transaction((tx) =>
              prepareDailySalon(tx as unknown as Transaction, d.salon, now),
            ),
            db.transaction((tx) =>
              prepareDailySalon(tx as unknown as Transaction, d.salon, now),
            ),
          ]);
          assert.equal(results.filter((r) => r.prepared).length, 1);
          const rows = await db
            .select()
            .from(S.scheduledMessages)
            .where(
              eq(
                S.scheduledMessages.dedupeKey,
                `digest:${d.salon.id}:${dayKey(now)}:test-owner`,
              ),
            );
          assert.equal(rows.length, 1);
        },
      );
    } finally {
      await pool.end();
    }
  },
);
