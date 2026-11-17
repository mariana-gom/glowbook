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
});
test("protege el cron y el panel sin sesión", async ({ page, request }) => {
  await page.goto("/panel");
  await expect(page).toHaveURL("/demo");
  const response = await request.get("/api/cron/process");
  expect(response.status()).toBe(401);
});
