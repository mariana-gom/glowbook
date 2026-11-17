import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/panel",
        "/superadmin",
        "/gestionar/",
        "/acceso",
        "/demo",
        "/nails-glam-studio",
      ],
    },
  };
}
