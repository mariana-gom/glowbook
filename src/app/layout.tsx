import type { Metadata, Viewport } from "next";
import "./globals.css";
import { developer } from "@/lib/credits";
export const maxDuration = 300;
export const metadata: Metadata = {
  authors: [{ name: developer.name, url: developer.href }],
  creator: developer.name,
  publisher: developer.name,
  title: {
    default: "GlowBook · Tu negocio, en su mejor momento",
    template: "%s · GlowBook",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GlowBook · Mariana Gomez",
  },
  icons: { apple: "/icons/apple-touch-icon.png" },
  description:
    "Reservas sencillas y una agenda que trabaja por ti. La plataforma para salones de uñas y belleza en Colombia.",
};
export const viewport: Viewport = {
  themeColor: "#754c60",
  width: "device-width",
  initialScale: 1,
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-CO" data-scroll-behavior="smooth">
      <body>
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:p-4"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
