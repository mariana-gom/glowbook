import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GlowBook · Mi salón",
    short_name: "GlowBook",
    description: "Tu agenda, tus pendientes y tu equipo en un solo lugar.",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    lang: "es-CO",
    background_color: "#faf8f5",
    theme_color: "#754c60",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
