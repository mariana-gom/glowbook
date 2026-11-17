import Link from "next/link";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const q = await searchParams;
  return (
    <main id="contenido" className="mx-auto max-w-md px-6 py-12">
      <Brand />
      <p className="eyebrow mt-14 text-primary">QUÉ BUENO TENERTE DE VUELTA</p>
      <h1 className="mb-3 text-4xl">Un nuevo día para brillar.</h1>
      <p className="mb-8 muted">Tu agenda y tu equipo, en un mismo lugar.</p>
      {q.error && (
        <p role="alert" className="mb-5 rounded-xl bg-muted p-4 text-sm">
          Tu cuenta no tiene acceso a un salón activo. Pide a la administradora
          que revise tu membresía.
        </p>
      )}
      <LoginForm
        google={Boolean(process.env.GOOGLE_CLIENT_ID)}
        configured={Boolean(process.env.DATABASE_URL)}
      />
      <p className="mt-6 text-xs muted">
        Las cuentas son creadas por la administradora. Si necesitas recuperar tu
        acceso, contáctala para que lo restablezca.
      </p>
      <Link
        href="/demo"
        className="mt-6 block text-center text-xs text-primary underline"
      >
        Solo quiero explorar el demo
      </Link>
      <Link href="/superadmin" className="mt-6 block text-center text-xs muted">
        Acceso de administradora de la plataforma
      </Link>
    </main>
  );
}
