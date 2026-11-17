import { DeveloperCredit } from "@/components/developer-credit";
import type { CSSProperties } from "react";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { panelAccess } from "@/lib/access";
import { salonData } from "@/lib/data";
import { PanelSidebar } from "@/components/panel-sidebar";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Mi salón",
  robots: { index: false, follow: false },
};
async function logout() {
  "use server";
  if (process.env.DATABASE_URL)
    await auth().api.signOut({ headers: await headers() });
  (await cookies()).delete("glowbook-demo");
  redirect("/acceso");
}
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await panelAccess(),
    d = await salonData(access.slug);
  if (!d) redirect("/acceso");
  return (
    <div
      style={
        {
          "--salon-primary": d.salon.primaryColor,
          "--salon-accent": d.salon.accentColor,
        } as CSSProperties
      }
    >
      <PanelSidebar
        name={d.salon.name}
        slug={access.slug}
        role={access.role}
        demo={access.demo}
      />
      <div className="lg:ml-[228px]">
        <header className="flex h-19 items-center justify-between gap-4 border-b border-border bg-white/70 px-6 md:px-9">
          <div className="flex items-center gap-2 text-[11px] muted">
            <span>Mi salón</span>
            <span className="text-border">/</span>
            <span className="text-foreground">{d.salon.settings.city}</span>
          </div>
          <div className="flex items-center gap-5">
            <Link
              href={`/${access.slug}`}
              target="_blank"
              className="hidden items-center gap-1.5 text-[10px] muted sm:flex"
            >
              Ver mi página <ArrowUpRight size={12} />
            </Link>
            <span className="h-6 border-r border-border" />
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-[#e8dbdf] text-[10px] text-primary">
                {access.role === "owner" ? "DS" : "PR"}
              </span>
              <span className="hidden text-[10px] sm:block">
                {access.role === "owner" ? "Dueña del salón" : "Profesional"}
                <span className="block text-[9px] muted">
                  {access.demo ? "Modo demo" : "Mi espacio"}
                </span>
              </span>
            </div>
            <LogoutButton action={logout} />
          </div>
        </header>
        {access.demo && (
          <div className="border-b border-[#e9dfd0] bg-[#f5efe3] px-6 py-2 text-[10px] text-[#8a7250] md:px-9">
            ✦ Estás en el demo de Nails & Glam. Datos ficticios · Explora con
            calma, los cambios no se guardan.
          </div>
        )}
        <main
          id="contenido"
          className="mx-auto max-w-[1600px] px-5 py-8 pb-24 md:px-9"
        >
          {children}
        </main>
        <footer className="flex flex-wrap justify-between gap-3 border-t border-border px-9 py-5 text-[9px] muted">
          <span>
            GlowBook · <DeveloperCredit />
          </span>
          <span>Hora de Bogotá · Pesos colombianos</span>
        </footer>
      </div>
    </div>
  );
}
