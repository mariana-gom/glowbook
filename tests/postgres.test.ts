import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
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
    } finally {
      await pool.end();
    }
  },
);
