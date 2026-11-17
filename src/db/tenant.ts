import { and, eq, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
// Toda lectura/escritura de negocio exige un salón validado. La autorización se resuelve antes.
export function tenant(salonId: string) {
  z.uuid().parse(salonId);
  return {
    id: salonId,
    where: (table: { salonId: AnyPgColumn }, ...filters: (SQL | undefined)[]) =>
      and(eq(table.salonId, salonId), ...filters)!,
  };
}
