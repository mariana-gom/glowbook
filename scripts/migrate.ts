import { loadEnvConfig } from "@next/env";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { database } from "../src/db";
loadEnvConfig(process.cwd());
const { db, close } = database();
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migraciones aplicadas.");
} finally {
  await close();
}
