import { database } from "@/db";
import { tenant } from "@/db/tenant";
import { scheduledMessages } from "@/db/schema";
import { desc } from "drizzle-orm";
import { panelData } from "@/lib/panel-data";
import { defaultWhatsAppMessages, whatsappLabels } from "@/lib/whatsapp";
import { ActionForm } from "@/components/action-form";
import { clock, prettyDate } from "@/lib/utils";
export default async function Messages() {
  const d = await panelData(true);
  let rows: (typeof scheduledMessages.$inferSelect)[] = [];
  if (!d.demo) {
    const { db, close } = database();
    try {
      rows = await db
        .select()
        .from(scheduledMessages)
        .where(tenant(d.salon.id).where(scheduledMessages))
        .orderBy(desc(scheduledMessages.scheduledAt))
        .limit(100);
    } finally {
      await close();
    }
  }
  return (
    <>
      <p className="eyebrow text-primary">TU VOZ, EN CADA DETALLE</p>
      <h1 className="text-4xl">Mensajes sin complicaciones.</h1>
      <p className="mb-6 text-sm muted">
        WhatsApp abre un chat con el texto preparado. Solo los correos y las
        notificaciones push se envían automáticamente.
      </p>
      <section className="card mb-6 p-6">
        <h2 className="text-2xl">Plantillas de tu salón</h2>
        <p className="mb-6 rounded-xl bg-muted p-4 text-xs">
          Variables: {"{nombre}"}, {"{servicio}"}, {"{fecha}"}, {"{hora}"},{" "}
          {"{profesional}"}, {"{codigo}"}, {"{enlace_reprogramar}"}. También
          puedes usar {"{salon}"} y el alias {"{enlace}"}. El enlace de
          agradecimiento permite dejar una reseña.
        </p>
        <ActionForm kind="messages">
          <h3 className="serif text-2xl">WhatsApp · envío manual</h3>
          {(
            Object.keys(
              defaultWhatsAppMessages,
            ) as (keyof typeof defaultWhatsAppMessages)[]
          ).map((key) => (
            <label key={key}>
              {whatsappLabels[key]}
              <textarea
                name={`wa-${key}`}
                defaultValue={
                  {
                    ...defaultWhatsAppMessages,
                    ...d.salon.settings.whatsappMessages,
                  }[key]
                }
                maxLength={1500}
                required
              />
            </label>
          ))}
          <h3 className="serif pt-6 text-2xl">
            Correos automáticos a tus clientas
          </h3>
          {(
            [
              ["confirmation", "Confirmación de reserva"],
              ["reminder24", "Recordatorio del día anterior"],
              ["thanks", "Agradecimiento y reseña"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea
                name={key}
                defaultValue={d.salon.settings.messages[key]}
                maxLength={1500}
                required
              />
            </label>
          ))}
          <p className="text-xs muted">
            Los cambios de WhatsApp aplican al próximo toque. Los correos que ya
            están en cola conservan su texto. El resumen diario sale en el lote
            de las 07:00, hora de Colombia.
          </p>
        </ActionForm>
      </section>
      <section className="card overflow-hidden">
        <div className="p-6">
          <h2 className="text-2xl">Cola automática</h2>
          <p className="mb-0 text-xs muted">
            Últimos 100 correos y notificaciones. “Enviado” significa aceptación
            por el proveedor, no lectura. Los casos inciertos requieren
            revisión.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Programado</th>
                <th>Mensaje</th>
                <th>Canal</th>
                <th>Estado</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs">
                    {prettyDate(r.scheduledAt)}
                    <br />
                    {clock(r.scheduledAt)}
                  </td>
                  <td className="text-xs">
                    {r.kind}
                    <br />
                    <span className="muted">{r.payload.name}</span>
                  </td>
                  <td>{r.channel}</td>
                  <td className="text-xs">
                    {r.status} · {r.attempts} intentos
                  </td>
                  <td className="max-w-72 text-xs muted">
                    {r.lastError}
                    {["uncertain", "failed"].includes(r.status) && (
                      <ActionForm
                        kind="message-resolve"
                        id={r.id}
                        submit="Guardar revisión"
                        className="mt-3 space-y-2"
                      >
                        <select name="status">
                          <option value="cancelled">Descartar</option>
                          <option value="sent">
                            Aceptado por el proveedor (verificado)
                          </option>
                        </select>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm muted">
                    {d.demo
                      ? "El demo no envía correos ni notificaciones reales."
                      : "Los avisos aparecerán aquí cuando recibas reservas."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
