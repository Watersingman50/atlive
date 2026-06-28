// Fuzzy event matching (T4). Exact canonical_key (see types.ts) catches
// identical names; this catches the variants it misses: dropped articles
// ("The Earl" vs "Earl"), "&" vs "and", and tour suffixes ("Artist - The X Tour").
//
// Approach: TOKEN-SET CONTAINMENT, not edit distance. Live-music name variation
// is structural (extra/missing words, reordering) rather than typo-level, so set
// overlap matches the real failure mode and needs no dependency. The containment
// thresholds double as the false-merge guard: two different acts on the same
// night share few/no significant tokens, so they stay separate.

const STOP = new Set([
  "the", "a", "an", "and", "of", "with", "feat", "featuring", "ft",
  "presents", "tour", "live", "x", "vs", "plus",
]);

/** Significant lowercase tokens, parentheticals and stopwords removed. */
export function tokens(s: string | null): Set<string> {
  return new Set(
    (s ?? "")
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((t) => t.length > 0 && !STOP.has(t)),
  );
}

/** Fraction of the SMALLER set's tokens that appear in the larger (0..1). */
export function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const t of small) if (large.has(t)) shared++;
  return shared / small.size;
}

export function artistSimilar(a: string | null, b: string | null): boolean {
  return containment(tokens(a), tokens(b)) >= 0.8;
}

export function venueSimilar(a: string | null, b: string | null): boolean {
  return containment(tokens(a), tokens(b)) >= 0.5;
}

export interface Matchable {
  artist: string | null;
  venueName: string | null;
  eventDate: string | null;
}

/**
 * True if two events are the same real show. Requires an exact date match
 * (cheap, high-precision), a similar venue, and a similar artist. The artist
 * threshold is the false-merge guard: distinct acts the same night don't merge.
 */
export function sameEvent(a: Matchable, b: Matchable): boolean {
  if (!a.eventDate || !b.eventDate || a.eventDate !== b.eventDate) return false;
  if (!venueSimilar(a.venueName, b.venueName)) return false;
  return artistSimilar(a.artist, b.artist);
}
