import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { salonData } from "@/lib/data";
import { money } from "@/lib/utils";
import { Button } from "@/components/ui/button";
export default async function SalonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const d = await salonData(slug);
  if (!d) notFound();
  const { salon, services, staff, categories, reviews, gallery, demo } = d;
  const settings = salon.settings;
  const rating = reviews.length
    ? (reviews.reduce((n, r) => n + r.rating, 0) / reviews.length).toFixed(1)
    : null;
  return (
    <div
      style={
        {
          "--salon-primary": salon.primaryColor,
          "--salon-accent": salon.accentColor,
        } as CSSProperties
      }
    >
      {demo && (
        <div className="bg-primary py-2 text-center text-[10px] tracking-wider text-white">
          ESTÁS EXPLORANDO UN SALÓN DEMO ·{" "}
          <Link href="/demo" className="underline underline-offset-4">
            Cambiar experiencia
          </Link>
        </div>
      )}
      <header className="page-width flex h-23 items-center justify-between gap-5">
        <Link href={`/${slug}`} className="flex items-center gap-3">
          <span className="grid size-10 place-items-center overflow-hidden rounded-full border border-accent text-accent">
            {salon.logoUrl ? (
              <Image
                src={salon.logoUrl}
                alt=""
                width={40}
                height={40}
                className="size-10 object-cover"
              />
            ) : (
              <Sparkles size={20} />
            )}
          </span>
          <span className="serif text-xl md:text-2xl">{salon.name}</span>
        </Link>
        <nav className="hidden gap-7 text-xs md:flex">
          <a href="#servicios">Servicios</a>
          <a href="#equipo">Nuestro equipo</a>
          <a href="#experiencias">Experiencias</a>
        </nav>
        <Button asChild size="sm">
          <Link href={`/${slug}/reservar`}>
            Reservar <ArrowUpRight size={14} />
          </Link>
        </Button>
      </header>
      <main id="contenido">
        <section className="page-width grid items-center gap-8 pb-14 pt-5 md:grid-cols-2">
          <div className="py-8">
            <p className="eyebrow mb-6 text-primary">
              TU MOMENTO, TU BRILLO · {settings.city}
            </p>
            <h1 className="mb-6 text-5xl tracking-[-.03em] md:text-[68px]">
              Un momento para ti.
              <br />
              <em className="text-primary">Un brillo que se queda.</em>
            </h1>
            <p className="mb-8 max-w-md text-base leading-7 muted">
              {settings.description}
            </p>
            <Button asChild size="lg">
              <Link href={`/${slug}/reservar`}>
                Reserva tu momento <ArrowRight size={17} />
              </Link>
            </Button>
            <div className="mt-8 flex flex-wrap items-center gap-5 text-xs muted">
              {rating && (
                <span className="flex items-center gap-1.5">
                  <Star size={14} fill="currentColor" className="text-accent" />
                  <strong className="text-foreground">{rating}</strong> ·{" "}
                  {reviews.length} reseñas
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <MapPin size={13} />
                {settings.city}
              </span>
            </div>
          </div>
          <div className="relative aspect-[1.05] overflow-hidden rounded-t-[120px] rounded-b-2xl">
            <Image
              src={settings.heroUrl || "/images/salon.jpg"}
              alt={`El espacio de ${salon.name}`}
              fill
              loading="eager"
              fetchPriority="high"
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
            <span className="absolute bottom-5 left-5 flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-[11px]">
              <ShieldCheck size={14} className="text-primary" />
              Detalles que cuidan de ti
            </span>
          </div>
        </section>
        <section
          id="servicios"
          className="border-t border-border bg-white py-20"
        >
          <div className="page-width">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow text-primary">ELIGE CÓMO CONSENTIRTE</p>
                <h2 className="mb-0 text-4xl">
                  Un ritual para cada versión de ti.
                </h2>
              </div>
              <span className="text-xs muted">
                Precios en pesos colombianos
              </span>
            </div>
            <nav className="mb-10 flex gap-2 overflow-x-auto pb-2">
              {categories.map((c) => (
                <a
                  href={`#categoria-${c.id}`}
                  key={c.id}
                  className="shrink-0 rounded-full border border-border px-5 py-2 text-xs hover:border-primary hover:text-primary"
                >
                  {c.name}
                </a>
              ))}
            </nav>
            <div className="grid items-start gap-x-12 gap-y-10 md:grid-cols-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  id={`categoria-${category.id}`}
                  className="scroll-mt-6"
                >
                  <h3 className="serif mb-2 text-2xl text-primary">
                    {category.name}
                  </h3>
                  {services
                    .filter((s) => s.active && s.categoryId === category.id)
                    .map((s) => (
                      <Link
                        href={`/${slug}/reservar?servicio=${s.id}`}
                        key={s.id}
                        className="group flex items-center justify-between gap-3 border-b border-border py-5"
                      >
                        <div>
                          <p className="mb-1 text-sm font-medium group-hover:text-primary">
                            {s.name}
                          </p>
                          <span className="flex items-center gap-1 text-[11px] muted">
                            <Clock3 size={11} />
                            {s.duration} min
                          </span>
                        </div>
                        <div className="flex items-center gap-5">
                          <span className="text-sm">{money(s.price)}</span>
                          <span className="grid size-8 place-items-center rounded-full bg-muted transition group-hover:bg-primary group-hover:text-white">
                            <ArrowUpRight size={14} />
                          </span>
                        </div>
                      </Link>
                    ))}
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="page-width py-20">
          <p className="eyebrow text-primary">BELLEZA EN LOS DETALLES</p>
          <div className="mb-9 flex justify-between">
            <h2 className="text-4xl">Un poco de nuestra magia.</h2>
            <a
              href={settings.instagram}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-2 text-xs sm:flex"
            >
              Síguenos en Instagram <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {gallery.map((p) => (
              <figure key={p.id} className="m-0">
                <div className="relative aspect-[.83] overflow-hidden rounded-xl">
                  <Image
                    src={p.url}
                    alt={p.caption}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover transition duration-500 hover:scale-105"
                  />
                </div>
                <figcaption className="mt-3 text-xs muted">
                  {p.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
        <section id="equipo" className="bg-[#f1e9e6] py-20">
          <div className="page-width">
            <div className="mb-10 text-center">
              <p className="eyebrow text-primary">
                MANOS EXPERTAS, CORAZONES BONITOS
              </p>
              <h2 className="text-4xl">Conoce a quienes te harán brillar.</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              {staff
                .filter((p) => p.active)
                .map((p) => (
                  <article key={p.id} className="card p-8 text-center">
                    <Image
                      src={p.photoUrl || "/images/beauty.jpg"}
                      alt={p.name}
                      width={96}
                      height={96}
                      className="mx-auto mb-6 size-24 rounded-full object-cover"
                    />
                    <h3 className="serif mb-2 text-2xl">{p.name}</h3>
                    <p className="text-xs muted">{p.title}</p>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/${slug}/reservar?profesional=${p.id}`}>
                        Reservar conmigo
                      </Link>
                    </Button>
                  </article>
                ))}
            </div>
          </div>
        </section>
        <section id="experiencias" className="page-width py-20">
          <p className="eyebrow text-primary">LO QUE SE LLEVAN DE AQUÍ</p>
          <h2 className="mb-10 text-4xl">Más que belleza, una experiencia.</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {reviews.slice(0, 3).map((r) => (
              <article key={r.id} className="card p-7">
                <div className="mb-5 flex gap-1 text-accent">
                  {Array.from({ length: r.rating }, (_, i) => (
                    <Star key={i} size={13} fill="currentColor" />
                  ))}
                </div>
                <p className="serif text-xl leading-relaxed">“{r.comment}”</p>
                <p className="mb-0 mt-6 text-xs font-medium">{r.author}</p>
                <p className="mb-0 text-[10px] muted">
                  Visita verificada{demo ? " · demo" : ""}
                </p>
              </article>
            ))}
            {!reviews.length && (
              <p className="muted">
                Tu experiencia puede ser la primera. ¡Te esperamos!
              </p>
            )}
          </div>
        </section>
        <section className="page-width pb-20">
          <div className="grid overflow-hidden rounded-2xl bg-primary text-white md:grid-cols-2">
            <div className="p-9 md:p-14">
              <p className="eyebrow opacity-70">NOS VEMOS PRONTO</p>
              <h2 className="text-4xl">
                Tu próxima pausa
                <br />
                está aquí.
              </h2>
              <p className="mb-1 text-sm opacity-85">{settings.address}</p>
              <p className="mb-7 text-sm opacity-85">
                {settings.city}, Colombia
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline" className="text-primary">
                  <a href={settings.mapsUrl} target="_blank" rel="noreferrer">
                    <MapPin size={15} />
                    Cómo llegar
                  </a>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="border border-white/30 hover:bg-white/10"
                >
                  <a
                    href={buildWhatsAppLink(
                      settings.whatsapp,
                      "Hola, quiero información sobre {salon}.",
                      { salon: salon.name },
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={15} />
                    Escríbenos
                  </a>
                </Button>
              </div>
            </div>
            <div className="relative min-h-64">
              <Image
                src="/images/nails.jpg"
                alt="Manicure y cuidado de manos"
                fill
                sizes="50vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-border py-7">
        <div className="page-width flex flex-wrap justify-between gap-4 text-[11px] muted">
          <span>{salon.name} · Belleza con intención.</span>
          <Link href="/">
            Reservas con{" "}
            <span className="serif text-base text-foreground">glowbook.</span>
          </Link>
          <Link href="/privacidad">Tratamiento de datos</Link>
        </div>
      </footer>
    </div>
  );
}
