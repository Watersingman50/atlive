import { getThisWeekEvents, type ThisWeekEvent } from "@/lib/events";

// ISR: statically rendered, revalidated hourly. Reads cache the join query so
// per-visitor requests never hit Supabase, and the page never goes blank — if a
// refresh fails, the last good render keeps serving (X3 liveness).
export const revalidate = 3600;

const fmtDay = (iso: string | null) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "Date TBA";

const fmtTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

function groupByDate(events: ThisWeekEvent[]): [string, ThisWeekEvent[]][] {
  const map = new Map<string, ThisWeekEvent[]>();
  for (const e of events) {
    const key = e.event_date ?? "TBA";
    (map.get(key) ?? map.set(key, []).get(key)!).push(e);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export default async function Home() {
  const { events, error, fetchedAt } = await getThisWeekEvents();
  const groups = groupByDate(events);

  return (
    <main className="wrap">
      <header>
        <h1>What&apos;s on in Atlanta this week</h1>
        <p>Live music across the city, aggregated and deduped from multiple sources.</p>
        <p className="freshness">
          {events.length} events · updated{" "}
          {new Date(fetchedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </header>

      {error && events.length === 0 ? (
        <div className="error">Couldn&apos;t load events right now. Check back shortly.</div>
      ) : events.length === 0 ? (
        <div className="empty">No events found for the week ahead yet.</div>
      ) : (
        groups.map(([date, dayEvents]) => (
          <section className="daygroup" key={date}>
            <h2>{fmtDay(date === "TBA" ? null : date)}</h2>
            {dayEvents.map((e) => {
              const sources = [...new Set(e.event_sources.map((s) => s.source))];
              const time = fmtTime(e.starts_at);
              return (
                <article className="event" key={e.id}>
                  {e.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.image_url} alt="" loading="lazy" />
                  )}
                  <div className="body">
                    <div className="title">
                      {e.url ? (
                        <a href={e.url} target="_blank" rel="noopener noreferrer">
                          {e.title}
                        </a>
                      ) : (
                        e.title
                      )}
                    </div>
                    <div className="meta">
                      {e.venue_name ?? "Venue TBA"}
                      {time ? ` · ${time}` : ""}
                    </div>
                    {e.blurb && <p className="blurb">{e.blurb}</p>}
                    {e.min_price != null && <div className="price">from ${e.min_price}</div>}
                    <div className="badges">
                      {sources.length > 1 && (
                        <span className="badge multi">seen in {sources.length} sources</span>
                      )}
                      {sources.map((s) => (
                        <span className="badge" key={s}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ))
      )}
    </main>
  );
}
