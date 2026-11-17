import "server-only";
import { and, eq, gte, lt, ilike, or, inArray, sql } from "drizzle-orm";
import { database } from "@/db";
import * as S from "@/db/schema";
import { tenant } from "@/db/tenant";
import { demoData, DEMO_SLUG, type SalonData } from "./demo";
import { dayKey } from "./utils";
export type DataScope = {
  staffId?: string;
  clientId?: string;
  range?: { start: Date; end: Date };
  directory?: { query: string; page: number };
};
// La página pública solo recibe datos publicados; nunca clientas ni la agenda completa.
export async function salonData(
  slug: string,
  privateData = false,
  scope: DataScope = {},
): Promise<SalonData | null> {
  if (slug === DEMO_SLUG) return demoData();
  if (!process.env.DATABASE_URL) return null;
  const { db, close } = database();
  try {
    const [salon] = await db
      .select()
      .from(S.salons)
      .where(and(eq(S.salons.slug, slug), eq(S.salons.active, true)));
    if (!salon) return null;
    const t = tenant(salon.id),
      today = dayKey(),
      monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00-05:00`);
    const end = new Date(Date.now() + 91 * 86400000);
    const clientScope = scope.staffId
      ? sql`exists (select 1 from appointments a where a.salon_id=${t.id} and a.client_id=${S.clients.id} and a.staff_id=${scope.staffId})`
      : undefined;
    const clientWhere = t.where(
      S.clients,
      clientScope,
      scope.clientId ? eq(S.clients.id, scope.clientId) : undefined,
      scope.directory?.query
        ? or(
            ilike(S.clients.name, `%${scope.directory.query}%`),
            ilike(S.clients.phone, `%${scope.directory.query}%`),
            ilike(S.clients.email, `%${scope.directory.query}%`),
          )
        : undefined,
    );
    // Directorio paginado; la agenda se consulta solo por el intervalo que se está mostrando.
    const directoryClients =
      privateData && scope.directory
        ? await db
            .select()
            .from(S.clients)
            .where(clientWhere)
            .orderBy(S.clients.name)
            .limit(50)
            .offset((scope.directory.page - 1) * 50)
        : null;
    const appointmentWhere = t.where(
      S.appointments,
      scope.staffId ? eq(S.appointments.staffId, scope.staffId) : undefined,
      scope.clientId ? eq(S.appointments.clientId, scope.clientId) : undefined,
      directoryClients
        ? inArray(
            S.appointments.clientId,
            directoryClients.map((c) => c.id),
          )
        : undefined,
      !scope.clientId && !scope.directory
        ? gte(
            S.appointments.startsAt,
            scope.range?.start ??
              new Date(Math.min(+monthStart, Date.now() - 7 * 86400000)),
          )
        : undefined,
      !scope.clientId && !scope.directory
        ? lt(S.appointments.startsAt, scope.range?.end ?? end)
        : undefined,
    );
    const visibleIds = db
      .select({ id: S.appointments.id })
      .from(S.appointments)
      .where(appointmentWhere);
    const [
      categories,
      services,
      staff,
      staffServices,
      hours,
      timeOff,
      clients,
      appointments,
      appointmentServices,
      reviews,
      gallery,
    ] = await Promise.all([
      db
        .select()
        .from(S.serviceCategories)
        .where(t.where(S.serviceCategories))
        .orderBy(S.serviceCategories.sortOrder),
      db.select().from(S.services).where(t.where(S.services)),
      db.select().from(S.staff).where(t.where(S.staff)),
      db.select().from(S.staffServices).where(t.where(S.staffServices)),
      db.select().from(S.workingHours).where(t.where(S.workingHours)),
      privateData ? db.select().from(S.timeOff).where(t.where(S.timeOff)) : [],
      privateData
        ? (directoryClients ??
          db
            .select()
            .from(S.clients)
            .where(
              scope.clientId
                ? clientWhere
                : t.where(
                    S.clients,
                    inArray(
                      S.clients.id,
                      db
                        .select({ id: S.appointments.clientId })
                        .from(S.appointments)
                        .where(appointmentWhere),
                    ),
                  ),
            ))
        : [],
      privateData
        ? db.select().from(S.appointments).where(appointmentWhere)
        : [],
      privateData
        ? db
            .select()
            .from(S.appointmentServices)
            .where(
              t.where(
                S.appointmentServices,
                inArray(S.appointmentServices.appointmentId, visibleIds),
              ),
            )
        : [],
      db
        .select()
        .from(S.reviews)
        .where(
          t.where(
            S.reviews,
            privateData ? undefined : eq(S.reviews.published, true),
          ),
        )
        .orderBy(S.reviews.createdAt)
        .limit(privateData ? 200 : 12),
      db
        .select()
        .from(S.galleryPhotos)
        .where(t.where(S.galleryPhotos))
        .orderBy(S.galleryPhotos.sortOrder),
    ]);
    let stats: SalonData["stats"];
    if (privateData) {
      const [community] = await db
        .select({
          total: sql<number>`count(*)::int`,
          newClients: sql<number>`count(*) filter (where ${S.clients.createdAt} >= ${monthStart})::int`,
        })
        .from(S.clients)
        .where(t.where(S.clients, clientScope));
      const [revenue] = await db
        .select({
          revenue: sql<number>`coalesce(sum(${S.appointments.total}),0)::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(S.appointments)
        .where(
          t.where(
            S.appointments,
            eq(S.appointments.status, "completed"),
            gte(S.appointments.startsAt, monthStart),
            scope.staffId
              ? eq(S.appointments.staffId, scope.staffId)
              : undefined,
          ),
        );
      const [directory] = scope.directory
        ? await db
            .select({ count: sql<number>`count(*)::int` })
            .from(S.clients)
            .where(clientWhere)
        : [];
      stats = {
        totalClients: community.total,
        newClients: community.newClients,
        monthRevenue: revenue.revenue,
        completedCount: revenue.count,
        directoryCount: directory?.count ?? community.total,
      };
    }
    return {
      salon,
      categories,
      services,
      staff,
      staffServices,
      hours,
      timeOff,
      clients,
      appointments,
      appointmentServices,
      reviews,
      gallery,
      demo: false,
      stats,
    };
  } finally {
    await close();
  }
}
