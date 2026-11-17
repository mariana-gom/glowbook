import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, Heart } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
async function enter() {
  "use server";
  (await cookies()).set("glowbook-demo", "owner", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 86400,
    path: "/",
  });
  redirect("/panel");
}
export default function Demo() {
  return (
    <main id="contenido" className="min-h-screen">
      <header className="page-width py-7">
        <Brand />
      </header>
      <div className="page-width grid items-center gap-12 py-12 md:grid-cols-2">
        <div className="relative hidden aspect-[.9] overflow-hidden rounded-t-full rounded-b-2xl md:block">
          <Image
            src="/images/salon.jpg"
            alt="Salón de demostración"
            fill
            className="object-cover"
            sizes="50vw"
          />
        </div>
        <div className="max-w-lg">
          <p className="eyebrow text-primary">BIENVENIDA A TU PRÓXIMA ETAPA</p>
          <h1 className="text-5xl">
            Un pequeño vistazo.
            <br />
            <em className="text-primary">Muchas posibilidades.</em>
          </h1>
          <p className="mb-8 leading-7 muted">
            Conoce Nails & Glam Studio, nuestro salón de ejemplo. Elige cómo
            quieres vivir la experiencia.
          </p>
          <form action={enter}>
            <button className="card mb-4 flex w-full items-center gap-5 p-6 text-left transition hover:border-primary">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-primary">
                <CalendarDays />
              </span>
              <span>
                <strong className="block text-sm">Soy dueña de salón</strong>
                <span className="text-xs muted">
                  Explora la agenda, el equipo y tus clientas
                </span>
              </span>
              <ArrowRight className="ml-auto shrink-0" size={18} />
            </button>
          </form>
          <Link
            href="/nails-glam-studio"
            className="card flex items-center gap-5 p-6 transition hover:border-primary"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-primary">
              <Heart />
            </span>
            <span>
              <strong className="block text-sm">
                Quiero reservar una cita
              </strong>
              <span className="text-xs muted">
                Descubre el salón y prueba una reserva
              </span>
            </span>
            <ArrowRight className="ml-auto shrink-0" size={18} />
          </Link>
          <p className="mt-6 text-xs muted">
            Demo con datos ficticios. Las reservas se simulan y el panel es de
            solo lectura.
          </p>
          <Button asChild variant="ghost">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
