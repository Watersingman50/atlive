import { readFileSync } from "node:fs";
import { parse529Html } from "../src/lib/sources/venue529.js";
import { parseVarietyFeed } from "../src/lib/sources/variety.js";
import { LABELS } from "./labels.js";

// Extraction-accuracy eval (T5). Runs the pure parsers over captured raw
// fixtures and scores artist/date/venue extraction against hand-labeled ground
// truth. Prints a single accuracy number + every miss. This is the honest,
// measurable quality signal (per the eng review's X1) — the eval targets the
// messy-data extraction step, which has real ground truth, not LLM blurb taste.

const html = readFileSync(new URL("fixtures/529-calendar.html", import.meta.url), "utf8");
const varietyJson = JSON.parse(
  readFileSync(new URL("fixtures/variety-feed.json", import.meta.url), "utf8"),
) as { events?: [] };

interface Parsed {
  artist: string | null;
  eventDate: string | null;
  venueName: string | null;
}
const parsed = new Map<string, Parsed>();
for (const e of parse529Html(html)) parsed.set(`529:${e.sourceEventId}`, e);
for (const e of parseVarietyFeed(varietyJson)) parsed.set(`variety:${e.sourceEventId}`, e);

let correct = 0;
let total = 0;
const misses: string[] = [];

for (const L of LABELS) {
  const e = parsed.get(`${L.source}:${L.id}`);
  const checks: [string, string, string | null | undefined][] = [
    ["artist", L.artist, e?.artist],
    ["date", L.eventDate, e?.eventDate],
    ["venue", L.venue, e?.venueName],
  ];
  for (const [field, expected, got] of checks) {
    total++;
    if (got === expected) correct++;
    else misses.push(`${L.source}:${L.id}  ${field}: expected "${expected}", got "${got ?? "(not found)"}"`);
  }
}

const pct = ((correct / total) * 100).toFixed(1);
console.log(`\nExtraction accuracy: ${correct}/${total} fields correct (${pct}%) across ${LABELS.length} labeled events`);
if (misses.length > 0) {
  console.log("\nMisses:");
  for (const m of misses) console.log("  -", m);
} else {
  console.log("All labeled fields extracted correctly.");
}
