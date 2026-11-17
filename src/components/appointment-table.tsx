import Link from "next/link";
import Image from "next/image";
import { Clock3 } from "lucide-react";
import type { SalonData } from "@/lib/demo";
import { clock, money, prettyDate } from "@/lib/utils";
import { ActionForm } from "./action-form";
export function AppointmentTable({
  data,
  rows,
  actions = false,
  showDate = false,
}: {
  data: SalonData;
  rows: SalonData["appointments"];
  actions?: boolean;
  showDate?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>{showDate ? "Fecha y hora" : "Hora"}</th>
            <th>Clienta</th>
            <th>Servicio</th>
            <th>Profesional</th>
            <th>Valor</th>
            <th>Estado</th>
            {actions && <th>Actualizar</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const client = data.clients.find((c) => c.id === a.clientId),
              p = data.staff.find((p) => p.id === a.staffId),
              services = data.appointmentServices.filter(
                (s) => s.appointmentId === a.id,
              );
            return (
              <tr key={a.id}>
                <td className="whitespace-nowrap">
                  {showDate && (
                    <span className="mb-1 block text-[10px] muted">
                      {prettyDate(a.startsAt)}
                    </span>
                  )}
                  <span className="text-xs font-medium">
                    {clock(a.startsAt)}
                  </span>
                  <span className="block text-[9px] muted">
                    {clock(a.endsAt)}
                  </span>
                </td>
                <td>
                  <Link
                    href={`/panel/clientas?clienta=${a.clientId}`}
                    className="flex items-center gap-2.5"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f0e5e5] text-[10px] text-primary">
                      {client?.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span className="whitespace-nowrap text-[11px] font-medium">
                      {client?.name ?? "Clienta"}
                    </span>
                  </Link>
                </td>
                <td>
                  <span className="block min-w-32 text-[11px]">
                    {services.map((s) => s.name).join(" + ")}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-[9px] muted">
                    <Clock3 size={9} />
                    {Math.round((+a.endsAt - +a.startsAt) / 60000)} min
                  </span>
                </td>
                <td>
                  <span className="flex items-center gap-2 whitespace-nowrap text-[10px] muted">
                    {p?.photoUrl && (
                      <Image
                        src={p.photoUrl}
                        alt=""
                        width={22}
                        height={22}
                        className="size-5 rounded-full object-cover"
                      />
                    )}
                    {p?.name.split(" ")[0]}
                  </span>
                </td>
                <td className="whitespace-nowrap text-[11px]">
                  {money(a.total)}
                </td>
                <td>
                  <span className={`badge ${a.status}`}>
                    <span className="size-1 rounded-full bg-current" />
                    {
                      {
                        confirmed: "Confirmada",
                        completed: "Completada",
                        cancelled: "Cancelada",
                        no_show: "No asistió",
                      }[a.status]
                    }
                  </span>
                </td>
                {actions && (
                  <td>
                    {a.status === "confirmed" && (
                      <ActionForm
                        kind="status"
                        id={a.id}
                        submit="Aplicar"
                        className="flex min-w-36 flex-wrap items-center gap-2"
                      >
                        <label className="sr-only" htmlFor={`status-${a.id}`}>
                          Nuevo estado de la cita
                        </label>
                        <select
                          id={`status-${a.id}`}
                          name="status"
                          className="!min-h-8 !p-1 !text-[10px]"
                        >
                          <option value="completed">Completada</option>
                          <option value="no_show">No asistió</option>
                          <option value="cancelled">Cancelada</option>
                        </select>
                      </ActionForm>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td
                colSpan={actions ? 7 : 6}
                className="py-12 text-center text-sm muted"
              >
                Tu agenda tiene espacio para nuevos momentos. No hay citas en
                este período.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
