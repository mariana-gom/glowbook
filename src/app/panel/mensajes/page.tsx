import { database } from "@/db";
import { tenant } from "@/db/tenant";
import { scheduledMessages } from "@/db/schema";
import { desc } from "drizzle-orm";
import { panelData } from "@/lib/panel-data";
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
      <p className="eyebrow text-primary">CADA DETALLE, A TIEMPO</p>
      <h1 className="text-4xl">Mensajes con tu voz.</h1>
      <p className="mb-8 text-sm muted">
        Los cambios aplican a las próximas reservas. Las citas ya creadas
        conservan sus mensajes programados.
      </p>
      <section className="card mb-6 p-6">
        <h2 className="text-2xl">Plantillas de la Fase 1</h2>
        <p className="mb-6 text-xs muted">
          Variables disponibles: {"{nombre}"}, {"{salon}"}, {"{fecha}"},{" "}
          {"{enlace}"}. Para Meta, configura una plantilla aprobada con dos
          parámetros de cuerpo: texto y enlace.
        </p>
        <ActionForm kind="messages">
          {[
            ["confirmation", "Confirmación"],
            ["reminder24", "Recordatorio 24 horas"],
            ["reminder2", "Recordatorio 2 horas"],
            ["thanks", "Agradecimiento y reseña"],
          ].map(([key, label]) => (
            <fieldset
              key={key}
              className="space-y-4 rounded-xl border border-border p-5"
            >
              <legend className="px-2 text-sm">{label}</legend>
              <label>
                Texto del mensaje
                <textarea
                  name={key}
                  defaultValue={
                    d.salon.settings.messages[
                      key as keyof typeof d.salon.settings.messages
                    ]
                  }
                  required
                  maxLength={1500}
                />
              </label>
              <label>
                Nombre de plantilla aprobada en Meta
                <input
                  name={`template-${key}`}
                  defaultValue={
                    d.salon.settings.whatsappTemplates[
                      key as keyof typeof d.salon.settings.whatsappTemplates
                    ] ?? ""
                  }
                  placeholder="ejemplo: recordatorio_cita"
                  pattern="[a-z0-9_]+"
                />
              </label>
            </fieldset>
          ))}
        </ActionForm>
      </section>
      <section className="card overflow-hidden">
        <div className="p-6">
          <h2 className="text-2xl">Cola de envíos</h2>
          <p className="mb-0 text-xs muted">
            Últimos 100 mensajes. Los resultados inciertos requieren revisar el
            proveedor antes de marcarlos como enviados o descartarlos.
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
                  <td className="text-[11px]">
                    {prettyDate(r.scheduledAt)}
                    <br />
                    {clock(r.scheduledAt)}
                  </td>
                  <td className="text-xs">
                    {r.kind}
                    <br />
                    <span className="muted">{r.payload.name}</span>
                  </td>
                  <td className="text-xs">{r.channel}</td>
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
                          <option value="cancelled">Descartar envío</option>
                          <option value="sent">Ya enviado (verificado)</option>
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
                      ? "Los mensajes del demo no se envían."
                      : "Aquí aparecerán los mensajes al recibir nuevas reservas."}
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
