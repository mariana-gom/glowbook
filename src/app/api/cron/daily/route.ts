import { validCron } from "@/lib/cron";
import { processDaily } from "@/lib/daily";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!validCron(request))
    return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!process.env.DATABASE_URL)
    return Response.json(
      { error: "Configura Neon para ejecutar el cron." },
      { status: 503 },
    );
  return Response.json(await processDaily());
}
export const POST = GET;
