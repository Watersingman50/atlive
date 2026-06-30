import type { UpcomingEvent } from "@/lib/events";
import { neighborhoodOf } from "@/lib/neighborhoods";

// Server-rendered event grid for landing pages. Static (no client JS / motion)
// so the list is fully crawlable — better for SEO than the homepage's
// client-filtered board. Reuses the same .grid/.pcard CSS for visual parity.
// Card markup is intentionally a trimmed copy of EventsBoard's (no filters /
// animation); kept separate so SEO pages stay server components.

const safeUrl = (u: string | null): string | null => (u && /^https?:\/\//i.test(u) ? u : null);

const fmtDate = (s: string | null) =>
  s
    ? new Date(s + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "TBA";
const fmtTime = (s: string | null) =>
  s ? new Date(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;

export default function LandingEvents({ events }: { events: UpcomingEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="empty">
        <p>No shows on the board for this right now — the pipeline ingests every few hours, so fresh listings land automatically. Check back soon.</p>
        <a className="empty-act" href="/">
          Browse everything in Atlanta →
        </a>
      </div>
    );
  }

  return (
    <div className="grid">
      {events.map((e) => {
        const sources = [...new Set(e.event_sources.map((s) => s.source))];
        const time = fmtTime(e.starts_at);
        const link = safeUrl(e.url);
        const img = safeUrl(e.image_url);
        const initial = (e.artist || e.title || "?").trim().charAt(0);
        const hoodName = neighborhoodOf(e.venue_name);
        return (
          <article key={e.id} className="pcard">
            <div className="pcard-media">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" loading="lazy" className="pcard-img" />
              ) : (
                <div className="pcard-ph" aria-hidden="true">
                  {initial}
                </div>
              )}
              <div className="pcard-scrim" />
              <div className="pcard-cap">
                <div className="pcard-date">
                  {fmtDate(e.event_date)}
                  {time ? ` · ${time}` : ""}
                </div>
                <h2 className="pcard-title">
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer">
                      {e.title}
                    </a>
                  ) : (
                    e.title
                  )}
                </h2>
              </div>
            </div>
            <div className="pcard-meta">
              <div className="pcard-venue">
                {e.venue_name ?? "Venue TBA"}
                <span className="dot">·</span>
                <span className="hoodtag">{hoodName}</span>
              </div>
              {e.blurb && <p className="pcard-blurb">{e.blurb}</p>}
              <div className="pcard-foot">
                {e.genre && <span className="chip genre">{e.genre}</span>}
                {sources.length > 1 && <span className="chip multi">seen in {sources.length} sources</span>}
                {sources.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
                {e.min_price != null && <span className="price">from ${e.min_price}</span>}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
