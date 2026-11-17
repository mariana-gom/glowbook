import { createHmac } from "node:crypto";
import type { appointments, salons } from "@/db/schema";
import type { WhatsAppData } from "./whatsapp";
import { clock, prettyDate } from "./utils";
export function bookingToken(requestKey: string) {
  if (
    !process.env.BOOKING_TOKEN_SECRET ||
    process.env.BOOKING_TOKEN_SECRET.length < 32
  )
    throw new Error("Configura BOOKING_TOKEN_SECRET.");
  return createHmac("sha256", process.env.BOOKING_TOKEN_SECRET)
    .update(requestKey)
    .digest("hex");
}
export function publicOrigin() {
  const url = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3100");
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("URL pública inválida.");
  return url.origin;
}
export function appointmentWhatsAppData(
  salon: Pick<typeof salons.$inferSelect, "name" | "slug">,
  appointment: typeof appointments.$inferSelect,
  services: string[],
  professional: string,
  token?: string,
): WhatsAppData {
  const url = `${publicOrigin()}/gestionar/${token ?? bookingToken(appointment.requestKey)}`;
  return {
    nombre: appointment.contact.name,
    servicio: services.join(" + "),
    fecha: prettyDate(appointment.startsAt),
    hora: clock(appointment.startsAt),
    profesional: professional,
    codigo: appointment.id.slice(0, 8).toUpperCase(),
    enlace_reprogramar: url,
    enlace: url,
    salon: salon.name,
  };
}
