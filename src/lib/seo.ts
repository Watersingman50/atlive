import type { UpcomingEvent } from "./events";

// schema.org/Event JSON-LD builders for the homepage. We do NOT have on-domain
// event detail pages (events link out to Ticketmaster), so this is the
// "all details on one page" form: an ItemList whose items carry full Event
// objects. offers.url points to the ticketing page (correct per schema) — that
// is where you actually buy.

const httpUrl = (u: string | null): string | undefined =>
  u && /^https?:\/\//i.test(u) ? u : undefined;

/** Build one Event object, or null if it lacks the required fields. */
export function eventJsonLd(e: UpcomingEvent): Record<string, unknown> | null {
  // schema.org Event requires name + startDate + location.
  if (!e.event_date || !e.venue_name) return null;

  const ticket = httpUrl(e.url);
  const img = httpUrl(e.image_url);
  const offers =
    ticket != null
      ? {
          "@type": "Offer",
          url: ticket,
          availability: "https://schema.org/InStock",
          ...(e.min_price != null ? { price: e.min_price, priceCurrency: "USD" } : {}),
        }
      : undefined;

  return {
    "@type": "Event",
    name: e.title,
    startDate: e.starts_at ?? e.event_date,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: e.venue_name,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Atlanta",
        addressRegion: "GA",
        addressCountry: "US",
      },
    },
    ...(img ? { image: [img] } : {}),
    ...(e.artist ? { performer: { "@type": "MusicGroup", name: e.artist } } : {}),
    ...(ticket ? { url: ticket } : {}),
    ...(offers ? { offers } : {}),
  };
}

/** Wrap a set of events in an ItemList. `name` defaults to the homepage list. */
export function itemListJsonLd(
  events: UpcomingEvent[],
  name = "Live music in Atlanta this week",
): Record<string, unknown> {
  const items = events.map(eventJsonLd).filter((x): x is Record<string, unknown> => x !== null);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item,
    })),
  };
}

/** Serialize JSON-LD for safe injection into a <script> tag (escape `<`). */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
