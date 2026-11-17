import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "GlowBook · Tu negocio, en su mejor momento",
    template: "%s · GlowBook",
  },
  description:
    "Reservas sencillas y una agenda que trabaja por ti. La plataforma para salones de uñas y belleza en Colombia.",
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
