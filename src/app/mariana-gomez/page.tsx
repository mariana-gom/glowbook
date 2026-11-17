import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Code2 } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { developer } from "@/lib/credits";

export const metadata: Metadata = {
  title: "Mariana Gomez · Diseño y desarrollo",
  description:
    "Créditos de autoría de GlowBook: diseño y desarrollo por Mariana Gomez.",
};

export default function AuthorPage() {
  return (
    <main id="contenido" className="page-width py-10">
      <Brand />
      <section className="mx-auto max-w-2xl py-16 sm:py-24">
        <span className="mb-7 grid size-14 place-items-center rounded-2xl bg-muted text-primary">
          <Code2 size={25} strokeWidth={1.4} />
        </span>
        <p className="eyebrow text-primary">DETRÁS DE GLOWBOOK</p>
        <h1 className="mb-5 text-5xl sm:text-6xl">{developer.name}</h1>
        <p className="serif mb-6 text-2xl text-primary">
          Diseño y desarrollo de GlowBook.
        </p>
        <p className="mb-8 max-w-xl text-base leading-7 muted">
          Una plataforma para que los salones de belleza en Colombia organicen
          sus reservas, cuiden a sus clientas y encuentren más espacio para
          crecer.
        </p>
        <div className="card mb-8 p-6">
          <p className="mb-1 text-sm font-medium">Créditos de desarrollo</p>
          <p className="mb-0 text-sm muted">
            GlowBook · Desarrollado por {developer.name}.
          </p>
        </div>
        <Button asChild>
          <Link href="/demo">
            Conoce la aplicación <ArrowRight size={16} />
          </Link>
        </Button>
      </section>
    </main>
  );
}
