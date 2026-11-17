import { loadEnvConfig } from "@next/env";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { database } from "../src/db";
import { users, accounts } from "../src/db/schema";
loadEnvConfig(process.cwd());
const email = z.email().parse(process.env.ADMIN_EMAIL),
  password = z.string().min(12).max(128).parse(process.env.ADMIN_PASSWORD);
const { db, close } = database();
try {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(users)
      .where(eq(users.email, email));
    if (existing)
      throw new Error(
        "Esa cuenta ya existe. No se modifica su rol ni contraseña automáticamente.",
      );
    const id = crypto.randomUUID();
    await tx.insert(users).values({
      id,
      email,
      name: process.env.ADMIN_NAME ?? "Administradora",
      role: "superadmin",
      emailVerified: true,
    });
    await tx.insert(accounts).values({
      id: crypto.randomUUID(),
      userId: id,
      accountId: id,
      providerId: "credential",
      password: await hashPassword(password),
    });
  });
  console.log(
    "Cuenta administradora creada. Elimina ADMIN_PASSWORD de tu entorno.",
  );
} finally {
  await close();
}
