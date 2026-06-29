import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Static routes for now. Neighborhood/genre landing pages get appended here
// once the keyword map lands (task 1, part 2).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/pipeline`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
  ];
}
