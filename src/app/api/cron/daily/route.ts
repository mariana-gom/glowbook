import { validCron } from "@/lib/cron";
// La Fase 2 se habilita solo después de validar el MVP y el consentimiento de campañas.
export async function GET(request: Request) {
  if (!validCron(request))
    return Response.json({ error: "No autorizado" }, { status: 401 });
  return Response.json({
    phase: 1,
    campaignsEnabled: false,
    message: "Reactivación, cumpleaños y mantenimiento pendientes de Fase 2.",
  });
}
