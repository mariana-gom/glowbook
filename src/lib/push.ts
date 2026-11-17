import { sendNotification } from "web-push";
import { z } from "zod";

// Impide usar el registro de suscripciones como proxy hacia direcciones arbitrarias.
export function isPushEndpoint(value: string) {
  try {
    const u = new URL(value);
    const h = u.hostname;
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443") &&
      (h === "fcm.googleapis.com" ||
        h === "updates.push.services.mozilla.com" ||
        h === "web.push.apple.com" ||
        h.endsWith(".push.apple.com") ||
        h.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2000).refine(isPushEndpoint),
  keys: z.object({
    p256dh: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .refine((v) => Buffer.from(v, "base64url").length === 65),
    auth: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .refine((v) => Buffer.from(v, "base64url").length === 16),
  }),
});
export function pushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT,
  );
}
export async function sendPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  input: { title: string; body: string; url: string; tag: string },
) {
  if (!pushConfigured())
    throw new Error("Configura las claves VAPID y su contacto.");
  // VAPID pertenece al servidor de la PWA, no a una cuenta de WhatsApp.
  await sendNotification(subscription, JSON.stringify(input), {
    TTL: 24 * 3600,
    timeout: 12000,
    vapidDetails: {
      subject: process.env.VAPID_SUBJECT!,
      publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      privateKey: process.env.VAPID_PRIVATE_KEY!,
    },
  });
  return "web-push-accepted";
}
