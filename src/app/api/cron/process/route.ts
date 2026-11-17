import { validCron } from "@/lib/cron";
import { processMessages } from "@/lib/messages";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!validCron(request))
    return Response.json({ error: "No autorizado" }, { status: 401 });
  return Response.json(await processMessages());
}
export const POST = GET;
