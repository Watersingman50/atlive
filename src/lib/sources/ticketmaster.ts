import type { SourceAdapter } from "./adapter.js";
import type { CanonicalEvent } from "../types.js";

// Ticketmaster Discovery API — the reliable spine (Stage A).
// Free tier: 5 req/s, 5000/day, deep-paging cap (size*page < 1000).
//
//   fetchEvents()
//     ├─ page 0..N  (size 100, dmaId=220 Atlanta, classification=music)
//     │    ├─ 200 → collect ._embedded.events, sleep 250ms (stay <5 req/s)
//     │    ├─ 429 → exponential backoff + retry (T4 hardening: tested)
//     │    └─ 5xx/network → throw (caller logs, keeps other sources)
//     └─ normalize each → CanonicalEvent

const BASE = "https://app.ticketmaster.com/discovery/v2/events.json";
const ATLANTA_DMA = "220";
const PAGE_SIZE = 100;
const MAX_PAGES = 9; // deep-paging cap: size*page < 1000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface TMEvent {
  id: string;
  name: string;
  url?: string;
  dates?: { start?: { localDate?: string; dateTime?: string } };
  images?: { url: string; width: number }[];
  priceRanges?: { min?: number }[];
  classifications?: { genre?: { name?: string } }[];
  _embedded?: {
    venues?: { name?: string }[];
    attractions?: { name?: string }[];
  };
}

function normalize(e: TMEvent): CanonicalEvent {
  const venue = e._embedded?.venues?.[0]?.name ?? null;
  const artist = e._embedded?.attractions?.[0]?.name ?? null;
  const image =
    e.images?.slice().sort((a, b) => b.width - a.width)[0]?.url ?? null;
  const minPrice = e.priceRanges
    ?.map((p) => p.min)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b)[0];
  const genreName = e.classifications?.[0]?.genre?.name;
  const genre = genreName && genreName !== "Undefined" ? genreName : null;
  return {
    sourceEventId: e.id,
    source: "ticketmaster",
    title: e.name,
    artist,
    venueName: venue,
    genre,
    eventDate: e.dates?.start?.localDate ?? null,
    startsAt: e.dates?.start?.dateTime ?? null,
    url: e.url ?? null,
    imageUrl: image,
    minPrice: minPrice ?? null,
    raw: e,
  };
}

async function fetchPage(key: string, page: number, params: URLSearchParams): Promise<{
  events: TMEvent[];
  totalPages: number;
}> {
  const url = `${BASE}?${params}&page=${page}&apikey=${key}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.status === 429) {
      await sleep(1000 * 2 ** attempt); // backoff
      continue;
    }
    if (!res.ok) throw new Error(`Ticketmaster ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      _embedded?: { events?: TMEvent[] };
      page?: { totalPages?: number };
    };
    return {
      events: data._embedded?.events ?? [],
      totalPages: data.page?.totalPages ?? 0,
    };
  }
  throw new Error("Ticketmaster: rate-limited after retries");
}

export function ticketmasterAdapter(opts?: { days?: number }): SourceAdapter {
  return {
    name: "ticketmaster",
    async fetchEvents() {
      const key = process.env.TM_API_KEY;
      if (!key) throw new Error("TM_API_KEY missing");

      const days = opts?.days ?? 8;
      const start = new Date();
      const end = new Date(Date.now() + days * 86_400_000);
      const iso = (d: Date) => d.toISOString().slice(0, 19) + "Z";

      const params = new URLSearchParams({
        dmaId: ATLANTA_DMA,
        classificationName: "music",
        startDateTime: iso(start),
        endDateTime: iso(end),
        size: String(PAGE_SIZE),
        sort: "date,asc",
      });

      const all: CanonicalEvent[] = [];
      let totalPages = 1;
      for (let page = 0; page < Math.min(totalPages, MAX_PAGES); page++) {
        const { events, totalPages: tp } = await fetchPage(key, page, params);
        totalPages = tp;
        all.push(...events.map(normalize));
        await sleep(250); // stay comfortably under 5 req/s
      }
      return all;
    },
  };
}
