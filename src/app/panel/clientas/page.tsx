import Link from "next/link";
import { panelData } from "@/lib/panel-data";
import { money, prettyDate } from "@/lib/utils";
import { AppointmentTable } from "@/components/appointment-table";
import { ActionForm } from "@/components/action-form";
import { Button } from "@/components/ui/button";
export default async function Clients({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; clienta?: string; pagina?: string }>;
}) {
  const q = await searchParams,
    page = Math.max(1, Math.min(10000, Math.floor(Number(q.pagina) || 1))),
    d = await panelData(
      false,
      q.clienta
        ? { clientId: q.clienta }
        : { directory: { query: (q.q ?? "").slice(0, 120), page } },
    ),
    client = d.clients.find((c) => c.id === q.clienta),
    rows = d.clients.filter((c) =>
      `${c.name} ${c.phone} ${c.email}`
        .toLocaleLowerCase("es")
        .includes((q.q ?? "").toLocaleLowerCase("es")),
    );
  return (
    <>
      <p className="eyebrow text-primary">PERSONAS, NO SOLO RESERVAS</p>
      <h1 className="text-4xl">Tu comunidad de clientas.</h1>
      <p className="mb-8 text-sm muted">
        Su historia en tu salón, siempre a mano.
      </p>
      {client ? (
        <>
          <Link
            href="/panel/clientas"
            className="mb-6 inline-block text-xs text-primary"
          >
            ← Volver a todas las clientas
          </Link>
          <section className="card mb-6 p-6">
            <h2 className="text-3xl">{client.name}</h2>
            {d.access.role === "owner" ? (
              <ActionForm kind="client" id={client.id}>
                <div className="field-grid">
                  <label>
                    Nombre
                    <input name="name" defaultValue={client.name} required />
                  </label>
                  <label>
                    Celular
                    <input
                      name="phone"
                      defaultValue={client.phone}
                      required
                      pattern="\+573[0-9]{9}"
                    />
                  </label>
                  <label>
                    Correo
                    <input
                      name="email"
                      type="email"
                      defaultValue={client.email}
                      required
                    />
                  </label>
                </div>
              </ActionForm>
            ) : (
              <p className="text-sm muted">
                {client.phone} · {client.email}
              </p>
            )}
          </section>
          <h2 className="text-2xl">Historial de visitas</h2>
          <section className="card">
            <AppointmentTable
              data={d}
              rows={d.appointments
                .filter((a) => a.clientId === client.id)
                .sort((a, b) => +b.startsAt - +a.startsAt)}
              showDate
            />
          </section>
        </>
      ) : (
        <>
          <form className="mb-6 flex max-w-lg gap-3">
            <label className="flex-1">
              <span className="sr-only">Buscar clientas</span>
              <input
                name="q"
                defaultValue={q.q}
                placeholder="Buscar por nombre, celular o correo…"
              />
            </label>
            <Button type="submit">Buscar</Button>
          </form>
          <section className="card overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Clienta</th>
                  <th>Contacto</th>
                  <th>Visitas completadas</th>
                  <th>Total invertido</th>
                  <th>Última visita</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const completed = d.appointments
                    .filter(
                      (a) => a.clientId === c.id && a.status === "completed",
                    )
                    .sort((a, b) => +b.startsAt - +a.startsAt);
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link
                          href={`?clienta=${c.id}`}
                          className="font-medium text-primary"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="text-xs muted">
                        {c.phone}
                        <br />
                        {c.email}
                      </td>
                      <td>{completed.length}</td>
                      <td>
                        {money(completed.reduce((n, a) => n + a.total, 0))}
                      </td>
                      <td className="text-xs muted">
                        {completed[0]
                          ? prettyDate(completed[0].startsAt)
                          : "Primera visita pendiente"}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={5} className="text-center muted">
                      No se encontraron clientas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
          <div className="mt-5 flex items-center justify-between text-xs muted">
            <span>
              {d.stats?.directoryCount ?? rows.length} clientas · Página {page}
            </span>
            <div className="flex gap-5">
              {page > 1 && (
                <Link
                  href={`?q=${encodeURIComponent(q.q ?? "")}&pagina=${page - 1}`}
                >
                  ← Anterior
                </Link>
              )}
              {page * 50 < (d.stats?.directoryCount ?? 0) && (
                <Link
                  href={`?q=${encodeURIComponent(q.q ?? "")}&pagina=${page + 1}`}
                >
                  Siguiente →
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
