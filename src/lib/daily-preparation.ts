import type { Transaction } from "@/db";
import { dailyRuns, type salons } from "@/db/schema";
import { prepareFollowUps } from "./follow-ups";
import { enqueueDailyDigest } from "./notification-builders";
import { dayKey } from "./utils";
// Debe ejecutarse dentro de una transacción: si falla, no queda un día marcado como preparado.
export async function prepareDailySalon(
  tx: Transaction,
  salon: typeof salons.$inferSelect,
  now: Date,
) {
  const [run] = await tx
    .insert(dailyRuns)
    .values({ salonId: salon.id, day: dayKey(now) })
    .onConflictDoNothing()
    .returning();
  if (!run) return { prepared: false, tasks: 0 };
  const tasks = await prepareFollowUps(tx, salon, now);
  await enqueueDailyDigest(tx, salon, dayKey(now));
  return { prepared: true, tasks };
}
