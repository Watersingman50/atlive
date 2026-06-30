import { getUpcomingEvents } from "../lib/events.js";
import { blueskyPost, tweetText } from "./compose.js";
import { postToBluesky } from "./bluesky.js";
import { postToX, type PostResult } from "./twitter.js";

// Weekly auto-poster: builds the week's post and pushes it to every platform
// whose credentials are set. Platforms without creds are skipped (not failures)
// so this is a safe no-op until keys land. A platform that HAS creds but errors
// is a real failure → non-zero exit so the workflow's alert fires.

async function main() {
  const { events, error } = await getUpcomingEvents(7);
  if (error) {
    console.error(`social: events query failed: ${error}`);
    process.exit(1);
  }
  if (events.length === 0) {
    console.log("social: no upcoming events this week — nothing to post.");
    return;
  }

  const results: PostResult[] = [
    await postToBluesky(blueskyPost(events)),
    await postToX(tweetText(events)),
  ];

  for (const r of results) {
    if (r.skipped) console.log(`social: ${r.platform} skipped (${r.error}).`);
    else if (r.ok) console.log(`social: ${r.platform} posted${r.id ? ` — ${r.id}` : ""}.`);
    else console.error(`social: ${r.platform} FAILED — ${r.error}`);
  }

  const realFailure = results.some((r) => !r.ok && !r.skipped);
  if (realFailure) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
