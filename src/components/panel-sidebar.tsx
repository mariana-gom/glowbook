"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  Bell,
  ListChecks,
  ChevronDown,
  Flower2,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  MessageSquare,
  Scissors,
  Settings2,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { Brand } from "./brand";
export function PanelSidebar({
  name,
  slug,
  role,
  demo,
}: {
  name: string;
  slug: string;
  role: string;
  demo: boolean;
}) {
  const path = usePathname(),
    [open, setOpen] = useState(false);
  const links = [
    { href: "/panel", label: "Vista general", icon: LayoutDashboard },
    { href: "/panel/agenda", label: "Mi agenda", icon: CalendarDays },
    { href: "/panel/clientas", label: "Clientas", icon: Heart },
    { href: "/panel/notificaciones", label: "Mi aplicación", icon: Bell },
    ...(role === "owner"
      ? [
          {
            href: "/panel/pendientes",
            label: "Pendientes de hoy",
            icon: ListChecks,
          },
          { href: "/panel/servicios", label: "Servicios", icon: Scissors },
          { href: "/panel/equipo", label: "Mi equipo", icon: Users },
          { href: "/panel/mensajes", label: "Mensajes", icon: MessageSquare },
        ]
      : []),
  ];
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 left-5 z-50 grid size-12 place-items-center rounded-full bg-primary text-white shadow-lg lg:hidden"
        aria-label={open ? "Cerrar navegación" : "Abrir navegación"}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <button
          aria-label="Cerrar navegación"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/25 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[228px] flex-col overflow-y-auto border-r border-border bg-[#f6f2ed] px-5 py-8 transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-9 px-2">
          <Brand />
        </div>
        <div className="mb-8 flex items-center gap-3 rounded-xl border border-border bg-white/60 px-3 py-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e8dcd9] text-primary">
            <Flower2 size={19} strokeWidth={1.3} />
          </div>
          <div className="min-w-0">
            <strong className="block truncate text-[10px] font-medium">
              {name}
            </strong>
            <span className="text-[9px] muted">
              {demo ? "ESPACIO DEMO" : "MI SALÓN"}
            </span>
          </div>
          <ChevronDown size={13} className="shrink-0 muted" />
        </div>
        <p className="eyebrow mb-4 px-3 text-[8px] muted">TU DÍA A DÍA</p>
        <nav className="space-y-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/panel" ? path === href : path.startsWith(href);
            return (
              <Link
                key={href}
                onClick={() => setOpen(false)}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-xs transition-colors ${active ? "bg-[#e9dedf] text-primary" : "text-muted-foreground hover:bg-white"}`}
              >
                <Icon size={16} strokeWidth={1.5} />
                <span>{label}</span>
                {active && (
                  <span className="ml-auto size-1 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 border-t border-border pt-6">
          <p className="eyebrow mb-4 px-3 text-[8px] muted">
            EL SIGUIENTE PASO
          </p>
          <div className="flex items-center gap-3 px-3 py-2 text-xs muted">
            <Sparkles size={16} strokeWidth={1.4} />
            <span>Crecer juntas</span>
            <span className="ml-auto rounded bg-[#eee5d5] px-1.5 text-[8px] text-[#8b724a]">
              PRONTO
            </span>
          </div>
        </div>
        <div className="mt-auto pt-6">
          <Link
            href={`/${slug}`}
            target="_blank"
            className="mb-6 flex items-center justify-between rounded-xl border border-[#ddd0c3] bg-[#f0e9df] p-4"
          >
            <span>
              <span className="serif mb-1 block text-lg">Tu salón, online</span>
              <span className="text-[10px] muted">Así te ven tus clientas</span>
            </span>
            <ArrowUpRight size={17} className="text-accent" />
          </Link>
          {role === "owner" && (
            <Link
              href="/panel/configuracion"
              onClick={() => setOpen(false)}
              className="mb-5 flex items-center gap-3 px-3 text-xs muted"
            >
              <Settings2 size={16} strokeWidth={1.5} />
              Configuración
            </Link>
          )}
          <Link
            href="/demo"
            className="flex items-center gap-3 px-3 text-xs muted"
          >
            <LifeBuoy size={16} strokeWidth={1.5} />
            {demo ? "Cambiar experiencia" : "Explorar GlowBook"}
          </Link>
          <div className="mt-6 border-t border-border px-3 pt-4 text-[9px] muted">
            Un poco más de calma. Un poco más de glow.
          </div>
        </div>
      </aside>
    </>
  );
}
