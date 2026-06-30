import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import type { UpcomingEvent } from "../lib/events.js";
import { topEvents, eventName } from "./compose.js";
import { SITE_URL } from "../lib/site.js";

// Weekly roundup poster — real data only. Builds an SVG (pure, testable) and
// rasterizes to PNG with @resvg/resvg-js + the vendored Space Grotesk font (no
// system fonts, so output is deterministic across machines/CI).
//
// Portrait 1080×1350 (Instagram 4:5); also displays fine on Bluesky/X.

const W = 1080;
const H = 1350;
const FONT = fileURLToPath(new URL("../../assets/fonts/SpaceGrotesk.ttf", import.meta.url));

const xml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

const dayLabel = (d: string | null): string =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "TBA";

function weekRange(events: UpcomingEvent[]): string {
  const dates = events.map((e) => e.event_date).filter((d): d is string => !!d).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!first || !last) return "";
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return first === last ? fmt(first) : `${fmt(first)} – ${fmt(last)}`;
}

/** Build the poster SVG from real events. Pure — no I/O. */
export function posterSvg(events: UpcomingEvent[]): string {
  const top = topEvents(events, 6);
  const rowH = 132;
  const startY = 470;

  const rows = top
    .map((e, i) => {
      const y = startY + i * rowH;
      const name = xml(clip(eventName(e), 30));
      const meta = xml(clip(`${e.venue_name ?? "Venue TBA"} · ${dayLabel(e.event_date)}`, 46));
      return `
    <text x="90" y="${y}" font-family="Space Grotesk" font-size="44" font-weight="700" fill="#f4f1ea">${name}</text>
    <text x="90" y="${y + 42}" font-family="Space Grotesk" font-size="27" fill="#a9a39a">${meta}</text>
    <line x1="90" y1="${y + 70}" x2="${W - 90}" y2="${y + 70}" stroke="#2a2a2a" stroke-width="1"/>`;
    })
    .join("");

  const week = weekRange(events);
  const host = SITE_URL.replace(/^https?:\/\//, "");

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#121212"/>
  <rect x="90" y="120" width="92" height="92" rx="24" fill="#FFB433"/>
  <text x="136" y="186" font-family="Space Grotesk" font-size="60" font-weight="700" fill="#1a1206" text-anchor="middle">A</text>
  <text x="206" y="190" font-family="Space Grotesk" font-size="56" font-weight="700" fill="#f4f1ea">ATLive</text>
  <text x="90" y="320" font-family="Space Grotesk" font-size="78" font-weight="700" fill="#f4f1ea">Live music in</text>
  <text x="90" y="404" font-family="Space Grotesk" font-size="78" font-weight="700" fill="#FFB433">Atlanta this week</text>
  ${rows}
  <text x="90" y="${H - 80}" font-family="Space Grotesk" font-size="30" fill="#8a857d">${xml(host)}${week ? ` · week of ${xml(week)}` : ""}</text>
</svg>`;
}

/** Rasterize an SVG to a PNG buffer using the vendored font. */
export function renderPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    font: { fontFiles: [FONT], defaultFontFamily: "Space Grotesk", loadSystemFonts: false },
    fitTo: { mode: "width", value: W },
  });
  return resvg.render().asPng();
}

/** Convenience: poster PNG straight from events. */
export function posterPng(events: UpcomingEvent[]): Buffer {
  return renderPng(posterSvg(events));
}
