import type { SourceAdapter } from "../lib/sources/adapter.js";
import { ticketmasterAdapter } from "../lib/sources/ticketmaster.js";
import { venue529Adapter } from "../lib/sources/venue529.js";
import { varietyAdapter } from "../lib/sources/variety.js";
import { getClient, upsertEvents, getEventsNeedingBlurbs, setBlurb } from "../lib/db.js";
import { generateBlurb, blurbsEnabled } from "../lib/llm/blurb.js";

// Ingest entrypoint. Runs on a schedule via GitHub Actions (T2).
//
//   for each adapter:  fetch+normalize  ──► (best-effort; one source failing
//                                            does not abort the others, so the
//                                            site degrades to TM-only, T4/X3)
//   then:              upsert all into Supabase  (skipped in --dry-run)
//
// Stage A ships with [ticketmaster] only. Stage B appends the 529 + Variety
// adapters to this list — no other change needed.

const adapters: SourceAdapter[] = [ticketmasterAdapter(), venue529Adapter(), varietyAdapter()];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const collected = [];

  for (const a of adapters) {
    try {
      const events = await a.fetchEvents();
      console.log(`[${a.name}] fetched ${events.length} events`);
      collected.push(...events);
    } catch (err) {
      // best-effort: log and keep going so one dead source never kills the run
      console.error(`[${a.name}] FAILED: ${(err as Error).message}`);
    }
  }

  console.log(`total normalized: ${collected.length}`);

  if (dryRun) {
    console.log("--dry-run: skipping DB writes. Sample:");
    for (const e of collected.slice(0, 5)) {
      console.log(`  ${e.eventDate ?? "?"}  ${e.title} @ ${e.venueName ?? "?"}`);
    }
    return;
  }

  const db = getClient();
  if (!db) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — run with --dry-run, or fill .env.local.");
    process.exit(1);
  }
  const res = await upsertEvents(db, collected);
  console.log(`upserted: ${res.created} new, ${res.merged} merged (fuzzy), ${res.sources} source rows`);

  // T8: fill missing blurbs (generate-once, bounded). Best-effort — a blurb
  // failure never fails the ingest; the page falls back to the title.
  if (!blurbsEnabled()) {
    console.log("blurbs: skipped (no ANTHROPIC_API_KEY)");
    return;
  }
  const need = await getEventsNeedingBlurbs(db, 40);
  let filled = 0;
  for (const e of need) {
    try {
      const blurb = await generateBlurb({ title: e.title, artist: e.artist, venue: e.venue_name });
      if (blurb) {
        await setBlurb(db, e.id, blurb);
        filled++;
      }
    } catch {
      break; // rate-limited or fatal LLM error — stop the batch, retry next run
    }
  }
  console.log(`blurbs: filled ${filled}/${need.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
