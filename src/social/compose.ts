import type { UpcomingEvent } from "../lib/events.js";
import { SITE_URL } from "../lib/site.js";

// Pure copy builders for social posts. No I/O — every function is a
// deterministic string transform so it can be unit-tested. Shared by the
// auto-poster (Bluesky/X) and the manual draft pack (IG/Reddit).

/** Top N events for the week. Input is already ordered rank_score desc, date asc. */
export function topEvents(events: UpcomingEvent[], n: number): UpcomingEvent[] {
  return events.slice(0, n);
}

export function eventName(e: UpcomingEvent): string {
  return (e.artist || e.title || "Live show").trim();
}

const dayLabel = (d: string | null): string =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "TBA";

/** "Artist @ Venue — Fri Jul 4" */
export function eventLine(e: UpcomingEvent): string {
  const venue = e.venue_name ? ` @ ${e.venue_name}` : "";
  return `${eventName(e)}${venue} — ${dayLabel(e.event_date)}`;
}

// Greedily pack event lines under a character budget, then append the footer.
// Using raw string length is a safe over-estimate for X (t.co counts any URL as
// 23 chars, and our URL is longer), so a post that fits here fits on X too.
function packed(events: UpcomingEvent[], limit: number, header: string, footer: string): string {
  const foot = `\n\n${footer}`;
  let body = "";
  for (const e of events) {
    const next = `${body}\n• ${eventLine(e)}`;
    if ((header + next + foot).length > limit) break;
    body = next;
  }
  return `${header}${body}${foot}`;
}

const HEADER = "🎸 Live music in Atlanta this week:";

/** Bluesky post — 300-char limit. */
export function blueskyPost(events: UpcomingEvent[]): string {
  return packed(topEvents(events, 8), 300, HEADER, `Full lineup → ${SITE_URL}`);
}

/** X / Twitter post — 280-char limit (URL counts as 23 on X; raw length is conservative). */
export function tweetText(events: UpcomingEvent[]): string {
  return packed(topEvents(events, 8), 280, HEADER, `Full lineup → ${SITE_URL}`);
}

// Distinct genres among the chosen events → extra Instagram hashtags.
function genreHashtags(events: UpcomingEvent[]): string[] {
  const tags = new Set<string>();
  for (const e of events) {
    if (!e.genre) continue;
    const slug = e.genre.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
    if (slug) tags.add(`#${slug}`);
  }
  return [...tags].slice(0, 4);
}

const IG_BASE_TAGS = [
  "#atlanta",
  "#atlantamusic",
  "#atlantaevents",
  "#livemusic",
  "#atlnightlife",
  "#thingstodoinatlanta",
  "#atlconcerts",
];

/** Instagram caption — no hard limit; richer copy + hashtags. For manual posting. */
export function igCaption(events: UpcomingEvent[]): string {
  const top = topEvents(events, 8);
  const lines = top.map((e) => `• ${eventLine(e)}`).join("\n");
  const tags = [...IG_BASE_TAGS, ...genreHashtags(top)].join(" ");
  return [
    "🎶 This week's live music in Atlanta 🍑",
    "",
    lines,
    "",
    "Always-updated full lineup — link in bio 🔗",
    SITE_URL,
    "",
    tags,
  ].join("\n");
}

/** Reddit post (e.g. r/Atlanta) — community-friendly roundup, light on promo. */
export function redditPost(events: UpcomingEvent[]): { title: string; body: string } {
  const top = topEvents(events, 12);
  const range = weekRange(events);
  const title = `Live music in Atlanta this week${range ? ` (${range})` : ""}`;
  const list = top.map((e) => `- **${eventName(e)}** @ ${e.venue_name ?? "TBA"} — ${dayLabel(e.event_date)}`).join("\n");
  const body = [
    "A few shows happening around Atlanta this week:",
    "",
    list,
    "",
    `I keep a full, auto-updating list here if it's useful: ${SITE_URL} — it pulls from Ticketmaster plus direct venue feeds and dedupes overlaps. Happy to add venues I'm missing.`,
  ].join("\n");
  return { title, body };
}

// "Jun 30 – Jul 6" from the min/max event_date in the set.
function weekRange(events: UpcomingEvent[]): string | null {
  const dates = events.map((e) => e.event_date).filter((d): d is string => !!d).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return null;
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return first === last ? fmt(first) : `${fmt(first)} – ${fmt(last)}`;
}
