"use server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { database } from "@/db";
import * as S from "@/db/schema";
import { tenant } from "@/db/tenant";
import { panelAccess } from "@/lib/access";
import { demoData } from "@/lib/demo";
import {
  demoFollowUps,
  ensureAppointmentTasks,
  taskWhatsApp,
} from "@/lib/follow-ups";
import {
  appointmentWhatsAppData,
  publicOrigin,
} from "@/lib/appointment-contact";
import { defaultWhatsAppMessages, sendWhatsApp } from "@/lib/whatsapp";
const inputSchema = z.union([
  z.object({ taskId: z.uuid() }),
  z.object({
    appointmentId: z.uuid(),
    kind: z.enum(["confirmation", "reminder24", "thanks"]),
  }),
]);
export async function openTaskWhatsApp(
  input: z.infer<typeof inputSchema>,
): Promise<{ url?: string; error?: string; demo?: boolean }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "Acción inválida." };
  const access = await panelAccess();
  if (access.demo) {
    const d = demoData(),
      q = parsed.data,
      lookup =
        "taskId" in q ? demoFollowUps().find((t) => t.id === q.taskId) : null;
    const kind =
        lookup?.kind ?? ("kind" in parsed.data ? parsed.data.kind : null),
      a = d.appointments.find(
        (a) =>
          a.id ===
          (lookup?.appointmentId ??
            ("appointmentId" in parsed.data
              ? parsed.data.appointmentId
              : null)),
      );
    const client = d.clients.find(
      (c) => c.id === (lookup?.clientId ?? a?.clientId),
    );
    if (!kind || !client)
      return {
        error: "Este pendiente ya no aparece en el demo. Actualiza la página.",
      };
    const link = `${publicOrigin()}/${d.salon.slug}/reservar`;
    const data = a
      ? appointmentWhatsAppData(
          d.salon,
          a,
          d.appointmentServices
            .filter((s) => s.appointmentId === a.id)
            .map((s) => s.name),
          d.staff.find((p) => p.id === a.staffId)?.name ?? "Tu profesional",
          "demo",
        )
      : {
          nombre: client.name,
          salon: d.salon.name,
          servicio: "",
          fecha: "",
          hora: "",
          profesional: "",
          codigo: "",
        };
    return {
      url: sendWhatsApp(client.phone, defaultWhatsAppMessages[kind], {
        ...data,
        enlace_reprogramar: link,
        enlace: link,
      }).url,
      demo: true,
    };
  }
  const { db, close } = database(),
    t = tenant(access.salonId);
  try {
    const url = await db.transaction(async (tx) => {
      const [salon] = await tx
        .select()
        .from(S.salons)
        .where(eq(S.salons.id, t.id));
      if (!salon?.active) throw new Error("Salón no disponible.");
      let task: typeof S.followUpTasks.$inferSelect | undefined;
      if ("appointmentId" in parsed.data) {
        const q = parsed.data;
        const [a] = await tx
          .select()
          .from(S.appointments)
          .where(
            t.where(
              S.appointments,
              eq(S.appointments.id, q.appointmentId),
              access.role === "staff"
                ? eq(S.appointments.staffId, access.staffId!)
                : undefined,
            ),
          )
          .for("update");
        if (!a) throw new Error("Cita no disponible.");
        await ensureAppointmentTasks(tx, a);
        [task] = await tx
          .select()
          .from(S.followUpTasks)
          .where(
            t.where(
              S.followUpTasks,
              eq(S.followUpTasks.dedupeKey, `${a.id}:${a.version}:${q.kind}`),
            ),
          )
          .for("update");
      } else {
        // Se bloquea primero la cita y después el pendiente, igual que al reprogramar.
        const [lookup] = await tx
          .select()
          .from(S.followUpTasks)
          .where(
            t.where(
              S.followUpTasks,
              eq(S.followUpTasks.id, parsed.data.taskId),
            ),
          );
        if (!lookup) throw new Error("Pendiente no disponible.");
        if (access.role !== "owner")
          throw new Error("Solo la dueña puede gestionar estos pendientes.");
        if (lookup.appointmentId)
          await tx
            .select()
            .from(S.appointments)
            .where(
              t.where(
                S.appointments,
                eq(S.appointments.id, lookup.appointmentId),
              ),
            )
            .for("update");
        [task] = await tx
          .select()
          .from(S.followUpTasks)
          .where(t.where(S.followUpTasks, eq(S.followUpTasks.id, lookup.id)))
          .for("update");
      }
      if (!task || task.status === "dismissed")
        throw new Error("Este pendiente ya no aplica. Actualiza la página.");
      const link = await taskWhatsApp(tx, salon, task);
      await tx
        .update(S.followUpTasks)
        .set({
          status: "marked_sent",
          markedAt: new Date(),
          markedBy: access.userId,
        })
        .where(
          t.where(
            S.followUpTasks,
            eq(S.followUpTasks.id, task.id),
            eq(S.followUpTasks.status, "pending"),
          ),
        );
      return link;
    });
    revalidatePath("/panel", "layout");
    return { url };
  } catch (e) {
    return {
      error:
        e instanceof Error && !/SQL|query|constraint/i.test(e.message)
          ? e.message
          : "No fue posible preparar el mensaje.",
    };
  } finally {
    await close();
  }
}
