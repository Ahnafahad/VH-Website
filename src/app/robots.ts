import type { MetadataRoute } from "next";

const SITE_URL = "https://www.vh-beyondthehorizons.org";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/superadminahad/",
          "/results/admin/",
          "/auth/",
          "/ui-preview/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
