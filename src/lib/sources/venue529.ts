import * as cheerio from "cheerio";
import type { SourceAdapter } from "./adapter.js";
import type { CanonicalEvent } from "../types.js";

// 529 (East Atlanta) — NOVEL source: not in the Ticketmaster API, so it adds
// events TM never sees. Static-HTML calendar (WordPress cp-calendar), scraped
// with cheerio — no headless browser needed.
//
//   /calendar/  →  .calendar-desktop (one per month)
//       ├─ <h3>June 2026</h3>                  ← month + year
//       └─ table.cp-calendar
//            └─ td (day cell)
//                 ├─ span.day-of-month "30"    ← day
//                 └─ .event-item (1+)
//                      ├─ .headliner           ← title/artist
//                      ├─ .bands span          ← support acts
//                      ├─ a[href*="/events/N"] ← detail page (stable id N)
//                      └─ .thumb style=url(..) ← image

const CAL_URL = "https://529atlanta.com/calendar/";

function monthIndex(name: string): number | null {
  const d = new Date(`${name} 1, 2000`);
  return Number.isNaN(d.getTime()) ? null : d.getMonth();
}

export function venue529Adapter(): SourceAdapter {
  return {
    name: "529",
    async fetchEvents() {
      const res = await fetch(CAL_URL, { headers: { "user-agent": "Mozilla/5.0 ATLive" } });
      if (!res.ok) throw new Error(`529 ${res.status}`);
      const $ = cheerio.load(await res.text());
      const events: CanonicalEvent[] = [];

      $(".calendar-desktop").each((_, block) => {
        const $block = $(block);
        const m = $block.find("h3").first().text().trim().match(/([A-Za-z]+)\s+(\d{4})/);
        if (!m) return;
        const monName = m[1];
        const yearStr = m[2];
        if (!monName || !yearStr) return;
        const mi = monthIndex(monName);
        if (mi === null) return;
        const year = parseInt(yearStr, 10);

        $block.find("td").each((_, td) => {
          const $td = $(td);
          const items = $td.find(".event-item");
          if (items.length === 0) return;
          const day = parseInt($td.find(".day-of-month").first().text().trim(), 10);
          if (!day) return;
          const dt = new Date(Date.UTC(year, mi, day));
          if (dt.getUTCMonth() !== mi) return; // skip adjacent-month bleed (e.g. June 31)
          const eventDate = dt.toISOString().slice(0, 10);

          items.each((_, it) => {
            const $it = $(it);
            const headliner = $it.find(".headliner").first().text().trim();
            if (!headliner) return;
            const support = $it
              .find(".bands span")
              .map((_, s) => $(s).text().trim())
              .get()
              .filter((t) => t && !/^[,\s]*$/.test(t));
            const detailHref = $it.find('a[href*="/events/"]').first().attr("href") ?? "";
            const idMatch = detailHref.match(/\/events\/(\d+)/);
            const ticketHref = $it.find("a.fl-button").attr("href") ?? null;
            // include date so a multi-night run keeps one source row per night
            const baseId = idMatch?.[1] ?? detailHref ?? headliner;
            const sourceEventId = `${baseId}@${eventDate}`;
            const style = $it.find(".thumb").attr("style") ?? "";
            const imgMatch = style.match(/url\((.*?)\)/);
            const imageUrl = imgMatch?.[1] ? imgMatch[1].replace(/['"]/g, "") : null;

            events.push({
              sourceEventId,
              source: "529",
              title: headliner,
              artist: headliner,
              venueName: "529",
              eventDate,
              startsAt: null,
              url: detailHref || ticketHref,
              imageUrl,
              minPrice: null,
              raw: { headliner, support, detailHref, ticketHref, eventDate },
            });
          });
        });
      });

      return events;
    },
  };
}
