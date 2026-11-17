import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { database } from "../src/db";
import * as S from "../src/db/schema";
import { demoData } from "../src/lib/demo";
loadEnvConfig(process.cwd());
if (process.env.ALLOW_DEMO_SEED !== "true")
  throw new Error(
    "Habilita ALLOW_DEMO_SEED=true únicamente en una base de demo o desarrollo.",
  );
const { db, close } = database();
try {
  const d = demoData();
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(S.salons)
      .where(eq(S.salons.slug, d.salon.slug));
    if (existing) {
      console.log(
        "El salón demo ya existe; seed omitido sin modificar sus datos.",
      );
      return;
    }
    await tx.insert(S.salons).values(d.salon);
    await tx.insert(S.serviceCategories).values(d.categories);
    await tx.insert(S.services).values(d.services);
    await tx.insert(S.staff).values(d.staff);
    await tx.insert(S.staffServices).values(d.staffServices);
    await tx.insert(S.workingHours).values(d.hours);
    await tx.insert(S.clients).values(d.clients);
    await tx.insert(S.appointments).values(d.appointments);
    await tx.insert(S.appointmentServices).values(d.appointmentServices);
    await tx.insert(S.reviews).values(d.reviews);
    await tx.insert(S.galleryPhotos).values(d.gallery);
    console.log(
      `Demo creado: ${d.services.length} servicios, ${d.staff.length} profesionales, ${d.clients.length} clientas y ${d.appointments.length} citas.`,
    );
  });
  // No se programan mensajes ni se crean credenciales públicas para los contactos ficticios.
} finally {
  await close();
}
