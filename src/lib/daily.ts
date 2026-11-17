import { sql } from "drizzle-orm";
import { database } from "@/db";
import * as S from "@/db/schema";
import { prepareDailySalon } from "./daily-preparation";
import { processMessages } from "./messages";
import { dayKey } from "./utils";
export async function processDaily(now = new Date()) {
  const { db, close } = database(),
    day = dayKey(now),
    started = Date.now();
  const result = {
    day,
    preparedSalons: 0,
    failedSalons: 0,
    plannedTasks: 0,
    delivered: 0,
    uncertain: 0,
    failedDeliveries: 0,
    remainingSalons: 0,
  };
  const visited: string[] = [];
  try {
    // La fila diaria y toda la preparación se confirman juntas. Dos cron no duplican tareas ni resúmenes.
    while (Date.now() - started < 120000) {
      const batch = await db
        .select()
        .from(S.salons)
        .where(
          sql`${S.salons.active}=true AND NOT EXISTS (SELECT 1 FROM daily_runs r WHERE r.salon_id=${S.salons.id} AND r.day=${day}) ${
            visited.length
              ? sql`AND ${S.salons.id} NOT IN (${sql.join(
                  visited.map((id) => sql`${id}`),
                  sql`, `,
                )})`
              : sql``
          }`,
        )
        .orderBy(S.salons.id)
        .limit(10);
      if (!batch.length) break;
      for (const salon of batch) {
        if (Date.now() - started >= 120000) break;
        visited.push(salon.id);
        try {
          const prepared = await db.transaction((tx) =>
            prepareDailySalon(tx, salon, now),
          );
          if (prepared.prepared) {
            result.preparedSalons++;
            result.plannedTasks += prepared.tasks;
          }
        } catch {
          result.failedSalons++;
          console.error("No se preparó el lote diario de un salón.", salon.id);
        }
      }
    }
    // El tiempo está acotado; una nueva llamada continúa la misma cola sin duplicar correos.
    while (Date.now() - started < 220000) {
      const batch = await processMessages();
      result.delivered += batch.sent;
      result.uncertain += batch.uncertain;
      result.failedDeliveries += batch.failed;
      if (batch.claimed < 4) break;
    }
    const [remaining] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(S.salons)
      .where(
        sql`${S.salons.active}=true AND NOT EXISTS (SELECT 1 FROM daily_runs r WHERE r.salon_id=${S.salons.id} AND r.day=${day})`,
      );
    result.remainingSalons = remaining.count;
    return result;
  } finally {
    await close();
  }
}
