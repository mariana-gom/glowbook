import { panelAccess } from "@/lib/access";
import { listFollowUps } from "@/lib/follow-ups";
import { whatsappLabels } from "@/lib/whatsapp";
import type { FollowUpKind } from "@/db/schema";
import { WhatsAppAction } from "@/components/whatsapp-action";
export default async function Pending() {
  const access = await panelAccess(true),
    items = await listFollowUps(access.salonId, access.demo);
  return (
    <>
      <p className="eyebrow text-primary">UN TOQUE PARA CUIDAR CADA RELACIÓN</p>
      <h1 className="text-4xl">Pendientes de hoy.</h1>
      <p className="mb-6 max-w-3xl text-sm muted">
        Abre el chat con el mensaje listo. Al tocarlo se marca enviado en tu
        lista; WhatsApp requiere que tú pulses Enviar. La web no puede verificar
        la entrega.
      </p>
      {access.demo && (
        <p className="mb-6 rounded-xl bg-muted p-4 text-xs">
          Demo: los cambios se marcan solo en esta pantalla. Los chats usan
          contactos ficticios; no envíes mensajes reales.
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {(
          [
            "confirmation",
            "reminder24",
            "thanks",
            "maintenance",
            "reactivation",
            "birthday",
          ] as FollowUpKind[]
        ).map((kind) => {
          const rows = items.filter((i) => i.kind === kind);
          return (
            <section key={kind} className="card p-6">
              <h2 className="mb-2 text-2xl">
                {
                  {
                    confirmation: "Citas nuevas por confirmar",
                    reminder24: "Recordatorios del día",
                    thanks: "Agradecimientos y reseñas",
                    maintenance: "Mantenimientos",
                    reactivation: "Clientas para reactivar",
                    birthday: "Cumpleaños",
                  }[kind]
                }
              </h2>
              <p className="mb-5 text-xs muted">
                {rows.filter((r) => r.status === "pending").length} pendientes
              </p>
              <div className="space-y-5">
                {rows.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
                  >
                    <div>
                      <p className="mb-1 text-sm font-medium">{item.name}</p>
                      <p className="mb-0 text-[11px] muted">
                        {item.detail} · {item.dueOn}
                      </p>
                    </div>
                    <WhatsAppAction
                      input={{ taskId: item.id }}
                      label={whatsappLabels[kind]}
                      marked={item.status === "marked_sent"}
                    />
                  </div>
                ))}
                {!rows.length && (
                  <p className="mb-0 py-4 text-xs muted">
                    Todo al día en esta categoría.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-6 text-xs muted">
        Los seguimientos comerciales requieren autorización de la clienta. Se
        muestran hasta 300 ítems, priorizando pendientes; al resolverlos
        aparecerán los siguientes.
      </p>
    </>
  );
}
