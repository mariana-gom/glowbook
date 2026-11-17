"use client";
import { useEffect, useState } from "react";
import { Bell, Download, Check } from "lucide-react";
import { subscribePush, unsubscribePush } from "@/app/actions/push";
import { Button } from "./ui/button";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
export function PwaSettings({
  configured,
  demo,
}: {
  configured: boolean;
  demo: boolean;
}) {
  const [supported, setSupported] = useState<boolean | null>(null),
    [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [install, setInstall] = useState<InstallEvent | null>(null),
    [installed, setInstalled] = useState(false);
  useEffect(() => {
    let alive = true;
    async function initialize() {
      const installed =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      if (!("serviceWorker" in navigator))
        return { supported: false, enabled: false, installed };
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      const supported = "PushManager" in window && "Notification" in window;
      return {
        supported,
        enabled:
          supported &&
          Boolean(await registration.pushManager.getSubscription()),
        installed,
      };
    }
    initialize()
      .then((state) => {
        if (alive) {
          setSupported(state.supported);
          setEnabled(state.enabled);
          setInstalled(state.installed);
        }
      })
      .catch(() => {
        if (alive) {
          setSupported(false);
          setMessage(
            "No pudimos preparar las notificaciones en este navegador.",
          );
        }
      });
    const listener = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstall(null);
    };
    window.addEventListener("beforeinstallprompt", listener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      alive = false;
      window.removeEventListener("beforeinstallprompt", listener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  async function enable() {
    if (!supported || demo || !configured) return;
    setBusy(true);
    setMessage("");
    try {
      // La solicitud nace del toque, requisito de Safari y de los demás navegadores.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage(
          "El permiso no se concedió. Puedes habilitarlo desde los ajustes del sitio en tu navegador.",
        );
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const base64 = (key + "=".repeat((4 - (key.length % 4)) % 4))
        .replaceAll("-", "+")
        .replaceAll("_", "/");
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes.buffer,
        }));
      const result = await subscribePush(subscription.toJSON());
      if (result.error) {
        await subscription.unsubscribe();
        throw new Error(result.error);
      }
      setEnabled(true);
      setMessage("Listo. Este dispositivo recibirá novedades de tu salón.");
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "No fue posible activar las notificaciones.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready,
        subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const result = await unsubscribePush(subscription.endpoint);
        if (result.error) throw new Error(result.error);
        await subscription.unsubscribe();
      }
      setEnabled(false);
      setMessage("Notificaciones desactivadas en este dispositivo.");
    } catch {
      setMessage("No pudimos desactivarlas. Intenta nuevamente.");
    } finally {
      setBusy(false);
    }
  }
  async function installApp() {
    if (!install) return;
    await install.prompt();
    const choice = await install.userChoice;
    if (choice.outcome === "accepted") setInstall(null);
  }
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="card p-7">
        <Download className="mb-5 text-primary" />
        <h2 className="text-2xl">Tu agenda, a un toque.</h2>
        <p className="text-sm muted">
          Instala GlowBook como aplicación desde tu navegador. No necesitas una
          tienda de aplicaciones.
        </p>
        {installed ? (
          <p className="flex gap-2 text-sm text-primary">
            <Check size={16} />
            Ya estás usando la aplicación instalada.
          </p>
        ) : install ? (
          <Button onClick={installApp}>Instalar GlowBook</Button>
        ) : (
          <p className="rounded-xl bg-muted p-4 text-xs">
            En iPhone: Compartir → Agregar a Inicio. En Android o computador:
            menú del navegador → Instalar aplicación o Agregar a pantalla de
            inicio.
          </p>
        )}
      </section>
      <section className="card p-7">
        <Bell className="mb-5 text-primary" />
        <h2 className="text-2xl">Entérate de cada cambio.</h2>
        <p className="text-sm muted">
          Recibe avisos cuando entra, se reprograma o se cancela una cita. Cada
          profesional recibe solo los de su agenda.
        </p>
        <Button
          disabled={busy || !supported || demo || !configured}
          onClick={enabled ? disable : enable}
        >
          {busy
            ? "Actualizando…"
            : enabled
              ? "Desactivar en este dispositivo"
              : "Activar notificaciones"}
        </Button>
        <p className="mt-4 text-xs muted">
          {demo
            ? "El demo no registra ni envía notificaciones reales."
            : !configured
              ? "La administradora todavía no ha habilitado este servicio."
              : supported === false
                ? "Este navegador no admite notificaciones push."
                : "En iPhone, instala la aplicación y ábrela desde su icono antes de activarlas."}
        </p>
        <p className="text-xs muted">
          Los avisos no muestran nombres ni datos de clientas en la pantalla
          bloqueada. Necesitas conexión para abrir la agenda.
        </p>
        {message && (
          <p
            role="status"
            className="mb-0 mt-4 rounded-xl bg-muted p-4 text-sm"
          >
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
