import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Heart,
  Plus,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { panelData } from "@/lib/panel-data";
import { dayKey, money, prettyDate, clock, bogotaDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppointmentTable } from "@/components/appointment-table";
export default async function Dashboard() {
  const d = await panelData(),
    today = dayKey(),
    now = d.now,
    month = today.slice(0, 7);
  const todays = d.appointments
      .filter((a) => dayKey(a.startsAt) === today)
      .sort((a, b) => +a.startsAt - +b.startsAt),
    active = todays.filter(
      (a) => a.status !== "cancelled" && a.status !== "no_show",
    ),
    completed = d.appointments.filter(
      (a) => a.status === "completed" && dayKey(a.startsAt).startsWith(month),
    ),
    revenue =
      d.stats?.monthRevenue ?? completed.reduce((n, a) => n + a.total, 0),
    newClients = d.stats?.newClients ?? 0;
  const next = d.appointments
    .filter((a) => a.status === "confirmed" && +a.endsAt > now)
    .sort((a, b) => +a.startsAt - +b.startsAt)[0];
  const professional = d.staff.find((p) => p.id === next?.staffId),
    nextClient = d.clients.find((c) => c.id === next?.clientId);
  const monday = new Date(bogotaDate(today, 720));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = dayKey(new Date(+monday + i * 86400000));
    return {
      day,
      label: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][i],
      count: d.appointments.filter(
        (a) => dayKey(a.startsAt) === day && a.status !== "cancelled",
      ).length,
    };
  });
  const max = Math.max(...week.map((w) => w.count), 1);
  const totalWeek = week.reduce((n, w) => n + w.count, 0);
  const popular = Object.entries(
    d.appointmentServices
      .filter((s) => completed.some((a) => a.id === s.appointmentId))
      .reduce<Record<string, number>>(
        (acc, s) => ({ ...acc, [s.name]: (acc[s.name] ?? 0) + 1 }),
        {},
      ),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return (
    <div className="fade-in">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-2 text-[9px] text-accent">
            TU NEGOCIO, EN SU MEJOR MOMENTO
          </p>
          <h1 className="mb-2 text-[34px] tracking-tight">
            Un lindo día para hacerlas brillar{" "}
            <span className="text-accent">✧</span>
          </h1>
          <p className="mb-0 text-[11px] muted">
            Esto es lo que pasa hoy en tu salón. Tú pones el talento, nosotras
            el orden.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={`/${d.salon.slug}/reservar`}>
            <Plus size={14} />
            Nueva cita
          </Link>
        </Button>
      </div>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <p className="mb-0 flex items-center gap-2 text-[11px] capitalize muted">
          <CalendarDays size={13} />
          {prettyDate(new Date())}
        </p>
        <span className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-[9px] muted">
          <span className="size-1.5 rounded-full bg-[#7c9b7b]" />
          Tu salón está en línea
        </span>
      </div>
      <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "INGRESOS DEL MES",
            value: money(revenue),
            note: `${d.stats?.completedCount ?? completed.length} visitas completadas`,
            icon: Wallet,
            bg: "#f1e7ec",
            color: "#8b647b",
          },
          {
            label: "CITAS PARA HOY",
            value: String(active.length).padStart(2, "0"),
            note: `${todays.filter((a) => a.status === "completed").length} completadas · ${todays.filter((a) => a.status === "confirmed").length} por atender`,
            icon: CalendarDays,
            bg: "#f0e9df",
            color: "#9a825d",
          },
          {
            label: "CLIENTAS NUEVAS",
            value: String(newClients).padStart(2, "0"),
            note: "Registradas en este mes",
            icon: Users,
            bg: "#eaf0e8",
            color: "#768a70",
          },
          {
            label: "TU COMUNIDAD",
            value: String(d.stats?.totalClients ?? d.clients.length),
            note: "Clientas que hacen parte de tu historia",
            icon: Heart,
            bg: "#eeeaf3",
            color: "#8e7c9e",
          },
        ].map(({ label, value, note, icon: Icon, bg, color }) => (
          <article key={label} className="card px-5 py-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="eyebrow mb-0 text-[8px] muted">{label}</p>
              <span
                style={{ background: bg, color }}
                className="grid size-8 place-items-center rounded-lg"
              >
                <Icon size={15} strokeWidth={1.5} />
              </span>
            </div>
            <p className="serif mb-3 text-[30px] tracking-tight">{value}</p>
            <p className="mb-0 text-[9px] muted">{note}</p>
          </article>
        ))}
      </section>
      <div className="mb-7 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <section className="card p-6">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="mb-1 text-xl">El ritmo de tu semana</h2>
              <p className="mb-0 text-[10px] muted">
                Cada cita, una oportunidad para conectar.
              </p>
            </div>
            <span className="rounded-md border border-border px-3 py-1 text-[9px] muted">
              Esta semana
            </span>
          </div>
          <div className="mb-5 flex items-baseline gap-2">
            <span className="serif text-3xl">{totalWeek}</span>
            <span className="text-[10px] muted">citas programadas</span>
          </div>
          <div className="flex h-34 items-end gap-3 border-b border-border px-2">
            {week.map((w) => (
              <div
                key={w.day}
                className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <span className="text-[9px] muted">{w.count}</span>
                <div
                  title={`${w.count} citas`}
                  className={`w-full max-w-10 rounded-t-md transition-colors ${w.day === today ? "bg-primary" : "bg-[#e8dadd] group-hover:bg-[#cbb3be]"}`}
                  style={{ height: `${Math.max((w.count / max) * 95, 3)}px` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-around">
            {week.map((w) => (
              <span
                key={w.day}
                className={`text-[9px] ${w.day === today ? "font-semibold text-primary" : "muted"}`}
              >
                {w.label}
              </span>
            ))}
          </div>
        </section>
        <section className="relative overflow-hidden rounded-2xl border border-[#e5d9db] bg-[#efe5e6] p-6">
          <div className="pointer-events-none absolute -right-10 -top-8 size-44 rounded-full border border-[#e2d3d7]" />
          <div className="mb-5 flex items-center justify-between">
            <p className="eyebrow mb-0 text-[8px] text-primary">
              EL PRÓXIMO MOMENTO
            </p>
            <Sparkles size={16} className="text-accent" />
          </div>
          {next ? (
            <>
              <div className="mb-5 flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-white/65 text-sm text-primary">
                  {nextClient?.name
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")}
                </span>
                <div>
                  <h2 className="mb-1 text-2xl">{nextClient?.name}</h2>
                  <p className="mb-0 text-[10px] muted">
                    {d.appointmentServices
                      .filter((s) => s.appointmentId === next.id)
                      .map((s) => s.name)
                      .join(" + ")}
                  </p>
                </div>
              </div>
              <div className="mb-4 flex items-center gap-4 text-[11px] text-primary">
                <span className="flex items-center gap-1.5">
                  <Clock3 size={12} />
                  {clock(next.startsAt)} – {clock(next.endsAt)}
                </span>
                <span>
                  {dayKey(next.startsAt) === today
                    ? "Hoy"
                    : prettyDate(next.startsAt)}
                </span>
              </div>
              <div className="mb-5 flex items-center gap-2 text-[10px] muted">
                {professional?.photoUrl && (
                  <Image
                    src={professional.photoUrl}
                    width={22}
                    height={22}
                    alt=""
                    className="size-6 rounded-full object-cover"
                  />
                )}
                Con {professional?.name}
              </div>
              <Link
                href={`/panel/agenda?dia=${dayKey(next.startsAt)}`}
                className="flex items-center justify-between border-t border-[#ddcdd2] pt-4 text-[10px] text-primary"
              >
                Todo listo para recibirla <ArrowRight size={14} />
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-3xl">Un espacio para algo bonito.</h2>
              <p className="text-xs muted">
                Comparte tu página para recibir tus próximas reservas.
              </p>
              <Button asChild variant="outline">
                <Link href={`/${d.salon.slug}`}>Ver mi página</Link>
              </Button>
            </>
          )}
        </section>
      </div>
      <section className="card mb-7 overflow-hidden">
        <div className="flex items-center justify-between gap-4 p-6">
          <div>
            <h2 className="mb-1 text-xl">
              Tu agenda de hoy{" "}
              <span className="ml-2 rounded-full bg-muted px-2 py-1 font-sans text-[9px] muted">
                {todays.length} citas
              </span>
            </h2>
            <p className="mb-0 text-[10px] muted">
              Pequeños momentos que hacen un gran día.
            </p>
          </div>
          <Link
            href="/panel/agenda"
            className="flex items-center gap-2 whitespace-nowrap text-[10px] text-primary"
          >
            Ver agenda <ArrowUpRight size={13} />
          </Link>
        </div>
        <AppointmentTable data={d} rows={todays.slice(0, 5)} />
      </section>
      <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <section className="card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="mb-0 text-xl">Los favoritos de tus clientas</h2>
            <span className="text-[9px] muted">Este mes</span>
          </div>
          <div className="grid gap-5">
            {popular.map(([name, count], i) => (
              <div key={name} className="flex items-center gap-4">
                <span className="serif text-lg text-accent">0{i + 1}</span>
                <div className="flex-1">
                  <div className="mb-2 flex justify-between text-[10px]">
                    <span>{name}</span>
                    <span className="muted">{count} visitas</span>
                  </div>
                  <div className="h-1 rounded-full bg-muted">
                    <div
                      className="h-1 rounded-full bg-[#c6aab5]"
                      style={{ width: `${(count / popular[0][1]) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {!popular.length && (
              <p className="text-xs muted">
                Aquí verás los servicios favoritos después de completar tus
                primeras citas.
              </p>
            )}
          </div>
        </section>
        <section className="flex flex-col justify-between rounded-2xl border border-[#e6dfd2] bg-[#f2eddf] p-6">
          <div>
            <div className="mb-4 flex items-center gap-2 text-accent">
              <Sparkles size={17} />
              <span className="eyebrow text-[8px]">UN DETALLE QUE SUMA</span>
            </div>
            <h2 className="mb-3 text-2xl">Tu enlace, siempre a mano.</h2>
            <p className="mb-5 text-[11px] leading-5 muted">
              Pon tu página de reservas en tu bio de Instagram. Tus clientas
              pueden elegir su próximo momento, incluso cuando tú descansas.
            </p>
          </div>
          <Link
            href={`/${d.salon.slug}`}
            target="_blank"
            className="flex items-center justify-between text-[10px] text-primary"
          >
            Conoce tu página de reservas <ArrowUpRight size={13} />
          </Link>
        </section>
      </div>
    </div>
  );
}
