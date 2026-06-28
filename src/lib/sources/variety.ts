import type { SourceAdapter } from "./adapter.js";
import type { CanonicalEvent } from "../types.js";
import { aegAdapter, parseAegFeed, type AegEvent } from "./aeg.js";

// Variety Playhouse (AEG venue 214). Thin wrapper over the generic AEG adapter.
// `parseVarietyFeed` is kept as a named export for the extraction eval fixtures.

export function parseVarietyFeed(data: { events?: AegEvent[] }): CanonicalEvent[] {
  return parseAegFeed(data, { source: "variety", venueName: "Variety Playhouse" });
}

export function varietyAdapter(): SourceAdapter {
  return aegAdapter({ name: "variety", venueId: 214, venueName: "Variety Playhouse" });
}
