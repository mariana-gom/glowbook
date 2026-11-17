import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { salonData } from "@/lib/data";
import { BookingWizard } from "@/components/booking-wizard";
import { dayKey } from "@/lib/utils";
import { Brand } from "@/components/brand";
export default async function Reserve({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ servicio?: string; profesional?: string }>;
}) {
  const { slug } = await params,
    q = await searchParams,
    d = await salonData(slug);
  if (!d) notFound();
  const today = dayKey();
  const lastDay = dayKey(
    new Date(
      +new Date(`${today}T12:00:00-05:00`) +
        d.salon.settings.bookingDays * 86400000,
    ),
  );
  return (
    <div
      style={
        {
          "--salon-primary": d.salon.primaryColor,
          "--salon-accent": d.salon.accentColor,
        } as CSSProperties
      }
    >
      <header className="page-width flex h-24 items-center justify-between border-b border-border">
        <Brand small />
        <Link
          href={`/${slug}`}
          className="flex items-center gap-2 text-xs muted"
        >
          <ArrowLeft size={13} />
          Volver al salón
        </Link>
      </header>
      <main id="contenido" className="page-width py-10">
        {d.demo && (
          <p className="mb-7 rounded-lg bg-muted px-4 py-3 text-xs text-primary">
            DEMO · Prueba el recorrido. No se guardarán datos ni se enviarán
            mensajes.
          </p>
        )}
        <BookingWizard
          salon={d.salon}
          services={d.services.filter((s) => s.active)}
          categories={d.categories}
          staff={d.staff.filter((s) => s.active)}
          skills={d.staffServices}
          demo={d.demo}
          today={today}
          lastDay={lastDay}
          initialService={q.servicio}
          initialStaff={q.profesional}
        />
      </main>
    </div>
  );
}
