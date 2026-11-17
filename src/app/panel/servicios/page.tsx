import { panelData } from "@/lib/panel-data";
import { money } from "@/lib/utils";
import { ServiceForm } from "@/components/service-form";
import { ActionForm } from "@/components/action-form";
export default async function Services() {
  const d = await panelData(true);
  return (
    <>
      <p className="eyebrow text-primary">TU TALENTO, EN UN CATÁLOGO</p>
      <h1 className="text-4xl">Servicios que enamoran.</h1>
      <p className="mb-8 text-sm muted">
        Actualiza precios y tiempos. Las citas existentes conservan lo que se
        contrató.
      </p>
      <details className="card mb-5 p-6">
        <summary className="text-sm font-medium text-primary">
          + Crear un servicio
        </summary>
        <div className="mt-6">
          <ServiceForm categories={d.categories} />
        </div>
      </details>
      <details className="card mb-8 p-6">
        <summary className="text-sm font-medium">+ Crear una categoría</summary>
        <div className="mt-5">
          <ActionForm kind="category" submit="Crear categoría">
            <div className="field-grid">
              <label>
                Nombre
                <input name="name" required maxLength={120} />
              </label>
              <label>
                Orden
                <input
                  name="sortOrder"
                  type="number"
                  defaultValue={d.categories.length}
                  min={0}
                  max={99}
                />
              </label>
            </div>
          </ActionForm>
        </div>
      </details>
      {d.categories.map((c) => (
        <section key={c.id} className="mb-8">
          <h2 className="text-2xl">{c.name}</h2>
          <div className="space-y-3">
            {d.services
              .filter((s) => s.categoryId === c.id)
              .map((s) => (
                <details key={s.id} className="card p-5">
                  <summary className="text-sm">
                    <span className="ml-2 font-medium">{s.name}</span>
                    <span className="ml-4 text-xs muted">
                      {money(s.price)} · {s.duration} min ·{" "}
                      {s.active ? "Activo" : "Archivado"}
                    </span>
                  </summary>
                  <div className="mt-6 border-t border-border pt-6">
                    <ServiceForm service={s} categories={d.categories} />
                  </div>
                </details>
              ))}
          </div>
        </section>
      ))}
    </>
  );
}
