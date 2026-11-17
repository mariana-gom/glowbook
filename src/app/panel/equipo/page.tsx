import Image from "next/image";
import { panelData } from "@/lib/panel-data";
import { ActionForm } from "@/components/action-form";
import type { SalonData } from "@/lib/demo";
import { prettyDate, clock } from "@/lib/utils";
const formatMinute = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const days = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
function StaffForm({ d, p }: { d: SalonData; p?: SalonData["staff"][number] }) {
  return (
    <ActionForm
      kind="staff"
      id={p?.id}
      submit={p ? "Guardar profesional" : "Crear profesional"}
    >
      <div className="field-grid">
        <label>
          Nombre
          <input name="name" defaultValue={p?.name} required />
        </label>
        <label>
          Especialidad / presentación
          <input name="title" defaultValue={p?.title} required />
        </label>
        <label>
          Foto (URL)
          <input name="photoUrl" defaultValue={p?.photoUrl ?? ""} />
        </label>
        <label>
          Correo de acceso (opcional)
          <input
            name="userEmail"
            type="email"
            placeholder="Cuenta creada por superadmin"
          />
        </label>
      </div>
      <label className="flex items-center gap-2">
        <input
          name="active"
          type="checkbox"
          defaultChecked={p?.active ?? true}
        />
        Profesional activa
      </label>
      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-2 text-xs">Servicios que realiza</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {d.services
            .filter((s) => s.active)
            .map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2 text-xs font-normal"
              >
                <input
                  type="checkbox"
                  name="services"
                  value={s.id}
                  defaultChecked={
                    p
                      ? d.staffServices.some(
                          (x) => x.staffId === p.id && x.serviceId === s.id,
                        )
                      : false
                  }
                />
                {s.name}
              </label>
            ))}
        </div>
      </fieldset>
    </ActionForm>
  );
}
export default async function Team() {
  const d = await panelData(true);
  return (
    <>
      <p className="eyebrow text-primary">EL TALENTO DETRÁS DE CADA SONRISA</p>
      <h1 className="text-4xl">Un equipo que brilla.</h1>
      <p className="mb-8 text-sm muted">
        Profesionales, servicios, horarios y ausencias en un mismo lugar.
      </p>
      <details className="card mb-8 p-6">
        <summary className="font-medium text-primary">
          + Agregar una profesional
        </summary>
        <div className="mt-6">
          <StaffForm d={d} />
        </div>
      </details>
      {d.staff.map((p) => (
        <section key={p.id} className="card mb-6 p-6">
          <div className="mb-6 flex items-center gap-4">
            <Image
              src={p.photoUrl || "/images/beauty.jpg"}
              alt=""
              width={52}
              height={52}
              className="size-13 rounded-full object-cover"
            />
            <div>
              <h2 className="mb-1 text-2xl">{p.name}</h2>
              <p className="mb-0 text-xs muted">
                {p.title} · {p.active ? "Activa" : "Inactiva"}
              </p>
            </div>
          </div>
          <details className="border-t border-border py-4">
            <summary className="text-sm">Perfil y servicios</summary>
            <div className="mt-5">
              <StaffForm d={d} p={p} />
            </div>
          </details>
          <details className="border-t border-border py-4">
            <summary className="text-sm">Horario semanal</summary>
            <p className="mt-4 text-xs muted">
              Una jornada por día. Para descansos o bloqueos puntuales, agrega
              una ausencia. Cambiar horarios no cancela citas existentes.
            </p>
            <div className="space-y-3">
              {days.map((day, weekday) => {
                const hour = d.hours.find(
                  (h) => h.staffId === p.id && h.weekday === weekday,
                );
                return (
                  <ActionForm
                    key={day}
                    kind="hours"
                    submit="Guardar día"
                    className="grid items-end gap-3 rounded-xl bg-background p-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    <input type="hidden" name="staffId" value={p.id} />
                    <input type="hidden" name="weekday" value={weekday} />
                    <label className="flex items-center gap-2">
                      <input
                        name="enabled"
                        type="checkbox"
                        defaultChecked={Boolean(hour)}
                      />
                      {day}
                    </label>
                    <label>
                      Hora de inicio
                      <input
                        type="time"
                        name="startTime"
                        defaultValue={formatMinute(hour?.startMinute ?? 540)}
                        required
                      />
                    </label>
                    <label>
                      Hora final
                      <input
                        type="time"
                        name="endTime"
                        defaultValue={formatMinute(hour?.endMinute ?? 1140)}
                        required
                      />
                    </label>
                  </ActionForm>
                );
              })}
            </div>
          </details>
          <details className="border-t border-border pt-4">
            <summary className="text-sm">Ausencias y bloqueos</summary>
            <div className="mt-5">
              <ActionForm kind="timeoff" submit="Bloquear horario">
                <input type="hidden" name="staffId" value={p.id} />
                <div className="field-grid">
                  <label>
                    Desde el día
                    <input name="startsAt" type="date" required />
                  </label>
                  <label>
                    Hora inicial
                    <input
                      name="startTime"
                      type="time"
                      required
                      defaultValue="09:00"
                    />
                  </label>
                  <label>
                    Hasta el día
                    <input name="endsAt" type="date" required />
                  </label>
                  <label>
                    Hora final
                    <input
                      name="endTime"
                      type="time"
                      required
                      defaultValue="19:00"
                    />
                  </label>
                </div>
                <label>
                  Motivo
                  <input name="reason" maxLength={300} />
                </label>
              </ActionForm>
              <div className="mt-6 space-y-4">
                {d.timeOff
                  .filter((a) => a.staffId === p.id)
                  .map((a) => (
                    <div key={a.id} className="rounded-xl bg-muted p-4">
                      <p className="text-xs">
                        {prettyDate(a.startsAt)} {clock(a.startsAt)} →{" "}
                        {prettyDate(a.endsAt)} {clock(a.endsAt)} · {a.reason}
                      </p>
                      <ActionForm
                        kind="delete-timeoff"
                        id={a.id}
                        submit="Eliminar bloqueo"
                      >
                        <span />
                      </ActionForm>
                    </div>
                  ))}
              </div>
            </div>
          </details>
        </section>
      ))}
    </>
  );
}
