import { buildWhatsAppLink, type WhatsAppData } from "./whatsapp";

export type WhatsAppDelivery =
  { mode: "link"; url: string } | { mode: "sent"; providerId: string };
export type WhatsAppCommand = {
  phone: string;
  template: string;
  data: WhatsAppData;
  messageId: string;
};
// Solo lo invoca el servidor. Un proveedor premium futuro conserva este contrato y la clave del mensaje.
export async function sendWhatsApp(
  command: WhatsAppCommand,
): Promise<WhatsAppDelivery> {
  return {
    mode: "link",
    url: buildWhatsAppLink(command.phone, command.template, command.data),
  };
}
