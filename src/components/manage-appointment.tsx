"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { manageBooking } from "@/app/actions/booking";
export function ManageAppointment({
  token,
  canChange,
  completed,
}: {
  token: string;
  canChange: boolean;
  completed: boolean;
}) {
  const router = useRouter(),
    [pending, start] = useTransition(),
    [message, setMessage] = useState(""),
    [cancel, setCancel] = useState(false);
  function submit(action: "cancel" | "reschedule" | "review", form?: FormData) {
    setMessage("");
    start(async () => {
      const result = await manageBooking(token, action, {
        startsAt: form?.get("date")
          ? new Date(
              `${form.get("date")}T${form.get("time")}:00-05:00`,
            ).toISOString()
          : undefined,
        rating: Number(form?.get("rating")),
        comment: String(form?.get("comment") ?? ""),
      });
      setMessage(
        result.error ??
          (action === "review"
            ? "Gracias. Tu reseña quedó pendiente de publicación."
            : "Tu cambio quedó guardado."),
      );
      router.refresh();
    });
  }
  return (
    <div className="space-y-6">
      {canChange && (
        <>
          <details className="card p-5">
            <summary className="text-sm font-medium">
              Reprogramar mi cita
            </summary>
            <p className="mt-4 text-xs muted">
              Selecciona la nueva fecha y hora de Bogotá. Se verificará la
              disponibilidad antes de guardar.
            </p>
            <form action={(f) => submit("reschedule", f)} className="space-y-4">
              <div className="field-grid">
                <label>
                  Nueva fecha
                  <input type="date" name="date" required />
                </label>
                <label>
                  Nueva hora
                  <input type="time" name="time" step={900} required />
                </label>
              </div>
              <Button disabled={pending} type="submit">
                Guardar nuevo horario
              </Button>
            </form>
          </details>
          <div className="card p-5">
            {cancel ? (
              <>
                <p className="text-sm">
                  ¿Confirmas que quieres cancelar tu cita?
                </p>
                <div className="flex gap-3">
                  <Button disabled={pending} onClick={() => submit("cancel")}>
                    Sí, cancelar cita
                  </Button>
                  <Button variant="outline" onClick={() => setCancel(false)}>
                    Conservar cita
                  </Button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setCancel(true)}
                className="text-sm text-primary underline underline-offset-4"
              >
                Cancelar mi cita
              </button>
            )}
          </div>
        </>
      )}
      {completed && (
        <form
          action={(f) => submit("review", f)}
          className="card space-y-5 p-6"
        >
          <h2 className="text-2xl">¿Cómo estuvo tu experiencia?</h2>
          <label>
            Calificación
            <select name="rating" required defaultValue="5">
              {[5, 4, 3, 2, 1].map((n) => (
                <option value={n} key={n}>
                  {n} estrellas
                </option>
              ))}
            </select>
          </label>
          <label>
            Tu reseña
            <textarea
              name="comment"
              minLength={10}
              maxLength={1000}
              required
              placeholder="Cuéntanos qué te gustó…"
            />
          </label>
          <Button disabled={pending}>Enviar reseña</Button>
        </form>
      )}
      {message && (
        <p role="status" className="rounded-lg bg-muted p-4 text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
