"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main id="contenido" className="mx-auto max-w-lg px-6 py-20">
      <h1 className="text-4xl">Algo interrumpió este momento.</h1>
      <p className="muted">
        No pudimos cargar la página. Puedes intentar nuevamente.
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </main>
  );
}
