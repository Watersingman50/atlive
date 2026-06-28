// Shared shapes for the ingestion pipeline.

/** A normalized event, ready to become a canonical `events` row. */
export interface CanonicalEvent {
  /** Stable id from the source (TM event id, scraped slug, etc.). */
  sourceEventId: string;
  /** Which source produced this (matches event_sources.source). */
  source: string;
  title: string;
  artist: string | null;
  venueName: string | null;
  genre: string | null;
  /** Local show date, YYYY-MM-DD. */
  eventDate: string | null;
  /** Full local start time (ISO), when the source provides it. */
  startsAt: string | null;
  url: string | null;
  imageUrl: string | null;
  minPrice: number | null;
  /** Original payload, stored on event_sources.raw for debugging/eval. */
  raw: unknown;
}

/**
 * Dedup key: normalized `artist|date|venue`. Lowercased, punctuation stripped,
 * whitespace collapsed — so "The Earl" and "Earl", "Goose" and "Goose (Live)"
 * collapse toward the same key. Exact-key match here; fuzzy fallback is T4.
 */
export function canonicalKey(e: CanonicalEvent): string {
  const norm = (s: string | null) =>
    (s ?? "")
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")     // drop parentheticals like "(Live)", "(18+)"
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  return [norm(e.artist || e.title), e.eventDate ?? "", norm(e.venueName)].join("|");
}
