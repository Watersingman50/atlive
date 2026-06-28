import { getUpcomingEvents } from "@/lib/events";
import EventsBoard from "./EventsBoard";

// ISR: statically rendered, revalidated hourly. The fetch + cache happen here
// (server); the interactive board below is a client component that filters and
// animates the already-loaded data — no per-interaction server round trips.
export const revalidate = 3600;

export default async function Home() {
  const { events, error, fetchedAt } = await getUpcomingEvents(14);
  return <EventsBoard events={events} error={error} fetchedAt={fetchedAt} />;
}
