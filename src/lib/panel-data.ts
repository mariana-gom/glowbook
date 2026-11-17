import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { panelAccess } from "./access";
import { demoData } from "./demo";
import { salonData, type DataScope } from "./data";
export async function panelData(
  ownerOnly = false,
  scope: Omit<DataScope, "staffId"> = {},
) {
  const access = await panelAccess(ownerOnly);
  if (scope.clientId && !z.uuid().safeParse(scope.clientId).success) notFound();
  const data = access.demo
    ? demoData()
    : await salonData(access.slug, true, {
        ...scope,
        staffId: access.role === "staff" ? access.staffId! : undefined,
      });
  if (!data) notFound();
  if (access.demo) {
    if (scope.directory) {
      const q = scope.directory.query.toLowerCase();
      const matches = data.clients
        .filter((c) =>
          `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q),
        )
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
      data.stats = { ...data.stats!, directoryCount: matches.length };
      data.clients = matches.slice(
        (scope.directory.page - 1) * 50,
        scope.directory.page * 50,
      );
    }
    if (scope.clientId) {
      data.clients = data.clients.filter((c) => c.id === scope.clientId);
      data.appointments = data.appointments.filter(
        (a) => a.clientId === scope.clientId,
      );
    }
  }
  return { ...data, access, now: Date.now() };
}
