import type { WhatsAppTemplateKey } from "@/db/schema";

export const whatsappVariables = [
  "nombre",
  "servicio",
  "fecha",
  "hora",
  "profesional",
  "codigo",
  "enlace_reprogramar",
  "salon",
  "enlace",
] as const;
export type WhatsAppData = Partial<
  Record<(typeof whatsappVariables)[number], string>
>;
export const whatsappLabels: Record<WhatsAppTemplateKey, string> = {
  clientConfirmation: "Confirmación de la clienta al salón",
  confirmation: "Confirmar",
  reminder24: "Recordar",
  thanks: "Agradecer y pedir reseña",
  maintenance: "Mantenimiento",
  reactivation: "Reactivación",
  birthday: "Cumpleaños",
};
export const defaultWhatsAppMessages: Record<WhatsAppTemplateKey, string> = {
  clientConfirmation:
    "Hola, soy {nombre}. Quiero confirmar mi cita {codigo}: {servicio}, el {fecha} a las {hora}, con {profesional}. Mi enlace de gestión: {enlace_reprogramar}",
  confirmation:
    "¡Hola, {nombre}! Te confirmamos tu cita {codigo} en {salon}: {servicio}, el {fecha} a las {hora}, con {profesional}. Cambios: {enlace_reprogramar}",
  reminder24:
    "Hola, {nombre}. Te esperamos en {salon} el {fecha} a las {hora} para {servicio}, con {profesional}. Cita {codigo}. Si necesitas cambiarla: {enlace_reprogramar}",
  thanks:
    "Gracias por visitarnos, {nombre}. Nos encantó atenderte en {salon}. Cuéntanos cómo estuvo tu experiencia: {enlace_reprogramar}",
  maintenance:
    "Hola, {nombre}. Es momento de renovar tu {servicio}. ¿Te agendamos en {salon}? Reserva aquí: {enlace_reprogramar}",
  reactivation:
    "¡Te extrañamos, {nombre}! Queremos volver a consentirte en {salon}. Encuentra tu próximo espacio: {enlace_reprogramar}",
  birthday:
    "¡Feliz cumpleaños, {nombre}! Te deseamos un día lleno de momentos bonitos. Con cariño, {salon}. {enlace_reprogramar}",
};
export function normalizeColombianPhone(phone: string) {
  if (!/^[+\d\s().-]+$/.test(phone))
    throw new Error("El número de WhatsApp no es válido.");
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = `57${digits}`;
  if (!/^57[1-9]\d{9}$/.test(digits))
    throw new Error("Usa un número colombiano de diez dígitos, con o sin 57.");
  return digits;
}
export function renderMessage(template: string, data: WhatsAppData) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(data, key)
      ? (data[key as keyof WhatsAppData] ?? match)
      : match,
  );
}
export function validateTemplate(template: string) {
  return [...template.matchAll(/\{(\w+)\}/g)].every((match) =>
    whatsappVariables.includes(match[1] as (typeof whatsappVariables)[number]),
  );
}
export function buildWhatsAppLink(
  phone: string,
  template: string,
  data: WhatsAppData,
) {
  return `https://wa.me/${normalizeColombianPhone(phone)}?text=${encodeURIComponent(renderMessage(template, data))}`;
}
