import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { database } from "@/db";
import { tenant } from "@/db/tenant";
import * as S from "@/db/schema";
import { ManageAppointment } from "@/components/manage-appointment";
import { Brand } from "@/components/brand";
import { appointmentWhatsAppData } from "@/lib/appointment-contact";
import { defaultWhatsAppMessages, buildWhatsAppLink } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { prettyDate, clock, money } from "@/lib/utils";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Gestiona tu cita",
  robots: { index: false, follow: false },
};
export default async function Manage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!process.env.DATABASE_URL || !/^[a-f0-9]{64}$/.test(token)) notFound();
  const { db, close } = database();
  try {
    const [a] = await db
      .select()
      .from(S.appointments)
      .where(
        eq(
          S.appointments.tokenHash,
          createHash("sha256").update(token).digest("hex"),
        ),
      );
    if (!a) notFound();
    const t = tenant(a.salonId);
    const [salon] = await db
      .select()
      .from(S.salons)
      .where(eq(S.salons.id, t.id));
    const services = await db
      .select()
      .from(S.appointmentServices)
      .where(
        t.where(
          S.appointmentServices,
          eq(S.appointmentServices.appointmentId, a.id),
        ),
      );
    const [professional] = await db
      .select()
      .from(S.staff)
      .where(t.where(S.staff, eq(S.staff.id, a.staffId)));
    const whatsappUrl = buildWhatsAppLink(
      salon.settings.whatsapp,
      { ...defaultWhatsAppMessages, ...salon.settings.whatsappMessages }
        .clientConfirmation,
      appointmentWhatsAppData(
        salon,
        a,
        services.map((s) => s.name),
        professional?.name ?? "Tu profesional",
        token,
      ),
    );
    return (
      <main id="contenido" className="mx-auto max-w-xl px-5 py-10">
        <Brand />
        <p className="eyebrow mt-12 text-primary">TU CITA EN {salon.name}</p>
        <h1 className="text-4xl">Tu momento, organizado.</h1>
        <div className="card mb-7 p-7">
          <span className={`badge ${a.status}`}>
            {
              {
                confirmed: a.ownerConfirmedAt ? "Confirmada" : "Reservada",
                completed: "Completada",
                cancelled: "Cancelada",
                no_show: "Inasistencia",
              }[a.status]
            }
          </span>
          <h2 className="mb-2 mt-5 text-2xl">
            {services.map((s) => s.name).join(" + ")}
          </h2>
          <p className="mb-2 text-sm">
            {prettyDate(a.startsAt)} · {clock(a.startsAt)}
          </p>
          <p className="mb-2 text-sm">{salon.settings.address}</p>
          <p className="serif mb-0 mt-5 text-2xl">{money(a.total)}</p>
        </div>
        {salon.active && a.status === "confirmed" && (
          <div className="mb-7">
            <Button asChild>
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                Confirmar por WhatsApp
              </a>
            </Button>
            <p className="mt-3 text-xs muted">
              Tu espacio ya está reservado. Este botón abre el chat del salón;
              pulsa Enviar en WhatsApp para compartir los datos de tu cita.
            </p>
          </div>
        )}
        <p className="mb-6 text-xs muted">
          Los cambios requieren {salon.settings.cancellationHours} horas de
          anticipación. Guarda este enlace en privado: permite gestionar tu
          cita.
        </p>
        <ManageAppointment
          token={token}
          canChange={
            salon.active &&
            a.status === "confirmed" &&
            +a.startsAt - Date.now() >=
              salon.settings.cancellationHours * 3600000
          }
          completed={salon.active && a.status === "completed"}
        />
      </main>
    );
  } finally {
    await close();
  }
}
