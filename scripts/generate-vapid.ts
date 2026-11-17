import { readFile, writeFile, chmod } from "node:fs/promises";
import { generateVAPIDKeys } from "web-push";

async function main() {
  const file = ".env.local";
  let content = "";
  try {
    content = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (
    /^\s*(?:NEXT_PUBLIC_VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY)[ \t]*=[ \t]*\S+/m.test(
      content,
    )
  )
    throw new Error(
      "Ya hay claves VAPID en .env.local. No se rotan automáticamente: hacerlo requiere volver a suscribir los dispositivos.",
    );
  const keys = generateVAPIDKeys();
  for (const [name, value] of Object.entries({
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
  })) {
    const line = new RegExp(`^${name}=.*$`, "m");
    content = line.test(content)
      ? content.replace(line, `${name}=${value}`)
      : content + `\n${name}=${value}\n`;
  }
  if (!/^VAPID_SUBJECT=/m.test(content))
    content += "\nVAPID_SUBJECT=mailto:reservas@tu-dominio.com\n";
  await writeFile(file, content, { mode: 0o600 });
  await chmod(file, 0o600);
  console.log(
    "Claves VAPID guardadas en .env.local, sin mostrarlas. Configura VAPID_SUBJECT con tu correo y reinicia el servidor. Para desplegar, transfiere las variables mediante el gestor privado de Vercel y reconstruye la app.",
  );
}
main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "No fue posible completar el comando.",
  );
  process.exitCode = 1;
});
