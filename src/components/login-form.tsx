"use client";
import { useState, useTransition } from "react";
import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { exitDemo } from "@/app/actions/session";
import { Button } from "./ui/button";
export function LoginForm({
  google,
  configured,
}: {
  google: boolean;
  configured: boolean;
}) {
  const router = useRouter(),
    [pending, start] = useTransition(),
    [error, setError] = useState("");
  const client = createAuthClient();
  function submit(form: FormData) {
    setError("");
    start(async () => {
      try {
        const result = await client.signIn.email({
          email: String(form.get("email")),
          password: String(form.get("password")),
        });
        if (result.error)
          setError(
            "No pudimos iniciar sesión. Verifica el correo y la contraseña.",
          );
        else {
          await exitDemo();
          router.push("/panel");
          router.refresh();
        }
      } catch {
        setError("No fue posible conectarse. Intenta nuevamente.");
      }
    });
  }
  return (
    <div>
      <form action={submit} className="space-y-5">
        <label>
          Correo electrónico
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="tu@salon.com"
          />
        </label>
        <label>
          Contraseña
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        <Button
          type="submit"
          className="w-full"
          disabled={!configured || pending}
        >
          {pending ? "Ingresando…" : "Entrar a mi salón"}
        </Button>
      </form>
      {google && (
        <Button
          variant="outline"
          className="mt-3 w-full"
          disabled={pending}
          onClick={() => {
            start(async () => {
              await exitDemo();
              const result = await client.signIn.social({
                provider: "google",
                callbackURL: "/panel",
              });
              if (result.error) setError("No fue posible ingresar con Google.");
            });
          }}
        >
          Continuar con Google
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-5 text-sm text-red-700">
          {error}
        </p>
      )}
      {!configured && (
        <p className="mt-4 text-xs muted">
          El acceso real estará disponible al configurar Neon y la
          autenticación. Puedes explorar el demo mientras tanto.
        </p>
      )}
    </div>
  );
}
