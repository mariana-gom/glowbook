import { loadEnvConfig } from "@next/env";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { database } from "../src/db";

async function main() {
  loadEnvConfig(process.cwd());
  const { db, close } = database();
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migraciones aplicadas.");
  } finally {
    await close();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "No fue posible completar el comando.",
  );
  process.exitCode = 1;
});
