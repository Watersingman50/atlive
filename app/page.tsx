import { getUpcomingEvents } from "@/lib/events";
import EventsBoard from "./EventsBoard";

// ISR: statically rendered, revalidated hourly. The fetch + cache happen here
// (server); the interactive board is a client component that filters/animates
// the loaded data — no per-interaction server round trips.
export const revalidate = 3600;

export default async function Home() {
  const { events, error, lastIngest } = await getUpcomingEvents(14);

  // Never-empty (X3 liveness): if the DB query fails, THROW so ISR keeps serving
  // the last good static render instead of caching an empty/broken page. A
  // genuinely empty result (no upcoming events) is not an error and renders the
  // empty state below.
  if (error) throw new Error(`events query failed: ${error}`);

  return <EventsBoard events={events} lastIngest={lastIngest} />;
}
