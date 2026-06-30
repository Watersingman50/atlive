import { test } from "node:test";
import assert from "node:assert/strict";
import type { UpcomingEvent } from "../lib/events.js";
import { blueskyPost, tweetText, igCaption, redditPost } from "./compose.js";
import { SITE_URL } from "../lib/site.js";

function mk(i: number, over: Partial<UpcomingEvent> = {}): UpcomingEvent {
  return {
    id: `e${i}`,
    title: `A Reasonably Long Show Title Number ${i}`,
    artist: `Headliner Artist ${i}`,
    venue_name: `Some Atlanta Venue ${i}`,
    genre: i % 2 ? "Rock" : "Jazz",
    event_date: `2026-07-0${(i % 9) + 1}`,
    starts_at: null,
    url: "https://example.com/t",
    image_url: null,
    min_price: null,
    blurb: null,
    rank_score: 100 - i,
    event_sources: [{ source: "ticketmaster" }],
    ...over,
  };
}

const many = Array.from({ length: 12 }, (_, i) => mk(i));

test("blueskyPost stays within the 300-char limit and links out", () => {
  const p = blueskyPost(many);
  assert.ok(p.length <= 300, `len ${p.length}`);
  assert.ok(p.includes(SITE_URL));
  assert.ok(p.includes("Atlanta"));
});

test("tweetText stays within the 280-char limit and links out", () => {
  const p = tweetText(many);
  assert.ok(p.length <= 280, `len ${p.length}`);
  assert.ok(p.includes(SITE_URL));
});

test("igCaption includes base hashtags, link, and the top event", () => {
  const c = igCaption(many);
  assert.ok(c.includes("#atlanta"));
  assert.ok(c.includes(SITE_URL));
  assert.ok(c.includes("Headliner Artist 0"));
});

test("redditPost is a community roundup with a stable title", () => {
  const r = redditPost(many);
  assert.ok(r.title.startsWith("Live music in Atlanta this week"));
  assert.ok(r.body.includes(SITE_URL));
  assert.ok(r.body.includes("Headliner Artist 0"));
});

test("empty input still yields a valid (header+footer) post", () => {
  const p = blueskyPost([]);
  assert.ok(p.includes(SITE_URL));
  assert.ok(p.length <= 300);
});
