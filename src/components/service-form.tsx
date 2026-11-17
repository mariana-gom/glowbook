import type { SalonData } from "@/lib/demo";
import { ActionForm } from "./action-form";
export function ServiceForm({
  service,
  categories,
}: {
  service?: SalonData["services"][number];
  categories: SalonData["categories"];
}) {
  return (
    <ActionForm
      kind="service"
      id={service?.id}
      submit={service ? "Guardar servicio" : "Crear servicio"}
    >
      <div className="field-grid">
        <label>
          Nombre
          <input
            name="name"
            defaultValue={service?.name}
            required
            maxLength={120}
          />
        </label>
        <label>
          Categoría
          <select name="categoryId" defaultValue={service?.categoryId} required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Precio (COP)
          <input
            name="price"
            type="number"
            min={0}
            max={10000000}
            defaultValue={service?.price ?? 50000}
            required
          />
        </label>
        <label>
          Duración (minutos)
          <input
            name="duration"
            type="number"
            min={15}
            max={480}
            defaultValue={service?.duration ?? 60}
            required
          />
        </label>
        <label>
          Limpieza entre citas (minutos)
          <input
            name="cleanup"
            type="number"
            min={0}
            max={120}
            defaultValue={service?.cleanup ?? 10}
            required
          />
        </label>
        <label>
          Días para mantenimiento · Fase 2
          <input
            name="maintenanceDays"
            type="number"
            min={1}
            max={365}
            defaultValue={service?.maintenanceDays ?? ""}
          />
        </label>
      </div>
      <label>
        Descripción
        <textarea
          name="description"
          maxLength={1000}
          required
          defaultValue={service?.description}
        />
      </label>
      <label>
        URL de la foto
        <input
          name="photoUrl"
          defaultValue={service?.photoUrl ?? ""}
          placeholder="https://…"
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          name="active"
          type="checkbox"
          defaultChecked={service?.active ?? true}
        />
        Disponible para reservas
      </label>
    </ActionForm>
  );
}
