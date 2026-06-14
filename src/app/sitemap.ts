import type { MetadataRoute } from "next";

const SITE_URL = "https://www.vh-beyondthehorizons.org";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/program", priority: 0.9, changeFrequency: "monthly" },
    { path: "/eligibility-checker", priority: 0.8, changeFrequency: "monthly" },
    { path: "/registration", priority: 0.8, changeFrequency: "monthly" },
    { path: "/registration/courses", priority: 0.7, changeFrequency: "monthly" },
    { path: "/registration/games", priority: 0.6, changeFrequency: "monthly" },
  ];

  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
