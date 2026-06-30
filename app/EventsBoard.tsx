"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import type { UpcomingEvent } from "@/lib/events";
import { neighborhoodOf } from "@/lib/neighborhoods";
import BrandMark from "./BrandMark";
import SignupForm from "./SignupForm";

type DateFilter = "all" | "this" | "next";

const REPO = "https://github.com/Watersingman50/atlive";

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

// Source-provided URLs are untrusted — only allow http(s) so a malicious
// "javascript:" URL can't become click-to-XSS when rendered into href/src.
const safeUrl = (u: string | null): string | null =>
  u && /^https?:\/\//i.test(u) ? u : null;

function relTime(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function EventsBoard({
  events,
  lastIngest,
}: {
  events: UpcomingEvent[];
  lastIngest: string | null;
}) {
  const reduce = useReducedMotion();
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [venue, setVenue] = useState<string>("all");
  const [genre, setGenre] = useState<string>("all");
  const [hood, setHood] = useState<string>("all");

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
    if (hasOther && !set.has("Other")) list.push("Other");
    return list;
  }, [events]);
  const hoods = useMemo(
    () => [...new Set(events.map((e) => neighborhoodOf(e.venue_name)))].sort(),
    [events],
  );

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (venue !== "all" && e.venue_name !== venue) return false;
      if (genre !== "all" && (e.genre ?? "Other") !== genre) return false;
      if (hood !== "all" && neighborhoodOf(e.venue_name) !== hood) return false;
      if (dateFilter !== "all" && e.event_date) {
        const inThisWeek = e.event_date >= today && e.event_date < in7;
        if (dateFilter === "this" && !inThisWeek) return false;
        if (dateFilter === "next" && inThisWeek) return false;
      }
      return true;
    });
  }, [events, venue, genre, hood, dateFilter, today, in7]);

  const anyFilter = dateFilter !== "all" || venue !== "all" || genre !== "all" || hood !== "all";
  const clearFilters = () => {
    setDateFilter("all");
    setVenue("all");
    setGenre("all");
    setHood("all");
  };

  // Freshness: ingest runs every 6h; >9h since the last successful ingest means a
  // scheduled run was missed — surface a banner so a stale live demo is honest.
  const ageHours = lastIngest ? (Date.now() - new Date(lastIngest).getTime()) / 3_600_000 : null;
  const stale = ageHours !== null && ageHours > 9;

  // Microinteraction variants — gated by prefers-reduced-motion (CSS alone can't
  // stop Framer's JS-driven animations, so we drop them here too).
  const cardAnim = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 16, clipPath: "inset(0 0 100% 0)" },
        animate: { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" },
        exit: { opacity: 0, scale: 0.96 },
        transition: { duration: 0.3, ease: [0.2, 0.7, 0.2, 1] as const },
        whileHover: { y: -5 },
      };

  return (
    <main className="wrap">
      <nav className="nav" aria-label="Primary">
        <Link className="brand" href="/" aria-label="ATLive home">
          <BrandMark className="mark" />
          <span className="word">
            AT<b>Live</b>
          </span>
        </Link>
        <ul className="navlinks">
          <li>
            <Link href="/" aria-current="page">
              <span className="idx">01</span> Events
            </Link>
          </li>
          <li>
            <Link href="/pipeline">
              <span className="idx">02</span> Pipeline
            </Link>
          </li>
          <li>
            <a href="#about">
              <span className="idx">03</span> About
            </a>
          </li>
        </ul>
      </nav>

      <header className="head hero">
        <div className="eyebrow">
          <span className="pulse" />
          Atlanta · live music · auto-updated
        </div>
        <h1 className={reduce ? "" : "glitch-in"}>
          Live music in <span className="accent">Atlanta</span>
        </h1>
        <p className="sub">Every gig in Atlanta this week, in one place — updated automatically.</p>
        <p className="stat" aria-live="polite">
          <span className="livedot" />
          <strong>{filtered.length}</strong>{" "}
          {dateFilter === "all"
            ? `upcoming ${filtered.length === 1 ? "show" : "shows"}`
            : `${filtered.length === 1 ? "show" : "shows"} ${dateFilter === "this" ? "this" : "next"} week`}
          {lastIngest && <span> · updated {relTime(lastIngest)}</span>}
        </p>
        {stale && (
          <div className="banner" role="status">
            Last updated {Math.round(ageHours ?? 0)}h ago — double-check the venue before you head out.
          </div>
        )}
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
              aria-pressed={dateFilter === key}
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

      {hoods.length > 1 && (
        <div className="hoods" role="group" aria-label="Filter by neighborhood">
          <button className={`hood ${hood === "all" ? "on" : ""}`} aria-pressed={hood === "all"} onClick={() => setHood("all")}>
            All Atlanta
          </button>
          {hoods.map((h) => (
            <button key={h} className={`hood ${hood === h ? "on" : ""}`} aria-pressed={hood === h} onClick={() => setHood(h)}>
              {h}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty">
          {events.length === 0 ? (
            <>
              <p>No upcoming events on the board right now. The pipeline ingests every 6 hours — fresh shows land automatically.</p>
              <a className="empty-act" href="/pipeline">
                See how the pipeline works →
              </a>
            </>
          ) : (
            <>
              <p>No events match these filters.</p>
              <button className="empty-act ghost" onClick={clearFilters}>
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <motion.div layout={!reduce} className="grid">
          <AnimatePresence mode="popLayout">
            {filtered.map((e) => {
              const sources = [...new Set(e.event_sources.map((s) => s.source))];
              const time = fmtTime(e.starts_at);
              const link = safeUrl(e.url);
              const img = safeUrl(e.image_url);
              const initial = (e.artist || e.title || "?").trim().charAt(0);
              const hoodName = neighborhoodOf(e.venue_name);
              return (
                <motion.article key={e.id} layout={!reduce} {...cardAnim} className="pcard">
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
                </motion.article>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      <section className="about" id="about">
        <h2>What this is</h2>
        <p>
          ATLive is an automated discovery board for live music in Atlanta. A scheduled pipeline pulls from the
          Ticketmaster Discovery API plus direct venue feeds and HTML scrapers, normalizes every listing into one
          schema, and dedupes shows that appear in more than one source so each real event shows up once — with a badge
          for how many sources confirmed it.
        </p>
        <p>
          It runs itself: GitHub Actions re-ingests every 6 hours, field-extraction accuracy is measured against a
          hand-labeled set (currently 96.7%), and the live site rebuilds on a cache cycle. Built with Next.js, Supabase,
          and TypeScript. See the{" "}
          <a href="/pipeline">live pipeline metrics</a> or the full source on{" "}
          <a href={REPO} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          .
        </p>
        <div className="tags">
          <span className="chip">Next.js</span>
          <span className="chip">Supabase</span>
          <span className="chip">TypeScript</span>
          <span className="chip">GitHub Actions</span>
          <span className="chip multi">deduped · evaluated</span>
        </div>
      </section>

      <SignupForm />

      <footer className="foot">
        Built in Atlanta · showtimes from venues + Ticketmaster.
      </footer>
    </main>
  );
}
