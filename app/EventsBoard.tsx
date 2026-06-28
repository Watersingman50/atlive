"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { UpcomingEvent } from "@/lib/events";

type DateFilter = "all" | "this" | "next";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtDate = (s: string | null) =>
  s
    ? new Date(s + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "TBA";
const fmtTime = (s: string | null) =>
  s ? new Date(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;

export default function EventsBoard({
  events,
  error,
  fetchedAt,
}: {
  events: UpcomingEvent[];
  error: string | null;
  fetchedAt: string;
}) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [venue, setVenue] = useState<string>("all");
  const [genre, setGenre] = useState<string>("all");

  const today = iso(new Date());
  const in7 = iso(new Date(Date.now() + 7 * 86_400_000));

  const venues = useMemo(
    () => [...new Set(events.map((e) => e.venue_name).filter((v): v is string => !!v))].sort(),
    [events],
  );
  const genres = useMemo(() => {
    const set = new Set<string>();
    let hasOther = false;
    for (const e of events) {
      if (e.genre) set.add(e.genre);
      else hasOther = true;
    }
    const list = [...set].sort();
    if (hasOther) list.push("Other");
    return list;
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (venue !== "all" && e.venue_name !== venue) return false;
      if (genre !== "all" && (e.genre ?? "Other") !== genre) return false;
      if (dateFilter !== "all" && e.event_date) {
        const inThisWeek = e.event_date >= today && e.event_date < in7;
        if (dateFilter === "this" && !inThisWeek) return false;
        if (dateFilter === "next" && inThisWeek) return false;
      }
      return true;
    });
  }, [events, venue, genre, dateFilter, today, in7]);

  const sourceCount = useMemo(
    () => new Set(filtered.flatMap((e) => e.event_sources.map((s) => s.source))).size,
    [filtered],
  );

  return (
    <main className="wrap">
      <header className="head">
        <h1>
          What&apos;s on in <span className="accent">Atlanta</span>
        </h1>
        <p className="sub">Live music across the city — aggregated and deduped from multiple sources.</p>
        <p className="stat" aria-live="polite">
          <strong>{filtered.length}</strong> {filtered.length === 1 ? "event" : "events"} from{" "}
          <strong>{sourceCount}</strong> {sourceCount === 1 ? "source" : "sources"}
          <span className="fresh">
            {" · updated "}
            {new Date(fetchedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </p>
      </header>

      <div className="filters">
        <div className="pillrow" role="group" aria-label="Filter by date">
          {(
            [
              ["all", "All"],
              ["this", "This week"],
              ["next", "Next week"],
            ] as [DateFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={`pill ${dateFilter === key ? "on" : ""}`}
              onClick={() => setDateFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <select value={venue} onChange={(e) => setVenue(e.target.value)} aria-label="Filter by venue">
          <option value="all">All venues</option>
          {venues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        {genres.length > 0 && (
          <select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Filter by genre">
            <option value="all">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && events.length === 0 ? (
        <div className="empty">Couldn&apos;t load events right now. Check back shortly.</div>
      ) : filtered.length === 0 ? (
        <div className="empty">No events match these filters.</div>
      ) : (
        <motion.div layout className="grid">
          <AnimatePresence mode="popLayout">
            {filtered.map((e) => {
              const sources = [...new Set(e.event_sources.map((s) => s.source))];
              const time = fmtTime(e.starts_at);
              return (
                <motion.article
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                  whileHover={{ y: -4 }}
                  className="card"
                >
                  {e.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.image_url} alt="" loading="lazy" className="card-img" />
                  )}
                  <div className="card-body">
                    <div className="card-date">
                      {fmtDate(e.event_date)}
                      {time ? ` · ${time}` : ""}
                    </div>
                    <h2 className="card-title">
                      {e.url ? (
                        <a href={e.url} target="_blank" rel="noopener noreferrer">
                          {e.title}
                        </a>
                      ) : (
                        e.title
                      )}
                    </h2>
                    <div className="card-venue">{e.venue_name ?? "Venue TBA"}</div>
                    {e.blurb && <p className="card-blurb">{e.blurb}</p>}
                    <div className="card-foot">
                      {e.genre && <span className="chip genre">{e.genre}</span>}
                      {sources.length > 1 && (
                        <span className="chip multi">seen in {sources.length} sources</span>
                      )}
                      {sources.map((s) => (
                        <span key={s} className="chip">
                          {s}
                        </span>
                      ))}
                      {e.min_price != null && <span className="price">from ${e.min_price}</span>}
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      <footer className="foot">
        ATLive — automated ingestion pipeline (Ticketmaster + venue scrapers), deduped across sources.
      </footer>
    </main>
  );
}
