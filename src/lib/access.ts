import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { auth } from "./auth";
import { database } from "@/db";
import { memberships, salons, staff, users } from "@/db/schema";
import { demoId, DEMO_SLUG } from "./demo";
export async function panelAccess(ownerOnly = false) {
  if ((await cookies()).get("glowbook-demo")?.value === "owner") {
    return {
      salonId: demoId("salon"),
      slug: DEMO_SLUG,
      role: "owner",
      staffId: null,
      userId: "demo",
      demo: true,
    };
  }
  if (!process.env.DATABASE_URL) redirect("/demo");
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) redirect("/acceso");
  const selected = (await cookies()).get("glowbook-salon")?.value;
  const { db, close } = database();
  try {
    const rows = await db
      .select({ salonId: salons.id, slug: salons.slug, role: memberships.role })
      .from(memberships)
      .innerJoin(salons, eq(salons.id, memberships.salonId))
      .where(
        and(eq(memberships.userId, session.user.id), eq(salons.active, true)),
      );
    if (!rows.length) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.user.id));
      if (user?.role === "superadmin") redirect("/superadmin");
    }
    const member =
      rows.find((r) => r.salonId === selected) ??
      rows.find((r) => r.role === "owner" || r.role === "staff");
    if (
      !member ||
      member.role === "client" ||
      (ownerOnly && member.role !== "owner")
    )
      redirect("/acceso?error=permisos");
    const [professional] = await db
      .select()
      .from(staff)
      .where(
        and(
          eq(staff.salonId, member.salonId),
          eq(staff.userId, session.user.id),
        ),
      );
    if (member.role === "staff" && !professional)
      redirect("/acceso?error=permisos");
    return {
      ...member,
      staffId: professional?.id ?? null,
      userId: session.user.id,
      demo: false,
    };
  } finally {
    await close();
  }
}
export async function superAccess() {
  if (!process.env.DATABASE_URL) redirect("/acceso");
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) redirect("/acceso");
  const { db, close } = database();
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id));
    if (user?.role !== "superadmin") redirect("/panel");
    return user;
  } finally {
    await close();
  }
}
