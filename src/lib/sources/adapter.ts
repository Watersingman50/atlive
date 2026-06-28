import type { CanonicalEvent } from "../types.js";

/**
 * Every data source (Ticketmaster API, 529 scraper, Variety scraper) implements
 * this one interface, so the ingest runner treats them uniformly and we never
 * grow per-source branching in the pipeline. Add a source = add an adapter.
 */
export interface SourceAdapter {
  /** Matches event_sources.source, e.g. 'ticketmaster' | '529' | 'variety'. */
  readonly name: string;
  /** Fetch + normalize this source's current Atlanta events. */
  fetchEvents(): Promise<CanonicalEvent[]>;
}
