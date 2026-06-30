import { test } from "node:test";
import assert from "node:assert/strict";
import type { UpcomingEvent } from "../lib/events.js";
import { posterSvg, posterPng } from "./image.js";

function mk(i: number, over: Partial<UpcomingEvent> = {}): UpcomingEvent {
  return {
    id: `e${i}`,
    title: `Show ${i}`,
    artist: `Artist <${i}> & Friends`,
    venue_name: `Venue ${i}`,
    genre: "Rock",
    event_date: `2026-07-0${(i % 9) + 1}`,
    starts_at: null,
    url: null,
    image_url: null,
    min_price: null,
    blurb: null,
    rank_score: 100 - i,
    event_sources: [],
    ...over,
  };
}

const events = Array.from({ length: 8 }, (_, i) => mk(i));

test("posterSvg is well-formed and XML-escapes real event data", () => {
  const svg = posterSvg(events);
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.trimEnd().endsWith("</svg>"));
  // The "<" and "&" in the artist name must be escaped, never raw in markup.
  assert.ok(svg.includes("Artist &lt;0&gt; &amp; Friends"));
  assert.ok(!svg.includes("Artist <0>"));
});

test("posterPng renders a valid PNG from the SVG + vendored font", () => {
  const png = posterPng(events);
  assert.ok(png.length > 1000, `png too small: ${png.length}`);
  // PNG magic number.
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});

test("posterSvg handles an empty week without throwing", () => {
  const svg = posterSvg([]);
  assert.ok(svg.startsWith("<svg"));
});
