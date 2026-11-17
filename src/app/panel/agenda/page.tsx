import { z } from "zod";
import Link from "next/link";
import { Plus } from "lucide-react";
import { panelData } from "@/lib/panel-data";
import { dayKey, bogotaDate, prettyDate } from "@/lib/utils";
import { AppointmentTable } from "@/components/appointment-table";
import { Button } from "@/components/ui/button";
export default async function Agenda({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; vista?: string; profesional?: string }>;
}) {
  const q = await searchParams,
    day = q.dia && z.iso.date().safeParse(q.dia).success ? q.dia : dayKey(),
    week = q.vista === "semana",
    start = bogotaDate(day, 0),
    end = start + (week ? 7 : 1) * 86400000;
  const d = await panelData(false, {
    range: { start: new Date(start), end: new Date(end) },
  });
  const rows = d.appointments
    .filter(
      (a) =>
        +a.startsAt >= start &&
        +a.startsAt < end &&
        (!q.profesional || a.staffId === q.profesional),
    )
    .sort((a, b) => +a.startsAt - +b.startsAt);
  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-5">
        <div>
          <p className="eyebrow text-primary">CADA CITA CUENTA</p>
          <h1 className="mb-2 text-4xl">Tu agenda, con claridad.</h1>
          <p className="text-xs muted">
            Organiza las visitas y registra el resultado de cada cita.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={`/${d.salon.slug}/reservar`}>
            <Plus size={14} />
            Nueva cita
          </Link>
        </Button>
      </div>
      <form className="card mb-6 grid items-end gap-4 p-5 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <label>
          Desde el día
          <input name="dia" type="date" defaultValue={day} />
        </label>
        <label>
          Vista
          <select name="vista" defaultValue={q.vista ?? "dia"}>
            <option value="dia">Un día</option>
            <option value="semana">Una semana</option>
          </select>
        </label>
        <label>
          Profesional
          <select name="profesional" defaultValue={q.profesional ?? ""}>
            <option value="">Todo el equipo</option>
            {d.staff
              .filter(
                (p) => d.access.role === "owner" || p.id === d.access.staffId,
              )
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <Button type="submit">Ver agenda</Button>
      </form>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="mb-0 text-xs capitalize muted">
          {prettyDate(new Date(start + 12 * 3600000))}
          {week ? " · próximos siete días" : ""}
        </p>
        <span className="text-xs muted">
          {rows.length} citas · Hora de Bogotá
        </span>
      </div>
      <section className="card overflow-hidden">
        <AppointmentTable data={d} rows={rows} showDate={week} actions />
      </section>
    </>
  );
}
