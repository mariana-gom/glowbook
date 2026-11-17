import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Check,
  Heart,
  MessageCircle,
  Sparkles,
  Star,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
export default function Home() {
  const sales = process.env.NEXT_PUBLIC_SALES_WHATSAPP;
  return (
    <>
      <header className="page-width flex h-24 items-center justify-between">
        <Brand />
        <nav className="hidden items-center gap-9 text-xs md:flex">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#beneficios">Hecho para ti</a>
          <a href="#planes">Planes</a>
        </nav>
        <div className="flex items-center gap-5">
          <Link href="/acceso" className="hidden text-xs sm:block">
            Iniciar sesión
          </Link>
          <Button asChild size="sm">
            <Link href="/demo">
              Explorar demo <ArrowUpRight size={14} />
            </Link>
          </Button>
        </div>
      </header>
      <main id="contenido">
        <section className="page-width grid items-center gap-12 py-12 md:grid-cols-[1.02fr_1fr] md:py-20">
          <div className="fade-in">
            <div className="eyebrow mb-6 flex items-center gap-2 text-primary">
              <span className="size-1.5 rounded-full bg-accent" /> PARA SALONES
              QUE QUIEREN BRILLAR
            </div>
            <h1 className="mb-6 text-5xl leading-[1.08] tracking-[-.04em] sm:text-6xl lg:text-[76px]">
              Tú creas belleza.
              <br />
              Tu agenda <em className="text-primary">se llena sola.</em>
            </h1>
            <p className="mb-8 max-w-md text-base leading-7 muted">
              Menos chats, más momentos para tus clientas. Reservas,
              recordatorios y tu negocio en un solo lugar, sin complicarte la
              vida.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/demo">
                  Conoce tu próxima agenda <ArrowRight size={16} />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/nails-glam-studio">Reservar una experiencia</Link>
              </Button>
            </div>
            <p className="mt-5 text-[11px] muted">
              Hecho para Colombia <span className="mx-2 text-accent">✦</span>{" "}
              Sin tarjeta para explorar
            </p>
            <div className="mt-10 flex items-center gap-4 border-t border-border pt-6">
              <div className="flex -space-x-2">
                {[0, 1, 2].map((i) => (
                  <Image
                    key={i}
                    src={`/images/staff-${i}.jpg`}
                    width={36}
                    height={36}
                    alt=""
                    className="size-9 rounded-full border-2 border-background object-cover"
                  />
                ))}
              </div>
              <div>
                <div className="flex gap-1 text-accent">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} size={11} fill="currentColor" />
                  ))}
                </div>
                <p className="mb-0 mt-1 text-[11px] muted">
                  Más cuidado para tus clientas. Más calma para ti.
                </p>
              </div>
            </div>
          </div>
          <div className="relative pb-10 md:pl-5">
            <div className="relative aspect-[.91] overflow-hidden rounded-t-[160px] rounded-b-2xl">
              <Image
                src="/images/salon.jpg"
                alt="Interior luminoso de un salón de belleza con espejos y plantas"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              <div className="absolute bottom-9 left-8 text-white">
                <div className="eyebrow mb-3 opacity-80">
                  TU ESPACIO PARA CRECER
                </div>
                <p className="serif mb-0 text-3xl">
                  Un negocio tan bonito
                  <br />
                  como lo que haces.
                </p>
              </div>
            </div>
            <div className="absolute -left-1 top-12 flex items-center gap-3 rounded-xl border border-border bg-white/95 px-5 py-4 shadow-[0_8px_40px_#30282b10]">
              <div className="grid size-10 place-items-center rounded-full bg-[#edf3ec] text-[#668469]">
                <Check size={18} />
              </div>
              <div>
                <p className="mb-0 text-xs font-semibold">
                  Una nueva cita, sin un solo chat
                </p>
                <p className="mb-0 text-[10px] muted">
                  Tu página recibe reservas 24/7
                </p>
              </div>
            </div>
            <div className="absolute -bottom-1 right-5 rounded-xl border border-border bg-white p-5 shadow-[0_8px_40px_#30282b10]">
              <div className="mb-2 flex items-center gap-2 text-xs text-primary">
                <Sparkles size={15} /> TU PRÓXIMO CAPÍTULO
              </div>
              <p className="serif mb-0 text-xl">
                Una agenda con espacio para ti.
              </p>
            </div>
          </div>
        </section>
        <div className="border-y border-border py-5">
          <div className="page-width flex flex-wrap justify-center gap-x-12 gap-y-3 text-[11px] muted">
            <span>Reservas a cualquier hora</span>
            <span className="text-accent">✦</span>
            <span>Recordatorios automáticos</span>
            <span className="text-accent">✦</span>
            <span>Tu salón, tu estilo</span>
            <span className="text-accent">✦</span>
            <span>Todo en pesos colombianos</span>
          </div>
        </div>
        <section id="como-funciona" className="page-width py-24">
          <div className="mb-12 text-center">
            <p className="eyebrow text-primary">
              MENOS ADMINISTRAR, MÁS DISFRUTAR
            </p>
            <h2 className="text-4xl">
              Tu talento merece una agenda a su altura.
            </h2>
            <p className="muted">
              Deja atrás los mensajes perdidos, los cruces de horarios y el “se
              me olvidó”.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                icon: CalendarDays,
                title: "Reservar se vuelve fácil",
                text: "Comparte tu enlace. Tus clientas eligen servicio, profesional y horario en cuatro pasos.",
              },
              {
                icon: MessageCircle,
                title: "Tu agenda se hace escuchar",
                text: "Confirmaciones y recordatorios automáticos para que cada cita esté presente.",
              },
              {
                icon: Heart,
                title: "Conoce a cada clienta",
                text: "Su historial, sus servicios favoritos y su próxima visita, siempre a mano.",
              },
            ].map(({ icon: Icon, title, text }, i) => (
              <article key={title} className="card p-8">
                <div className="mb-8 flex justify-between">
                  <div className="grid size-12 place-items-center rounded-2xl bg-muted text-primary">
                    <Icon size={22} strokeWidth={1.3} />
                  </div>
                  <span
                    aria-hidden="true"
                    className="serif text-xl text-border"
                  >
                    0{i + 1}
                  </span>
                </div>
                <h3 className="serif text-2xl">{title}</h3>
                <p className="mb-0 text-sm leading-6 muted">{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="beneficios" className="bg-[#eee5e3] py-20">
          <div className="page-width grid items-center gap-12 md:grid-cols-2">
            <div className="relative aspect-[1.2] overflow-hidden rounded-2xl">
              <Image
                src="/images/nails.jpg"
                alt="Manicure con acabado profesional"
                fill
                sizes="50vw"
                className="object-cover"
              />
            </div>
            <div>
              <p className="eyebrow text-primary">
                TECNOLOGÍA CON UN TOQUE HUMANO
              </p>
              <h2 className="text-4xl">
                No necesitas saber de tecnología.
                <br />
                <em>Solo de lo que amas.</em>
              </h2>
              <p className="muted">
                Desde un pequeño nail studio hasta un equipo completo. GlowBook
                crece contigo y cada salón conserva su propia identidad.
              </p>
              <ul className="my-7 grid gap-3">
                {[
                  "Tu página con tus colores, servicios y precios",
                  "Agenda para cada profesional, sin cruces",
                  "Clientas e historial en un solo lugar",
                  "Cambios y cancelaciones sin llamadas",
                ].map((t) => (
                  <li className="flex items-center gap-3 text-sm" key={t}>
                    <Check size={16} className="text-primary" />
                    {t}
                  </li>
                ))}
              </ul>
              <Button asChild>
                <Link href="/demo">
                  Pruébalo con Nails & Glam <ArrowUpRight size={16} />
                </Link>
              </Button>
            </div>
          </div>
        </section>
        <section id="planes" className="page-width py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow text-primary">EMPECEMOS ALGO BONITO</p>
            <h2 className="text-4xl">El siguiente paso para tu salón.</h2>
            <p className="muted">
              Estamos preparando los planes de lanzamiento. Explora el demo
              completo y conversemos sobre lo que necesita tu negocio.
            </p>
          </div>
          <div className="card mx-auto mt-10 max-w-lg p-9">
            <div className="flex justify-between">
              <span className="serif text-2xl">GlowBook Esencial</span>
              <span className="badge">FASE DE LANZAMIENTO</span>
            </div>
            <p className="mt-6 text-3xl serif">Plan por confirmar</p>
            <p className="text-xs muted">
              Sin cobros ni suscripciones activas en el demo.
            </p>
            <ul className="my-7 space-y-3">
              {[
                "Página pública y reservas ilimitadas en el MVP",
                "Agenda, servicios, equipo y clientas",
                "Automatizaciones por correo y WhatsApp*",
                "Configuración y acompañamiento inicial",
              ].map((t) => (
                <li className="flex gap-3 text-sm" key={t}>
                  <Check size={16} />
                  {t}
                </li>
              ))}
            </ul>
            {sales ? (
              <Button asChild className="w-full">
                <a
                  href={`https://wa.me/${sales}?text=${encodeURIComponent("¡Hola! Quiero GlowBook para mi salón.")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Lo quiero para mi salón <ArrowUpRight size={16} />
                </a>
              </Button>
            ) : (
              <Button asChild className="w-full">
                <Link href="/demo">
                  Explorar el demo <ArrowRight size={16} />
                </Link>
              </Button>
            )}
            <p className="mb-0 mt-4 text-[10px] muted">
              *Requiere configuración del remitente y plantillas aprobadas por
              Meta. Las tarifas de los proveedores se cotizan por separado.
            </p>
          </div>
        </section>
      </main>
      <footer className="border-t border-border py-8">
        <div className="page-width flex flex-wrap items-center justify-between gap-5">
          <Brand small />
          <p className="mb-0 text-xs muted">
            Hecho con cariño para los negocios de belleza en Colombia.
          </p>
          <Link href="/privacidad" className="text-xs muted">
            Privacidad
          </Link>
        </div>
      </footer>
    </>
  );
}
