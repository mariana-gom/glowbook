import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";
neonConfig.webSocketConstructor = ws;
// Se instancia bajo demanda para que el demo y el build no necesiten credenciales.
export function database() {
  if (!process.env.DATABASE_URL)
    throw new Error("Configura DATABASE_URL para guardar datos.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}
export type Database = ReturnType<typeof database>["db"];
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
