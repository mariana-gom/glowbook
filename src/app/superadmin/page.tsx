import Link from "next/link";
import { superAccess } from "@/lib/access";
import { database } from "@/db";
import { salons } from "@/db/schema";
import { ActionForm } from "@/components/action-form";
import { Brand } from "@/components/brand";
export const dynamic = "force-dynamic";
export default async function Superadmin() {
  await superAccess();
  const { db, close } = database();
  try {
    const rows = await db.select().from(salons);
    return (
      <main id="contenido" className="page-width py-10">
        <Brand />
        <p className="eyebrow mt-12 text-primary">
          ADMINISTRACIÓN DE LA PLATAFORMA
        </p>
        <h1 className="text-4xl">Hagamos crecer GlowBook.</h1>
        <details className="card mb-6 p-6">
          <summary>+ Crear un salón y asignar su dueña</summary>
          <div className="mt-6">
            <ActionForm kind="create-salon" admin submit="Crear salón">
              <div className="field-grid">
                <label>
                  Nombre del salón
                  <input name="name" required />
                </label>
                <label>
                  Slug público
                  <input
                    name="slug"
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    placeholder="mi-salon"
                  />
                </label>
                <label>
                  Nombre de la dueña
                  <input name="ownerName" required />
                </label>
                <label>
                  Correo de la dueña
                  <input name="email" type="email" required />
                </label>
                <label>
                  Contraseña inicial (solo cuenta nueva)
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    required
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  WhatsApp
                  <input name="whatsapp" required pattern="57[0-9]{10}" />
                </label>
                <label>
                  Dirección
                  <input name="address" required />
                </label>
                <label>
                  Ciudad
                  <input name="city" required />
                </label>
              </div>
              <p className="text-xs muted">
                Si la cuenta ya existe se reutiliza su acceso, sin modificar su
                contraseña. Comparte las credenciales por un medio seguro.
              </p>
            </ActionForm>
          </div>
        </details>
        <details className="card mb-8 p-6">
          <summary>+ Crear cuenta para una profesional</summary>
          <div className="mt-6">
            <ActionForm kind="create-user" admin submit="Crear cuenta">
              <div className="field-grid">
                <label>
                  Nombre
                  <input name="name" required />
                </label>
                <label>
                  Correo
                  <input name="email" type="email" required />
                </label>
                <label>
                  Contraseña inicial
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>
              </div>
              <p className="text-xs muted">
                La dueña podrá asociar este correo al perfil de su profesional
                en “Mi equipo”.
              </p>
            </ActionForm>
          </div>
        </details>
        <div className="grid gap-5 md:grid-cols-2">
          {rows.map((s) => (
            <section className="card p-6" key={s.id}>
              <h2 className="text-2xl">{s.name}</h2>
              <Link
                className="text-xs text-primary underline"
                href={`/${s.slug}`}
              >
                /{s.slug}
              </Link>
              <div className="mt-5">
                <ActionForm kind="toggle-salon" id={s.id} admin>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={s.active}
                    />
                    Salón activo
                  </label>
                </ActionForm>
              </div>
            </section>
          ))}
        </div>
      </main>
    );
  } finally {
    await close();
  }
}
