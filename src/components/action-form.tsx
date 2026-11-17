"use client";
import { useActionState } from "react";
import { savePanel, saveAdmin } from "@/app/actions/panel";
import { Button } from "./ui/button";
export function ActionForm({
  children,
  kind,
  id,
  admin = false,
  submit = "Guardar cambios",
  className = "space-y-5",
}: {
  children: React.ReactNode;
  kind: string;
  id?: string;
  admin?: boolean;
  submit?: string;
  className?: string;
}) {
  const [state, action, pending] = useActionState(
    admin ? saveAdmin : savePanel,
    {},
  );
  return (
    <form action={action} className={className}>
      <input type="hidden" name="kind" value={kind} />
      {id && <input type="hidden" name="id" value={id} />} {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? "Guardando…" : submit}
        </Button>
        {state.error && (
          <p role="alert" className="mb-0 max-w-lg text-xs text-red-700">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="mb-0 text-xs text-green-800">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
