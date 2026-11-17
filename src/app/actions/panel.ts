"use server";
import { after } from "next/server";
import {
  ensureAppointmentTasks,
  invalidateAppointmentTasks,
} from "@/lib/follow-ups";
import { enqueueTeamNotifications } from "@/lib/notification-builders";
import { flushMessages } from "@/lib/messages";
import {
  defaultWhatsAppMessages,
  validateTemplate,
  normalizeColombianPhone,
} from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, inArray, sql } from "drizzle-orm";
import { database } from "@/db";
import * as S from "@/db/schema";
import { tenant } from "@/db/tenant";
import { panelAccess, superAccess } from "@/lib/access";
import { defaultSettings } from "@/lib/demo";
import { hashPassword } from "better-auth/crypto";
export type FormState = { error?: string; message?: string };
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const uuid = (f: FormData, k: string) => z.uuid().parse(text(f, k));
const minute = (f: FormData, k: string) => {
  const value = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .parse(text(f, k));
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};
const num = (f: FormData, k: string, min = 0, max = 10000000) =>
  z.coerce.number().int().min(min).max(max).parse(f.get(k));
const short = (f: FormData, k: string, max = 120) =>
  z.string().min(1).max(max).parse(text(f, k));
const httpsOrLocal = z
  .string()
  .refine(
    (v) => !v || v.startsWith("/images/") || /^https:\/\/[^\s]+$/.test(v),
    "Usa una URL HTTPS.",
  );
