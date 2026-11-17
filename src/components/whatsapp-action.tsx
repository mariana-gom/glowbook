"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Check } from "lucide-react";
import { openTaskWhatsApp } from "@/app/actions/whatsapp";
import { Button } from "./ui/button";
type Input =
  | { taskId: string }
  | { appointmentId: string; kind: "confirmation" | "reminder24" | "thanks" };
export function WhatsAppAction({
  input,
  label,
  disabled = false,
  marked = false,
}: {
  input: Input;
  label: string;
  disabled?: boolean;
  marked?: boolean;
}) {
  const [pending, start] = useTransition(),
    [done, setDone] = useState(false),
    [error, setError] = useState(""),
    router = useRouter();
  function open() {
    // Abre la pestaña desde el gesto para que los navegadores móviles no bloqueen el chat.
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    setError("");
    start(async () => {
      try {
        const result = await openTaskWhatsApp(input);
        if (!result.url) {
          popup?.close();
          setError(result.error ?? "No fue posible abrir WhatsApp.");
          return;
        }
        setDone(true);
        if (popup) popup.location.replace(result.url);
        else window.location.assign(result.url);
        if (!result.demo) router.refresh();
      } catch {
        popup?.close();
        setError("No se marcó el pendiente. Intenta nuevamente.");
      }
    });
  }
  return (
    <div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={open}
        disabled={disabled || pending || done || marked}
        className="!h-9 !px-3 !text-[10px]"
      >
        {done || marked ? <Check size={12} /> : <MessageCircle size={12} />}{" "}
        {done || marked ? "Marcado enviado" : pending ? "Preparando…" : label}
      </Button>
      {error && (
        <p role="alert" className="mb-0 mt-2 max-w-64 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
