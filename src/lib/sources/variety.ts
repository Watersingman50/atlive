import type { SourceAdapter } from "./adapter.js";
import type { CanonicalEvent } from "../types.js";

// Variety Playhouse (AEG/AXS) — OVERLAP source: its shows are also in the
// Ticketmaster API, so the same event arrives from two sources. That overlap
// is what the dedup ("seen in N sources") demo needs. Data comes from AEG's
// static per-venue JSON feed (venue id 214) — structured, no headless browser.

const FEED = "https://aegwebprod.blob.core.windows.net/json/events/214/events.json";
const VENUE = "Variety Playhouse";

interface AegEvent {
  eventId: string | number;
  active?: boolean;
  eventDateTimeISO?: string;
  eventDateTime?: string;
  ticketPriceLow?: string;
  title?: { headlinersText?: string; eventTitleText?: string };
  ticketing?: { url?: string; eventUrl?: string };
  media?: Record<string, { file_name?: string }>;
}

function parsePrice(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function varietyAdapter(): SourceAdapter {
  return {
    name: "variety",
    async fetchEvents() {
      const res = await fetch(FEED, { headers: { "user-agent": "Mozilla/5.0 ATLive" } });
      if (!res.ok) throw new Error(`variety ${res.status}`);
      const data = (await res.json()) as { events?: AegEvent[] };
      const events: CanonicalEvent[] = [];

      for (const e of data.events ?? []) {
        if (e.active === false) continue;
        const iso = e.eventDateTimeISO ?? e.eventDateTime ?? null;
        const headFull = (e.title?.headlinersText ?? e.title?.eventTitleText ?? "").trim();
        if (!headFull) continue;
        // strip a trailing tour name ("Artist - The X Tour") for a cleaner dedup key
        const artist = (headFull.split(" - ")[0] ?? headFull).trim();
        const firstMedia = e.media ? Object.values(e.media)[0] : undefined;

        events.push({
          sourceEventId: String(e.eventId),
          source: "variety",
          title: headFull,
          artist,
          venueName: VENUE,
          eventDate: iso ? iso.slice(0, 10) : null,
          startsAt: iso,
          url: e.ticketing?.url ?? e.ticketing?.eventUrl ?? null,
          imageUrl: firstMedia?.file_name ?? null,
          minPrice: parsePrice(e.ticketPriceLow),
          raw: { eventId: e.eventId, headFull },
        });
      }
      return events;
    },
  };
}