export async function savePanel(_: FormState, f: FormData): Promise<FormState> {
  const kind = text(f, "kind");
  const access = await panelAccess(kind !== "status");
  if (access.demo)
    return {
      error:
        "Demo de solo lectura. Conecta Neon e inicia sesión para guardar cambios reales.",
    };
  const { db, close } = database(),
    t = tenant(access.salonId);
  try {
    if (kind === "service") {
      const categoryId = uuid(f, "categoryId");
      const [category] = await db
        .select()
        .from(S.serviceCategories)
        .where(
          t.where(S.serviceCategories, eq(S.serviceCategories.id, categoryId)),
        );
      if (!category) throw new Error("Categoría no disponible.");
      const values = {
        name: short(f, "name"),
        description: short(f, "description", 1000),
        categoryId,
        duration: num(f, "duration", 15, 480),
        cleanup: num(f, "cleanup", 0, 120),
        price: num(f, "price"),
        maintenanceDays: text(f, "maintenanceDays")
          ? num(f, "maintenanceDays", 1, 365)
          : null,
        photoUrl: httpsOrLocal.parse(text(f, "photoUrl")),
        active: f.get("active") === "on",
      };
      if (text(f, "id"))
        await db
          .update(S.services)
          .set(values)
          .where(t.where(S.services, eq(S.services.id, uuid(f, "id"))));
      else await db.insert(S.services).values({ salonId: t.id, ...values });
    } else if (kind === "category")
      await db.insert(S.serviceCategories).values({
        salonId: t.id,
        name: short(f, "name"),
        sortOrder: num(f, "sortOrder", 0, 99),
      });
    else if (kind === "staff") {
      const values = {
        name: short(f, "name"),
        title: short(f, "title"),
        photoUrl: httpsOrLocal.parse(text(f, "photoUrl")),
        active: f.get("active") === "on",
      };
      const serviceIds = f.getAll("services").map((v) => z.uuid().parse(v));
      await db.transaction(async (tx) => {
        const valid = serviceIds.length
          ? await tx
              .select()
              .from(S.services)
              .where(t.where(S.services, inArray(S.services.id, serviceIds)))
          : [];
        if (valid.length !== serviceIds.length)
          throw new Error("Servicios no disponibles.");
        const userEmail = text(f, "userEmail");
        let userId: string | null = null;
        if (userEmail) {
          const [user] = await tx
            .select()
            .from(S.users)
            .where(eq(S.users.email, z.email().parse(userEmail)));
          if (!user)
            throw new Error(
              "Primero crea la cuenta de esa profesional desde superadmin.",
            );
          userId = user.id;
        }
        let staffId = text(f, "id");
        if (staffId) {
          z.uuid().parse(staffId);
          const [row] = await tx
            .select()
            .from(S.staff)
            .where(t.where(S.staff, eq(S.staff.id, staffId)))
            .for("update");
          if (!row) throw new Error("Profesional no disponible.");
          if (!userEmail) userId = row.userId;
          await tx
            .update(S.staff)
            .set({ ...values, userId })
            .where(t.where(S.staff, eq(S.staff.id, staffId)));
        } else {
          const [row] = await tx
            .insert(S.staff)
            .values({ salonId: t.id, ...values, userId })
            .returning();
          staffId = row.id;
        }
        await tx
          .delete(S.staffServices)
          .where(
            t.where(S.staffServices, eq(S.staffServices.staffId, staffId)),
          );
        if (serviceIds.length)
          await tx.insert(S.staffServices).values(
            serviceIds.map((serviceId) => ({
              salonId: t.id,
              staffId,
              serviceId,
            })),
          );
        if (userId)
          await tx
            .insert(S.memberships)
            .values({ salonId: t.id, userId, role: "staff" })
            .onConflictDoNothing();
      });
    } else if (kind === "hours") {
      const staffId = uuid(f, "staffId"),
        weekday = num(f, "weekday", 0, 6),
        startMinute = minute(f, "startTime"),
        endMinute = minute(f, "endTime");
      if (startMinute >= endMinute)
        throw new Error("La hora final debe ser posterior al inicio.");
      await db.transaction(async (tx) => {
        const [p] = await tx
          .select()
          .from(S.staff)
          .where(t.where(S.staff, eq(S.staff.id, staffId)))
          .for("update");
        if (!p) throw new Error("Profesional no disponible.");
        await tx
          .delete(S.workingHours)
          .where(
            t.where(
              S.workingHours,
              eq(S.workingHours.staffId, staffId),
              eq(S.workingHours.weekday, weekday),
            ),
          );
        if (f.get("enabled") === "on")
          await tx.insert(S.workingHours).values({
            salonId: t.id,
            staffId,
            weekday,
            startMinute,
            endMinute,
          });
      });
    } else if (kind === "timeoff") {
      const staffId = uuid(f, "staffId"),
        startsAt = new Date(
          `${short(f, "startsAt")}T${short(f, "startTime")}:00-05:00`,
        ),
        endsAt = new Date(
          `${short(f, "endsAt")}T${short(f, "endTime")}:00-05:00`,
        );
      if (
        !Number.isFinite(+startsAt) ||
        !Number.isFinite(+endsAt) ||
        +endsAt <= +startsAt
      )
        throw new Error("Revisa las fechas de ausencia.");
      await db.transaction(async (tx) => {
        const [p] = await tx
          .select()
          .from(S.staff)
          .where(t.where(S.staff, eq(S.staff.id, staffId)))
          .for("update");
        if (!p) throw new Error("Profesional no disponible.");
        const conflict = await tx
          .select({ id: S.appointments.id })
          .from(S.appointments)
          .where(
            t.where(
              S.appointments,
              eq(S.appointments.staffId, staffId),
              eq(S.appointments.status, "confirmed"),
              sql`${S.appointments.startsAt} < ${endsAt} AND ${S.appointments.busyUntil} > ${startsAt}`,
            ),
          )
          .limit(1);
        if (conflict.length)
          throw new Error(
            "Hay citas en ese intervalo. Reprográmalas antes de registrar la ausencia.",
          );
        await tx.insert(S.timeOff).values({
          salonId: t.id,
          staffId,
          startsAt,
          endsAt,
          reason: text(f, "reason").slice(0, 300),
        });
      });
    } else if (kind === "delete-timeoff")
      await db
        .delete(S.timeOff)
        .where(t.where(S.timeOff, eq(S.timeOff.id, uuid(f, "id"))));
    else if (kind === "settings") {
      const [salon] = await db
        .select()
        .from(S.salons)
        .where(eq(S.salons.id, t.id));
      const primaryColor = z
          .string()
          .regex(/^#[a-fA-F0-9]{6}$/)
          .parse(text(f, "primaryColor")),
        accentColor = z
          .string()
          .regex(/^#[a-fA-F0-9]{6}$/)
          .parse(text(f, "accentColor"));
      const settings = {
        ...salon.settings,
        address: short(f, "address", 300),
        city: short(f, "city"),
        description: short(f, "description", 1000),
        whatsapp: normalizeColombianPhone(text(f, "whatsapp")),
        instagram: httpsOrLocal.parse(text(f, "instagram")),
        mapsUrl: z
          .url()
          .refine((v) => v.startsWith("https://"))
          .parse(text(f, "mapsUrl")),
        heroUrl: httpsOrLocal.parse(text(f, "heroUrl")),
        cancellationHours: num(f, "cancellationHours", 0, 168),
        bookingDays: num(f, "bookingDays", 1, 90),
        minNoticeHours: num(f, "minNoticeHours", 1, 72),
        emailEnabled: f.get("emailEnabled") === "on",
        ownerEmailEnabled: f.get("ownerEmailEnabled") === "on",
        reactivationDays: num(f, "reactivationDays", 7, 365),
      };
      await db
        .update(S.salons)
        .set({
          name: short(f, "name"),
          primaryColor,
          accentColor,
          logoUrl: httpsOrLocal.parse(text(f, "logoUrl")),
          settings,
        })
        .where(eq(S.salons.id, t.id));
    } else if (kind === "messages") {
      const [salon] = await db
        .select()
        .from(S.salons)
        .where(eq(S.salons.id, t.id));
      const messages = { ...salon.settings.messages },
        whatsappMessages = {
          ...defaultWhatsAppMessages,
          ...salon.settings.whatsappMessages,
        };
      for (const key of ["confirmation", "reminder24", "thanks"] as const) {
        messages[key] = short(f, key, 1500);
        if (!validateTemplate(messages[key]))
          throw new Error("Hay una variable desconocida en el correo.");
      }
      for (const key of Object.keys(
        defaultWhatsAppMessages,
      ) as (keyof typeof defaultWhatsAppMessages)[]) {
        whatsappMessages[key] = short(f, `wa-${key}`, 1500);
        if (!validateTemplate(whatsappMessages[key]))
          throw new Error(
            "Hay una variable desconocida en la plantilla de WhatsApp.",
          );
      }
      await db
        .update(S.salons)
        .set({ settings: { ...salon.settings, messages, whatsappMessages } })
        .where(eq(S.salons.id, t.id));
    } else if (kind === "status") {
      const status = z
        .enum(["completed", "no_show", "cancelled"])
        .parse(text(f, "status"));
      await db.transaction(async (tx) => {
        const [a] = await tx
          .select()
          .from(S.appointments)
          .where(
            t.where(
              S.appointments,
              eq(S.appointments.id, uuid(f, "id")),
              access.role === "staff"
                ? eq(S.appointments.staffId, access.staffId!)
                : undefined,
            ),
          )
          .for("update");
        if (!a || a.status !== "confirmed")
          throw new Error("La cita ya no está confirmada.");
        if (status !== "cancelled" && +a.startsAt > Date.now())
          throw new Error(
            "Espera hasta la hora de la cita para marcar el resultado.",
          );
        const [updated] = await tx
          .update(S.appointments)
          .set({
            status,
            version: status === "cancelled" ? a.version + 1 : a.version,
          })
          .where(t.where(S.appointments, eq(S.appointments.id, a.id)))
          .returning();
        await tx
          .update(S.scheduledMessages)
          .set({ status: "cancelled" })
          .where(
            t.where(
              S.scheduledMessages,
              eq(S.scheduledMessages.appointmentId, a.id),
              inArray(S.scheduledMessages.status, ["pending", "processing"]),
              status === "completed"
                ? sql`${S.scheduledMessages.kind} <> 'thanks'`
                : undefined,
            ),
          );
        await invalidateAppointmentTasks(tx, t.id, a.id);
        if (status === "completed") await ensureAppointmentTasks(tx, updated);
        if (status === "cancelled") {
          const [salon] = await tx
            .select()
            .from(S.salons)
            .where(eq(S.salons.id, t.id));
          await enqueueTeamNotifications(tx, salon, updated, "cancelled");
        }
      });
      after(async () => {
        try {
          await flushMessages();
        } catch {
          console.error("La cola retomará los avisos del salón.");
        }
      });
    } else if (kind === "client")
      await db
        .update(S.clients)
        .set({
          name: short(f, "name"),
          birthday: text(f, "birthday")
            ? z.iso
                .date()
                .refine(
                  (v) =>
                    v <= new Date().toISOString().slice(0, 10) &&
                    v >= "1900-01-01",
                )
                .parse(text(f, "birthday"))
            : null,
          marketingConsent: f.get("marketingConsent") === "on",
          email: z.email().parse(text(f, "email")),
          phone: z
            .string()
            .regex(/^\+573\d{9}$/)
            .parse(text(f, "phone")),
        })
        .where(t.where(S.clients, eq(S.clients.id, uuid(f, "id"))));
    else if (kind === "review")
      await db
        .update(S.reviews)
        .set({ published: f.get("published") === "on" })
        .where(t.where(S.reviews, eq(S.reviews.id, uuid(f, "id"))));
    else if (kind === "gallery")
      await db.insert(S.galleryPhotos).values({
        salonId: t.id,
        url: httpsOrLocal.parse(text(f, "url")),
        caption: short(f, "caption", 200),
        sortOrder: num(f, "sortOrder", 0, 100),
      });
    else if (kind === "delete-photo")
      await db
        .delete(S.galleryPhotos)
        .where(t.where(S.galleryPhotos, eq(S.galleryPhotos.id, uuid(f, "id"))));
    else if (kind === "message-resolve") {
      const status = z.enum(["sent", "cancelled"]).parse(text(f, "status"));
      await db
        .update(S.scheduledMessages)
        .set({ status, lastError: "Revisado manualmente por la dueña." })
        .where(
          t.where(
            S.scheduledMessages,
            eq(S.scheduledMessages.id, uuid(f, "id")),
            inArray(S.scheduledMessages.status, ["failed", "uncertain"]),
          ),
        );
    } else return { error: "Acción no disponible." };
    revalidatePath("/panel", "layout");
    revalidatePath(`/${access.slug}`);
    return { message: "Cambios guardados." };
  } catch (e) {
    return {
      error:
        e instanceof z.ZodError
          ? "Revisa los campos: hay un valor no válido."
          : e instanceof Error &&
              !/SQL|query|constraint|duplicate|connect/i.test(e.message)
            ? e.message
            : "No se pudo guardar. Revisa si el dato ya existe.",
    };
  } finally {
    await close();
  }
}
export async function saveAdmin(_: FormState, f: FormData): Promise<FormState> {
  await superAccess();
  const { db, close } = database();
  try {
    const kind = text(f, "kind");
    if (kind === "toggle-salon")
      await db
        .update(S.salons)
        .set({ active: f.get("active") === "on" })
        .where(eq(S.salons.id, uuid(f, "id")));
    else if (kind === "create-salon") {
      const name = short(f, "name"),
        slug = z
          .string()
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
          .min(3)
          .max(80)
          .refine(
            (v) =>
              ![
                "panel",
                "api",
                "demo",
                "acceso",
                "superadmin",
                "gestionar",
                "privacidad",
                "nails-glam-studio",
                "mariana-gomez",
              ].includes(v),
          )
          .parse(text(f, "slug"));
      const email = z.email().parse(text(f, "email")),
        password = z.string().min(12).max(128).parse(text(f, "password"));
      const hash = await hashPassword(password);
      await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(S.users)
          .where(eq(S.users.email, email));
        const userId = existing?.id ?? crypto.randomUUID();
        if (!existing) {
          await tx
            .insert(S.users)
            .values({ id: userId, name: short(f, "ownerName"), email });
          await tx.insert(S.accounts).values({
            id: crypto.randomUUID(),
            userId,
            accountId: userId,
            providerId: "credential",
            password: hash,
          });
        }
        const [salon] = await tx
          .insert(S.salons)
          .values({
            name,
            slug,
            settings: {
              ...defaultSettings,
              whatsapp: normalizeColombianPhone(short(f, "whatsapp")),
              address: short(f, "address"),
              city: short(f, "city"),
            },
          })
          .returning();
        await tx
          .insert(S.memberships)
          .values({ salonId: salon.id, userId, role: "owner" });
        for (const category of [
          "Manicure",
          "Pedicure",
          "Cabello",
          "Extras",
          "Combos",
        ])
          await tx
            .insert(S.serviceCategories)
            .values({ salonId: salon.id, name: category });
      });
    } else if (kind === "create-user") {
      const email = z.email().parse(text(f, "email")),
        name = short(f, "name"),
        password = z.string().min(12).max(128).parse(text(f, "password"));
      const userId = crypto.randomUUID(),
        hash = await hashPassword(password);
      await db.transaction(async (tx) => {
        await tx.insert(S.users).values({ id: userId, name, email });
        await tx.insert(S.accounts).values({
          id: crypto.randomUUID(),
          userId,
          accountId: userId,
          providerId: "credential",
          password: hash,
        });
      });
    } else return { error: "Acción no disponible." };
    revalidatePath("/superadmin");
    return { message: "Cambios guardados." };
  } catch {
    return {
      error:
        "No se pudo guardar. Revisa los campos, el correo y que el slug sea único.",
    };
  } finally {
    await close();
  }
}
