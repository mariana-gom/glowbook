import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main id="contenido" className="mx-auto max-w-lg px-6 py-16">
      <Brand />
      <p className="eyebrow mt-16 text-primary">NO ENCONTRAMOS ESTE ESPACIO</p>
      <h1 className="text-4xl">Busquemos tu próximo momento.</h1>
      <p className="muted">
        El enlace no existe o el salón no está disponible. Si tenías una cita,
        contacta directamente al salón.
      </p>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
