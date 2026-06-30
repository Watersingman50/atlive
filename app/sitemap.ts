import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { landingPages } from "@/lib/landing";

// Static routes + every neighborhood/genre landing page (task 1, part 2).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const core: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/pipeline`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
  ];
  const landing: MetadataRoute.Sitemap = landingPages().map((p) => ({
    url: `${SITE_URL}/${p.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));
  return [...core, ...landing];
}
