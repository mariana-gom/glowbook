import { test, expect } from "@playwright/test";
import { dayKey } from "../../src/lib/utils";
test("la dueña entra al demo y los cambios se bloquean", async ({
  page,
}, info) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: /Soy dueña/ }).click();
  await expect(page).toHaveURL("/panel");
  await expect(
    page.getByRole("heading", { name: /Un lindo día/ }),
  ).toBeVisible();
  await expect(page.getByText("100", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: `artifacts/dashboard-${info.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/panel/servicios");
  await page.getByText("+ Crear una categoría", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .first()
    .fill("Categoría de prueba");
  await page
    .getByRole("button", { name: "Crear categoría", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Demo de solo lectura" }),
  ).toContainText("Demo de solo lectura");
});
test("una clienta recorre los cuatro pasos sin crear una cita real", async ({
  page,
}, info) => {
  await page.goto("/nails-glam-studio/reservar");
  await page.getByRole("button", { name: /Manicure semipermanente/ }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Elige tus manos expertas." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Cualquiera disponible/ }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  const next = new Date(Date.now() + 3 * 86400000);
  if (next.getUTCDay() === 0) next.setUTCDate(next.getUTCDate() + 1);
  await page.getByLabel("Fecha de tu visita").fill(dayKey(next));
  const slot = page.getByRole("button", { name: /^\d\d:\d\d$/ }).first();
  await expect(slot).toBeVisible();
  await slot.click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Nombre completo").fill("Laura de Prueba");
  await page.getByLabel("Celular", { exact: true }).fill("3000000123");
  await page.getByLabel("Correo electrónico").fill("laura@example.invalid");
  await page.getByRole("checkbox", { name: /Acepto el/ }).check();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: `artifacts/reservation-${info.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Probar confirmación" }).click();
  await expect(
    page.getByRole("heading", { name: "Así de fácil, Laura." }),
  ).toBeVisible();
  await expect(page.getByText(/Esta prueba no creó una reserva/)).toBeVisible();
  const whatsapp = page.getByRole("link", { name: "Confirmar por WhatsApp" });
  await expect(whatsapp).toBeVisible();
  const prepared = new URL((await whatsapp.getAttribute("href"))!);
  expect(prepared.hostname).toBe("wa.me");
  expect(prepared.searchParams.get("text")).toContain("Laura de Prueba");
});
test("protege el cron y el panel sin sesión", async ({ page, request }) => {
  await page.goto("/panel");
  await expect(page).toHaveURL("/demo");
  const response = await request.get("/api/cron/process");
  expect(response.status()).toBe(401);
  expect((await request.get("/api/cron/daily")).status()).toBe(401);
  expect((await request.post("/api/cron/daily")).status()).toBe(401);
});

test("pendientes abre wa.me y solo marca el demo localmente", async ({
  page,
  context,
}, info) => {
  await context.route("https://wa.me/**", (route) => route.abort());
  await page.goto("/demo");
  await page.getByRole("button", { name: /Soy dueña/ }).click();
  await expect(page).toHaveURL("/panel");
  await page.goto("/panel/pendientes");
  await expect(
    page.getByRole("heading", { name: "Pendientes de hoy." }),
  ).toBeVisible();
  const section = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Citas nuevas por confirmar" }),
  });
  const button = section
    .getByRole("button", { name: "Confirmar", exact: true })
    .first();
  await expect(button).toBeVisible();
  const request = context.waitForEvent("request", (r) =>
    r.url().startsWith("https://wa.me/"),
  );
  await button.click();
  const outbound = await request;
  const link = new URL(outbound.url());
  expect(link.searchParams.get("text")).toMatch(/cita|confirmamos/);
  await expect(
    section.getByRole("button", { name: "Marcado enviado" }).first(),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: `artifacts/pending-${info.project.name}.png`,
    fullPage: false,
    animations: "disabled",
  });
});

test("PWA tiene manifest, service worker y pantalla segura sin conexión", async ({
  page,
  context,
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/panel");
  expect(
    manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512"),
  ).toBe(true);
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");
  await page.goto("/demo");
  await page.getByRole("button", { name: /Soy dueña/ }).click();
  await expect(page).toHaveURL("/panel");
  await page.goto("/panel/notificaciones");
  await expect(
    page.getByRole("heading", { name: "Entérate de cada cambio." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Activar notificaciones" }),
  ).toBeDisabled();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active)
      throw new Error("El service worker no quedó activo.");
  });
  await page.reload();
  const cached = await page.evaluate(async () => {
    const cache = await caches.open("glowbook-shell-v1");
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });
  expect(cached.sort()).toEqual(
    ["/icons/icon-192.png", "/icons/icon-512.png", "/offline.html"].sort(),
  );
  await context.setOffline(true);
  await page.goto("/panel/agenda");
  await expect(
    page.getByRole("heading", { name: "Un momento para reconectar." }),
  ).toBeVisible();
  await expect(page.getByText(/tu agenda se consulta en línea/)).toBeVisible();
  await context.setOffline(false);
});
