"use client";
import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { unsubscribePush } from "@/app/actions/push";
export function LogoutButton({ action }: { action: () => Promise<void> }) {
  const [pending, start] = useTransition(),
    [error, setError] = useState("");
  function logout() {
    start(async () => {
      try {
        if ("serviceWorker" in navigator && "PushManager" in window) {
          const registration =
              await navigator.serviceWorker.getRegistration("/"),
            subscription = await registration?.pushManager.getSubscription();
          if (subscription) {
            const result = await unsubscribePush(subscription.endpoint);
            if (result.error) throw new Error(result.error);
            await subscription.unsubscribe();
          }
        }
        await action();
      } catch {
        setError("No pudimos cerrar la sesión. Intenta nuevamente.");
      }
    });
  }
  return (
    <div>
      <button
        type="button"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        onClick={logout}
        disabled={pending}
        className="p-2 muted"
      >
        <LogOut size={14} />
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
