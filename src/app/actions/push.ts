"use server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { database } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { tenant } from "@/db/tenant";
import { panelAccess } from "@/lib/access";
import { pushConfigured, pushSubscriptionSchema } from "@/lib/push";
export async function subscribePush(input: unknown) {
  const access = await panelAccess();
  if (access.demo)
    return { error: "El demo no registra notificaciones reales." };
  if (!pushConfigured())
    return {
      error: "La administradora todavía no ha habilitado las notificaciones.",
    };
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success)
    return { error: "El navegador no entregó una suscripción válida." };
  const { db, close } = database();
  try {
    await db
      .insert(pushSubscriptions)
      .values({
        salonId: access.salonId,
        userId: access.userId,
        ...parsed.data,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          salonId: access.salonId,
          userId: access.userId,
          keys: parsed.data.keys,
        },
      });
    return { ok: true };
  } catch {
    return {
      error: "No pudimos guardar este dispositivo. Intenta nuevamente.",
    };
  } finally {
    await close();
  }
}
export async function unsubscribePush(endpoint: string) {
  const access = await panelAccess();
  if (access.demo) return { ok: true };
  if (!z.url().max(2000).safeParse(endpoint).success)
    return { error: "Suscripción inválida." };
  const { db, close } = database(),
    t = tenant(access.salonId);
  try {
    await db
      .delete(pushSubscriptions)
      .where(
        t.where(
          pushSubscriptions,
          eq(pushSubscriptions.userId, access.userId),
          eq(pushSubscriptions.endpoint, endpoint),
        ),
      );
    return { ok: true };
  } finally {
    await close();
  }
}
