"use client";
import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { sendWhatsApp, defaultWhatsAppMessages } from "@/lib/whatsapp";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "./ui/button";
import type { SalonData } from "@/lib/demo";
import { money, prettyDate } from "@/lib/utils";
import { createBooking, getSlots } from "@/app/actions/booking";
import type { Slot } from "@/lib/availability";
type Props = {
  salon: SalonData["salon"];
  services: SalonData["services"];
  categories: SalonData["categories"];
  staff: SalonData["staff"];
  skills: SalonData["staffServices"];
  demo: boolean;
  today: string;
  lastDay: string;
  initialService?: string;
  initialStaff?: string;
};
export function BookingWizard({
  salon,
  services,
  categories,
  staff,
  skills,
  demo,
  today,
  lastDay,
  initialService,
  initialStaff,
}: Props) {
  const router = useRouter(),
    requestKey = useRef<string | null>(null);
  const [step, setStep] = useState(0),
    [ids, setIds] = useState<string[]>(
      initialService && services.some((s) => s.id === initialService)
        ? [initialService]
        : [],
    ),
    [category, setCategory] = useState(categories[0]?.id ?? ""),
    [professional, setProfessional] = useState(
      initialStaff && staff.some((p) => p.id === initialStaff)
        ? initialStaff
        : "any",
    ),
    [day, setDay] = useState(today),
    [slots, setSlots] = useState<Slot[]>([]),
    [slot, setSlot] = useState<Slot | null>(null),
    [error, setError] = useState(""),
    [pending, startTransition] = useTransition(),
    [finished, setFinished] = useState(false),
    [demoName, setDemoName] = useState("");
  const selected = services.filter((s) => ids.includes(s.id)),
    total = selected.reduce((n, s) => n + s.price, 0),
    duration = selected.reduce((n, s) => n + s.duration, 0);
  const eligible = staff.filter((p) =>
    ids.every((id) =>
      skills.some((s) => s.staffId === p.id && s.serviceId === id),
    ),
  );
  function loadSlots(nextDay = day, nextStaff = professional) {
    setSlot(null);
    setSlots([]);
    setError("");
    startTransition(async () => {
      try {
        const rows = await getSlots({
          slug: salon.slug,
          serviceIds: ids,
          staffId: nextStaff,
          day: nextDay,
        });
        setSlots(
          rows.filter(
            (r, i, a) => a.findIndex((x) => x.startsAt === r.startsAt) === i,
          ),
        );
      } catch {
        setError("No pudimos cargar los horarios. Intenta nuevamente.");
      }
    });
  }
  function next() {
    setError("");
    if (step === 0) {
      if (!ids.length) return setError("Elige al menos un servicio.");
      if (!eligible.length)
        return setError(
          "Estos servicios requieren profesionales distintas. Reserva cada visita por separado.",
        );
      if (
        professional !== "any" &&
        !eligible.some((p) => p.id === professional)
      )
        setProfessional("any");
    }
    if (step === 1) loadSlots();
    if (step === 2 && !slot)
      return setError("Selecciona un horario disponible.");
    setStep((s) => s + 1);
  }
  function submit(form: FormData) {
    if (!slot) return;
    setError("");
    const name = String(form.get("name") ?? "");
    if (demo) {
      setDemoName(name);
      setFinished(true);
      return;
    }
    startTransition(async () => {
      requestKey.current ??= crypto.randomUUID();
      const result = await createBooking({
        slug: salon.slug,
        serviceIds: ids,
        staffId: slot.staffId,
        day,
        startsAt: slot.startsAt,
        name,
        phone: String(form.get("phone") ?? ""),
        email: String(form.get("email") ?? ""),
        consent: (form.get("consent") === "on") as true,
        marketingConsent: form.get("marketing") === "on",
        website: String(form.get("website") ?? "") as "",
        requestKey: requestKey.current,
      });
      if (result.error) setError(result.error);
      else if (result.url) router.push(result.url);
    });
  }
  if (finished)
    return (
      <div className="card mx-auto max-w-xl p-10 text-center fade-in">
        <CheckCircle2
          className="mx-auto mb-6 text-primary"
          size={50}
          strokeWidth={1}
        />
        <p className="eyebrow text-primary">SIMULACIÓN COMPLETADA</p>
        <h1 className="text-4xl">Así de fácil, {demoName.split(" ")[0]}.</h1>
        <p className="muted">
          En un salón activo, aquí tendrías tu confirmación y el enlace para
          gestionar tu cita. Esta prueba no creó una reserva ni envió mensajes.
        </p>
        <div className="my-6 rounded-xl bg-muted p-5 text-left">
          <p className="font-medium">
            {selected.map((s) => s.name).join(" + ")}
          </p>
          <p className="mb-1 text-sm">
            {prettyDate(day + "T12:00:00-05:00")} · {slot?.label}
          </p>
          <p className="mb-0 text-sm">
            {staff.find((p) => p.id === slot?.staffId)?.name} · {money(total)}
          </p>
        </div>
        <Button asChild className="mb-4">
          <a
            href={
              sendWhatsApp(
                salon.settings.whatsapp,
                {
                  ...defaultWhatsAppMessages,
                  ...salon.settings.whatsappMessages,
                }.clientConfirmation,
                {
                  nombre: demoName,
                  servicio: selected.map((s) => s.name).join(" + "),
                  fecha: prettyDate(day + "T12:00:00-05:00"),
                  hora: slot?.label ?? "",
                  profesional:
                    staff.find((p) => p.id === slot?.staffId)?.name ?? "",
                  codigo: "DEMO",
                  enlace_reprogramar: `/${salon.slug}/reservar`,
                  enlace: `/${salon.slug}/reservar`,
                  salon: salon.name,
                },
              ).url
            }
            target="_blank"
            rel="noreferrer"
          >
            Confirmar por WhatsApp
          </a>
        </Button>
        <p className="text-xs muted">
          Este enlace abre un chat de demostración. No envíes mensajes a los
          contactos ficticios.
        </p>
        <Button asChild>
          <Link href="/demo">
            Seguir explorando <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    );
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_330px]">
      <div>
        <nav
          aria-label="Progreso de reserva"
          className="mb-10 grid grid-cols-4 gap-2"
        >
          {["Tu servicio", "Profesional", "Fecha y hora", "Tus datos"].map(
            (label, i) => (
              <div
                key={label}
                className={`border-t-2 pt-4 ${i <= step ? "border-primary" : "border-border"}`}
                aria-current={i === step ? "step" : undefined}
              >
                <span
                  className={`mb-2 grid size-6 place-items-center rounded-full text-[10px] ${i <= step ? "bg-primary text-white" : "bg-muted muted"}`}
                >
                  {i < step ? <Check size={12} /> : i + 1}
                </span>
                <span
                  className={`text-[11px] ${i === step ? "font-semibold" : "muted"}`}
                >
                  {label}
                </span>
              </div>
            ),
          )}
        </nav>
        <div className="fade-in" key={step}>
          <p className="eyebrow text-primary">PASO 0{step + 1} DE 04</p>
          <h1 className="mb-2 text-4xl">
            {
              [
                "¿Cómo quieres consentirte?",
                "Elige tus manos expertas.",
                "Hagamos un espacio para ti.",
                "Ya casi es tu momento.",
              ][step]
            }
          </h1>
          <p className="mb-7 text-sm muted">
            {
              [
                "Puedes elegir varios servicios para una misma visita.",
                "Todas nuestras profesionales cuidan cada detalle.",
                "Los horarios incluyen el tiempo que tu servicio necesita.",
                "Solo necesitamos estos datos. No tienes que crear una cuenta.",
              ][step]
            }
          </p>
          {step === 0 && (
            <>
              <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`shrink-0 rounded-full border px-4 py-2 text-xs ${category === c.id ? "border-primary bg-primary text-white" : "border-border bg-white"}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {services
                  .filter((s) => s.categoryId === category)
                  .map((s) => (
                    <button
                      key={s.id}
                      aria-pressed={ids.includes(s.id)}
                      onClick={() => {
                        setIds(
                          ids.includes(s.id)
                            ? ids.filter((id) => id !== s.id)
                            : [...ids, s.id],
                        );
                        setSlot(null);
                        setError("");
                      }}
                      className={`card flex w-full items-center gap-4 p-4 text-left ${ids.includes(s.id) ? "border-primary ring-1 ring-primary" : ""}`}
                    >
                      <Image
                        src={s.photoUrl || "/images/nails.jpg"}
                        width={60}
                        height={64}
                        alt=""
                        className="size-16 rounded-lg object-cover"
                      />
                      <span className="flex-1">
                        <strong className="mb-1 block text-sm font-medium">
                          {s.name}
                        </strong>
                        <span className="block text-[11px] muted">
                          {s.duration} min · {s.cleanup} min de limpieza
                        </span>
                        <span className="mt-1 block text-sm">
                          {money(s.price)}
                        </span>
                      </span>
                      <span
                        className={`grid size-6 place-items-center rounded-full border ${ids.includes(s.id) ? "border-primary bg-primary text-white" : "border-border"}`}
                      >
                        {ids.includes(s.id) && <Check size={13} />}
                      </span>
                    </button>
                  ))}
              </div>
            </>
          )}
          {step === 1 && (
            <div className="space-y-3">
              <button
                aria-pressed={professional === "any"}
                onClick={() => setProfessional("any")}
                className={`card flex w-full items-center gap-4 p-5 text-left ${professional === "any" ? "border-primary ring-1 ring-primary" : ""}`}
              >
                <span className="grid size-14 place-items-center rounded-full bg-muted text-primary">
                  <Sparkles />
                </span>
                <span>
                  <strong className="block text-sm">
                    Cualquiera disponible
                  </strong>
                  <span className="text-xs muted">
                    Encuentra más horarios para tu visita
                  </span>
                </span>
                {professional === "any" && (
                  <Check className="ml-auto text-primary" size={18} />
                )}
              </button>
              {eligible.map((p) => (
                <button
                  key={p.id}
                  aria-pressed={professional === p.id}
                  onClick={() => setProfessional(p.id)}
                  className={`card flex w-full items-center gap-4 p-5 text-left ${professional === p.id ? "border-primary ring-1 ring-primary" : ""}`}
                >
                  <Image
                    src={p.photoUrl || "/images/beauty.jpg"}
                    width={56}
                    height={56}
                    alt=""
                    className="size-14 rounded-full object-cover"
                  />
                  <span>
                    <strong className="block text-sm">{p.name}</strong>
                    <span className="text-xs muted">{p.title}</span>
                  </span>
                  {professional === p.id && (
                    <Check className="ml-auto text-primary" size={18} />
                  )}
                </button>
              ))}
            </div>
          )}
          {step === 2 && (
            <div className="card p-6">
              <label className="mb-6">
                Fecha de tu visita
                <input
                  type="date"
                  min={today}
                  max={lastDay}
                  value={day}
                  onChange={(e) => {
                    setDay(e.target.value);
                    loadSlots(e.target.value);
                  }}
                />
              </label>
              <div className="mb-4 flex items-center justify-between">
                <p className="mb-0 text-xs font-medium">Horarios disponibles</p>
                <span className="text-[10px] muted">Hora de Bogotá</span>
              </div>
              {pending ? (
                <p role="status" className="py-8 text-center muted">
                  Buscando un espacio para ti…
                </p>
              ) : slots.length ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((s) => (
                    <button
                      key={s.startsAt}
                      onClick={() => setSlot(s)}
                      aria-pressed={s.startsAt === slot?.startsAt}
                      className={`min-h-11 rounded-lg border text-xs ${s.startsAt === slot?.startsAt ? "border-primary bg-primary text-white" : "border-border hover:border-primary"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-7 text-center">
                  <CalendarDays
                    size={28}
                    className="mx-auto mb-3 text-accent"
                  />
                  <p className="text-sm muted">
                    No hay cupos en esta fecha. Prueba otro día o profesional.
                  </p>
                </div>
              )}
            </div>
          )}
          {step === 3 && (
            <form
              id="booking-form"
              action={submit}
              className="card space-y-5 p-6"
            >
              <div className="field-grid">
                <label>
                  Nombre completo
                  <input
                    name="name"
                    required
                    minLength={3}
                    maxLength={100}
                    autoComplete="name"
                    placeholder="Tu nombre"
                  />
                </label>
                <label>
                  Celular
                  <input
                    name="phone"
                    type="tel"
                    required
                    pattern="(\+57)?3[0-9]{9}"
                    autoComplete="tel"
                    placeholder="300 123 4567 (sin espacios)"
                  />
                </label>
              </div>
              <label>
                Correo electrónico
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  maxLength={180}
                  placeholder="tucorreo@ejemplo.com"
                />
              </label>
              <div className="hidden" aria-hidden="true">
                <label>
                  Sitio web
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <label className="flex items-start gap-3 text-xs font-normal leading-5">
                <input
                  name="consent"
                  type="checkbox"
                  required
                  className="mt-1 shrink-0"
                />
                <span>
                  Acepto el{" "}
                  <Link
                    href="/privacidad"
                    target="_blank"
                    className="underline"
                  >
                    tratamiento de mis datos
                  </Link>{" "}
                  para gestionar mi cita y recibir sus recordatorios.
                </span>
              </label>
              <label className="flex items-start gap-3 text-xs font-normal leading-5">
                <input
                  name="marketing"
                  type="checkbox"
                  className="mt-1 shrink-0"
                />
                <span>
                  Quiero recibir novedades y promociones del salón (opcional).
                </span>
              </label>
              <p className="mb-0 rounded-lg bg-muted p-4 text-[11px] muted">
                Puedes cambiar o cancelar con {salon.settings.cancellationHours}{" "}
                horas de anticipación. El pago se realiza directamente en el
                salón.
              </p>
            </form>
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        <div className="mt-7 flex justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() =>
              step ? setStep((s) => s - 1) : router.push(`/${salon.slug}`)
            }
            disabled={pending}
          >
            <ArrowLeft size={15} />
            Volver
          </Button>
          {step < 3 ? (
            <Button onClick={next} disabled={pending}>
              Continuar <ArrowRight size={15} />
            </Button>
          ) : (
            <Button type="submit" form="booking-form" disabled={pending}>
              {pending
                ? "Confirmando…"
                : demo
                  ? "Probar confirmación"
                  : "Confirmar mi reserva"}
              <Check size={15} />
            </Button>
          )}
        </div>
      </div>
      <aside className="lg:pt-27">
        <div className="card sticky top-8 overflow-hidden">
          <div className="relative h-32">
            <Image
              src={salon.settings.heroUrl || "/images/salon.jpg"}
              alt=""
              fill
              sizes="330px"
              className="object-cover"
            />
          </div>
          <div className="p-6">
            <p className="eyebrow mb-3 text-primary">TU MOMENTO DE BELLEZA</p>
            <h2 className="mb-6 text-2xl">{salon.name}</h2>
            {selected.length ? (
              selected.map((s) => (
                <div
                  key={s.id}
                  className="mb-3 flex justify-between gap-4 text-xs"
                >
                  <span>{s.name}</span>
                  <span className="shrink-0">{money(s.price)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs muted">Elige tus servicios para empezar.</p>
            )}
            {selected.length > 0 && (
              <>
                <div className="soft-divider my-5" />
                <div className="mb-3 flex items-center gap-2 text-xs muted">
                  <Clock3 size={13} />
                  {duration} minutos de cuidado para ti
                </div>
                {professional !== "any" && (
                  <p className="text-xs muted">
                    Con {staff.find((p) => p.id === professional)?.name}
                  </p>
                )}
                {slot && (
                  <p className="text-xs muted">
                    {prettyDate(slot.startsAt)} · {slot.label}
                  </p>
                )}
                <div className="soft-divider my-5" />
                <div className="flex justify-between">
                  <span className="text-sm">Total</span>
                  <span className="serif text-2xl">{money(total)}</span>
                </div>
                <p className="mb-0 mt-2 text-[10px] muted">
                  Sin cobros en línea. Pagas en el salón.
                </p>
              </>
            )}
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-2 text-[10px] muted">
          <ShieldCheck size={12} />
          Tus datos se usan para cuidar tu experiencia
        </p>
      </aside>
    </div>
  );
}
