import { panelData } from "@/lib/panel-data";
import { ActionForm } from "@/components/action-form";
import { ImageUpload } from "@/components/image-upload";
export default async function Settings() {
  const d = await panelData(true),
    s = d.salon,
    c = s.settings;
  return (
    <>
      <p className="eyebrow text-primary">QUE SE SIENTA MUY TUYO</p>
      <h1 className="text-4xl">La esencia de tu salón.</h1>
      <p className="mb-8 text-sm muted">
        Tu identidad, tus reglas y cada detalle de tu página pública.
      </p>
      <section className="card mb-6 p-6">
        <h2 className="text-2xl">Identidad y reservas</h2>
        <ActionForm kind="settings">
          <div className="field-grid">
            <label>
              Nombre del salón
              <input name="name" defaultValue={s.name} required />
            </label>
            <label>
              WhatsApp (57 + 10 dígitos)
              <input
                name="whatsapp"
                defaultValue={c.whatsapp}
                required
                pattern="57[0-9]{10}"
              />
            </label>
            <label>
              Dirección
              <input name="address" defaultValue={c.address} required />
            </label>
            <label>
              Ciudad
              <input name="city" defaultValue={c.city} required />
            </label>
            <label>
              Color principal
              <input
                name="primaryColor"
                type="color"
                defaultValue={s.primaryColor}
              />
            </label>
            <label>
              Acento
              <input
                name="accentColor"
                type="color"
                defaultValue={s.accentColor}
              />
            </label>
            <label>
              Logo (URL)
              <input name="logoUrl" defaultValue={s.logoUrl ?? ""} />
            </label>
            <label>
              Portada (URL)
              <input name="heroUrl" defaultValue={c.heroUrl} />
            </label>
            <label>
              Instagram (URL)
              <input name="instagram" defaultValue={c.instagram} />
            </label>
            <label>
              Enlace a Google Maps
              <input
                name="mapsUrl"
                type="url"
                defaultValue={c.mapsUrl}
                required
              />
            </label>
            <label>
              Días sin volver para reactivación
              <input
                name="reactivationDays"
                type="number"
                min={7}
                max={365}
                defaultValue={c.reactivationDays ?? 60}
                required
              />
            </label>
          </div>
          <label>
            Presentación
            <textarea
              name="description"
              maxLength={1000}
              defaultValue={c.description}
              required
            />
          </label>
          <div className="field-grid">
            <label>
              Anticipación para cambios (horas)
              <input
                name="cancellationHours"
                type="number"
                min={0}
                max={168}
                defaultValue={c.cancellationHours}
                required
              />
            </label>
            <label>
              Anticipación mínima de reserva (horas)
              <input
                name="minNoticeHours"
                type="number"
                min={1}
                max={72}
                defaultValue={c.minNoticeHours}
                required
              />
            </label>
            <label>
              Días disponibles hacia el futuro
              <input
                name="bookingDays"
                type="number"
                min={1}
                max={90}
                defaultValue={c.bookingDays}
                required
              />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="emailEnabled"
              defaultChecked={c.emailEnabled}
            />
            Enviar confirmaciones y recordatorios por correo
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="ownerEmailEnabled"
              defaultChecked={c.ownerEmailEnabled ?? true}
            />
            Enviar correos a las dueñas: nuevas citas, cambios y resumen diario
          </label>
        </ActionForm>
      </section>
      <section className="card mb-6 p-6">
        <h2 className="text-2xl">Biblioteca de imágenes</h2>
        <ImageUpload />
      </section>
      <section className="card mb-6 p-6">
        <h2 className="text-2xl">Galería del salón</h2>
        <ActionForm kind="gallery" submit="Agregar foto">
          <div className="field-grid">
            <label>
              URL de la foto
              <input name="url" required />
            </label>
            <label>
              Descripción accesible
              <input name="caption" maxLength={200} required />
            </label>
            <label>
              Orden
              <input
                name="sortOrder"
                type="number"
                defaultValue={d.gallery.length}
                min={0}
                max={100}
              />
            </label>
          </div>
        </ActionForm>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {d.gallery.map((p) => (
            <div key={p.id} className="rounded-xl bg-muted p-4">
              <p className="text-xs">{p.caption}</p>
              <ActionForm kind="delete-photo" id={p.id} submit="Quitar foto">
                <span />
              </ActionForm>
            </div>
          ))}
        </div>
      </section>
      <section className="card p-6">
        <h2 className="text-2xl">Reseñas de tus clientas</h2>
        <p className="text-xs muted">
          Las nuevas reseñas se publican cuando las apruebas.
        </p>
        <div className="space-y-5">
          {d.reviews.map((r) => (
            <div className="border-t border-border pt-5" key={r.id}>
              <p className="text-xs font-medium">
                {r.author} · {r.rating}/5
              </p>
              <p className="text-sm muted">{r.comment}</p>
              <ActionForm kind="review" id={r.id}>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="published"
                    defaultChecked={r.published}
                  />
                  Publicada en la página del salón
                </label>
              </ActionForm>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
