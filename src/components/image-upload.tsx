"use client";
import { useState } from "react";
import { Button } from "./ui/button";
export function ImageUpload() {
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  async function upload(form: FormData) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/images", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la imagen.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form action={upload} className="space-y-4">
      <p className="text-xs muted">
        Carga una foto y copia su URL en el logo, portada, servicio o
        profesional. Máximo 4 MB; JPG, PNG o WebP.
      </p>
      <label>
        Archivo
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
      </label>
      <Button size="sm" disabled={pending}>
        {pending ? "Cargando…" : "Cargar imagen"}
      </Button>
      {url && (
        <label>
          URL de tu imagen
          <input readOnly value={url} onFocus={(e) => e.target.select()} />
        </label>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
