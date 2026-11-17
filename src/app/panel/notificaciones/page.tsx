import { panelAccess } from "@/lib/access";
import { pushConfigured } from "@/lib/push";
import { PwaSettings } from "@/components/pwa-settings";
export default async function Notifications() {
  const access = await panelAccess();
  return (
    <>
      <p className="eyebrow text-primary">TU SALÓN, CONTIGO</p>
      <h1 className="text-4xl">La agenda también va en tu celular.</h1>
      <p className="mb-8 text-sm muted">
        Instala la aplicación y elige si quieres recibir avisos en este
        dispositivo.
      </p>
      <PwaSettings configured={pushConfigured()} demo={access.demo} />
    </>
  );
}
