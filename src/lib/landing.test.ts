import { test } from "node:test";
import assert from "node:assert/strict";
import type { UpcomingEvent } from "./events.js";
import { landingPages, landingSlugs, findLanding } from "./landing.js";

function ev(over: Partial<UpcomingEvent>): UpcomingEvent {
  return {
    id: "x",
    title: "Show",
    artist: null,
    venue_name: null,
    genre: null,
    event_date: "2026-07-04",
    starts_at: null,
    url: null,
    image_url: null,
    min_price: null,
    blurb: null,
    rank_score: null,
    event_sources: [],
    ...over,
  };
}

test("landing slugs are unique and cover both kinds", () => {
  const slugs = landingSlugs();
  assert.equal(new Set(slugs).size, slugs.length);
  const kinds = new Set(landingPages().map((p) => p.kind));
  assert.ok(kinds.has("neighborhood"));
  assert.ok(kinds.has("genre"));
});

test("genre page matches its genre and rejects others", () => {
  const jazz = findLanding("jazz");
  assert.ok(jazz);
  assert.equal(jazz!.match(ev({ genre: "Jazz" })), true);
  assert.equal(jazz!.match(ev({ genre: "Rock" })), false);
  assert.equal(jazz!.match(ev({ genre: null })), false);
});

test("hip-hop page matches the Ticketmaster 'Hip-Hop/Rap' classification", () => {
  const hh = findLanding("hip-hop");
  assert.ok(hh);
  assert.equal(hh!.match(ev({ genre: "Hip-Hop/Rap" })), true);
  // and must NOT swallow pop
  assert.equal(findLanding("pop")!.match(ev({ genre: "Hip-Hop/Rap" })), false);
});

test("neighborhood page matches by venue substring", () => {
  const eav = findLanding("east-atlanta-village");
  assert.ok(eav);
  assert.equal(eav!.match(ev({ venue_name: "529 Atlanta" })), true);
  assert.equal(eav!.match(ev({ venue_name: "Variety Playhouse" })), false);
});

test("default copy is keyword-shaped and mentions the label", () => {
  const jazz = findLanding("jazz")!;
  assert.ok(jazz.title.includes("Jazz"));
  assert.ok(/atlanta/i.test(jazz.title));
  const eav = findLanding("east-atlanta-village")!;
  assert.ok(eav.h1.includes("East Atlanta Village"));
});
