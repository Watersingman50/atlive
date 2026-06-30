import type { UpcomingEvent } from "./events";
import { neighborhoodOf } from "./neighborhoods";

// SEO landing-page engine (task 1, part 2). Each landing page is a winnable
// aggregation query — "jazz concerts atlanta", "live music in east atlanta
// village" — that we can rank for without thin per-event pages (events link
// out to Ticketmaster). A page renders the week's events filtered to its
// neighborhood or genre, with its own title/description/JSON-LD + a signup CTA,
// so SEO traffic funnels into the newsletter.
//
// ─────────────────────────────────────────────────────────────────────────────
// KEYWORD MAP PLUGS IN HERE → see COPY_OVERRIDES at the bottom of this file.
// Defaults are auto-generated from the label. To target a specific query, add
// an entry keyed by slug with any of { title, description, h1, intro }. No
// other code changes needed — overrides flow into metadata, the <h1>, and the
// sitemap automatically.
// ─────────────────────────────────────────────────────────────────────────────

export interface LandingPage {
  slug: string; // URL segment, e.g. "east-atlanta-village" | "jazz"
  kind: "neighborhood" | "genre";
  label: string; // human label, e.g. "East Atlanta Village" | "Jazz"
  title: string; // <title> + OG title
  description: string; // meta description
  h1: string;
  intro: string; // crawlable intro paragraph
  match: (e: UpcomingEvent) => boolean;
}

const kebab = (s: string): string =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Neighborhoods we can place venues into (the distinct values produced by
// neighborhoodOf). "Atlanta" is the unknown-fallback, not a real area, so it's
// excluded — a citywide page would just duplicate the homepage.
const NEIGHBORHOODS = [
  "Little Five Points",
  "East Atlanta Village",
  "West Midtown",
  "Old Fourth Ward",
  "Reynoldstown",
  "Poncey-Highland",
  "Buckhead",
  "Downtown",
  "Midtown",
  "The Battery",
  "Lakewood",
];

// Genres → the substrings that identify them in a Ticketmaster genre string
// (matched case-insensitively, so "Hip-Hop/Rap" hits the hip-hop page).
const GENRES: { slug: string; label: string; keys: string[] }[] = [
  { slug: "rock", label: "Rock", keys: ["rock"] },
  { slug: "hip-hop", label: "Hip-Hop", keys: ["hip-hop", "hip hop", "rap"] },
  { slug: "pop", label: "Pop", keys: ["pop"] },
  { slug: "country", label: "Country", keys: ["country"] },
  { slug: "jazz", label: "Jazz", keys: ["jazz"] },
  { slug: "electronic", label: "Electronic", keys: ["electronic", "dance", "edm", "house", "techno"] },
  { slug: "rnb-soul", label: "R&B & Soul", keys: ["r&b", "rnb", "soul"] },
  { slug: "metal", label: "Metal", keys: ["metal", "hard rock"] },
  { slug: "indie", label: "Indie & Alternative", keys: ["indie", "alternative", "alt"] },
  { slug: "folk", label: "Folk & Americana", keys: ["folk", "americana", "bluegrass"] },
];

function neighborhoodDefaults(label: string) {
  return {
    title: `Live Music in ${label}, Atlanta — Shows This Week | ATLive`,
    description: `Upcoming concerts and live shows in ${label}, Atlanta. Auto-updated every few hours — find what's on near ${label} this week.`,
    h1: `Live music in ${label}`,
    intro: `Every upcoming show at ${label} venues, in one place. ${label} is one of Atlanta's live-music neighborhoods — here's what's coming up, updated automatically.`,
  };
}

function genreDefaults(label: string) {
  return {
    title: `${label} Concerts in Atlanta — Upcoming Shows | ATLive`,
    description: `Upcoming ${label} concerts and live shows in Atlanta this week. An auto-updated lineup of ${label} gigs across the city.`,
    h1: `${label} shows in Atlanta`,
    intro: `Every upcoming ${label} show in Atlanta, in one place — pulled from Ticketmaster and direct venue feeds, deduped, and updated automatically.`,
  };
}

let cache: LandingPage[] | null = null;

/** All landing pages (neighborhood + genre), with copy overrides applied. */
export function landingPages(): LandingPage[] {
  if (cache) return cache;

  const hoods: LandingPage[] = NEIGHBORHOODS.map((label) => {
    const slug = kebab(label);
    return {
      slug,
      kind: "neighborhood" as const,
      label,
      ...neighborhoodDefaults(label),
      ...COPY_OVERRIDES[slug],
      match: (e: UpcomingEvent) => neighborhoodOf(e.venue_name) === label,
    };
  });

  const genres: LandingPage[] = GENRES.map(({ slug, label, keys }) => ({
    slug,
    kind: "genre" as const,
    label,
    ...genreDefaults(label),
    ...COPY_OVERRIDES[slug],
    match: (e: UpcomingEvent) => {
      const g = (e.genre ?? "").toLowerCase();
      return g.length > 0 && keys.some((k) => g.includes(k));
    },
  }));

  cache = [...hoods, ...genres];
  return cache;
}

export function findLanding(slug: string): LandingPage | undefined {
  return landingPages().find((p) => p.slug === slug);
}

export function landingSlugs(): string[] {
  return landingPages().map((p) => p.slug);
}

// ─────────────────────────────────────────────────────────────────────────────
// COPY OVERRIDES — the keyword map lives here. Key by slug; supply any of
// { title, description, h1, intro }. Anything omitted keeps the auto default.
// Example:
//   "jazz": {
//     title: "Jazz Clubs & Live Jazz in Atlanta — This Week's Shows | ATLive",
//     h1: "Live jazz in Atlanta",
//   },
// ─────────────────────────────────────────────────────────────────────────────
const COPY_OVERRIDES: Record<string, Partial<Pick<LandingPage, "title" | "description" | "h1" | "intro">>> = {};
