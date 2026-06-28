import type { SourceAdapter } from "./adapter.js";
import type { CanonicalEvent } from "../types.js";

// AEG Presents venues publish a static per-venue JSON feed (no headless browser
// needed). One factory serves every AEG venue — Variety Playhouse (214),
// Terminal West (211), etc. Many of these shows are also in the Ticketmaster
// API, so they drive the cross-source dedup ("seen in N sources").

export interface AegEvent {
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

/** Pure parser over an AEG feed JSON — eval/test-able without the network. */
export function parseAegFeed(
  data: { events?: AegEvent[] },
  opts: { source: string; venueName: string },
): CanonicalEvent[] {
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
      source: opts.source,
      title: headFull,
      artist,
      venueName: opts.venueName,
      genre: null,
      eventDate: iso ? iso.slice(0, 10) : null,
      startsAt: iso,
      url: e.ticketing?.url ?? e.ticketing?.eventUrl ?? null,
      imageUrl: firstMedia?.file_name ?? null,
      minPrice: parsePrice(e.ticketPriceLow),
      raw: { eventId: e.eventId, headFull },
    });
  }
  return events;
}

export function aegAdapter(opts: {
  name: string;
  venueId: number;
  venueName: string;
}): SourceAdapter {
  return {
    name: opts.name,
    async fetchEvents() {
      const feed = `https://aegwebprod.blob.core.windows.net/json/events/${opts.venueId}/events.json`;
      const res = await fetch(feed, { headers: { "user-agent": "Mozilla/5.0 ATLive" } });
      if (!res.ok) throw new Error(`${opts.name} ${res.status}`);
      const data = (await res.json()) as { events?: AegEvent[] };
      return parseAegFeed(data, { source: opts.name, venueName: opts.venueName });
    },
  };
}
