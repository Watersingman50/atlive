import { readFileSync, writeFileSync } from "node:fs";
import { parse529Html } from "../src/lib/sources/venue529.js";
import { parseVarietyFeed } from "../src/lib/sources/variety.js";
import { scoreExtraction, type ParsedLike } from "../src/lib/extraction-eval.js";
import { LABELS } from "./labels.js";

// Extraction-accuracy eval (T5). Runs the pure parsers over captured raw
// fixtures and scores artist/date/venue extraction against hand-labeled ground
// truth. Prints the accuracy + every miss, and writes results.json so the
// /pipeline page can chart the SAME measured numbers (no hand-typed figures).

const html = readFileSync(new URL("fixtures/529-calendar.html", import.meta.url), "utf8");
const varietyJson = JSON.parse(
  readFileSync(new URL("fixtures/variety-feed.json", import.meta.url), "utf8"),
) as { events?: [] };

const parsed = new Map<string, ParsedLike>();
for (const e of parse529Html(html)) parsed.set(`529:${e.sourceEventId}`, e);
for (const e of parseVarietyFeed(varietyJson)) parsed.set(`variety:${e.sourceEventId}`, e);

const result = scoreExtraction(parsed, LABELS);

console.log(
  `\nExtraction accuracy: ${result.overall.correct}/${result.overall.total} fields correct ` +
    `(${result.overall.pct}%) across ${result.labeledCount} labeled events`,
);
console.log(
  "Per field: " + result.byField.map((f) => `${f.field} ${f.correct}/${f.total}`).join("  ·  "),
);
if (result.misses.length > 0) {
  console.log("\nMisses:");
  for (const m of result.misses) console.log(`  - ${m.id}  ${m.field}: expected "${m.expected}", got "${m.got}"`);
} else {
  console.log("All labeled fields extracted correctly.");
}

// Serialize for the page to import. Pretty-printed so the diff is reviewable.
const out = new URL("results.json", import.meta.url);
writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
console.log(`\nWrote ${out.pathname.split("/").pop()}`);
