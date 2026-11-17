import Link from "next/link";
import { Brand } from "@/components/brand";
export default function Privacy() {
  return (
    <main id="contenido" className="mx-auto max-w-2xl px-6 py-10">
      <Brand />
      <h1 className="mt-12 text-4xl">Tus datos, con cuidado.</h1>
      <p>
        Usamos tu nombre, celular y correo para gestionar tu reserva, permitir
        cambios y enviar comunicaciones relacionadas con la cita. El salón al
        que reservas es responsable de atender tus solicitudes sobre estos
        datos.
      </p>
      <p>
        Las promociones requieren tu autorización opcional y separada. No
        necesitas aceptarlas para reservar.
      </p>
      <p>
        Puedes pedir al salón que consulte, corrija o elimine tus datos mediante
        el número de WhatsApp que aparece en su página. El historial sujeto a
        obligaciones de conservación se atenderá según las reglas aplicables.
      </p>
      <p>
        El servicio utiliza Neon para almacenar datos, Vercel para alojar la
        plataforma, Resend para correo y, cuando está habilitado, Meta para
        WhatsApp. El enlace de gestión de tu cita es privado; evita compartirlo.
      </p>
      <p className="rounded-xl bg-muted p-5 text-sm">
        Esta versión es un MVP. Antes de recibir reservas reales, cada salón
        debe publicar su razón social, identificación, contacto de privacidad,
        plazos de conservación y política completa de tratamiento de datos.
      </p>
      <Link href="/" className="text-primary underline">
        Volver a GlowBook
      </Link>
    </main>
  );
}
