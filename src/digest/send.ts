import { getUpcomingEvents, type UpcomingEvent } from "../lib/events.js";

// T10: weekly email digest. Pulls the top upcoming Atlanta events and sends a
// summary via Resend. Runs Monday mornings from GitHub Actions (see
// .github/workflows/digest.yml). Gated on RESEND_API_KEY + DIGEST_TO — skips
// gracefully if unset, so the workflow never hard-fails before the key exists.
//
// Free-tier note: with no verified domain, set DIGEST_FROM to the default
// "onboarding@resend.dev" and DIGEST_TO to your own Resend-account email.

const KEY = process.env.RESEND_API_KEY;
const TO = process.env.DIGEST_TO;
const FROM = process.env.DIGEST_FROM ?? "ATLive <onboarding@resend.dev>";
const SITE = "https://atlive.vercel.app";

const esc = (s: string | null) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const safeUrl = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);
const fmtDate = (s: string | null) =>
  s
    ? new Date(s + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "Date TBA";
const fmtTime = (s: string | null) =>
  s ? new Date(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;

function renderHtml(events: UpcomingEvent[]): string {
  const rows = events
    .map((e) => {
      const link = safeUrl(e.url);
      const time = fmtTime(e.starts_at);
      const title = link
        ? `<a href="${link}" style="color:#111;text-decoration:none">${esc(e.title)}</a>`
        : esc(e.title);
      return `
      <tr><td style="padding:14px 0;border-bottom:1px solid #ececec">
        <div style="font:600 12px/1.2 -apple-system,Segoe UI,sans-serif;color:#ff5a3c;text-transform:uppercase;letter-spacing:.04em">
          ${esc(fmtDate(e.event_date))}${time ? " &middot; " + esc(time) : ""}
        </div>
        <div style="font:700 17px/1.3 Georgia,serif;color:#111;margin-top:4px">${title}</div>
        <div style="font:400 14px/1.4 -apple-system,Segoe UI,sans-serif;color:#666;margin-top:2px">${esc(e.venue_name ?? "Venue TBA")}</div>
        ${e.blurb ? `<div style="font:400 13px/1.5 -apple-system,Segoe UI,sans-serif;color:#444;margin-top:6px">${esc(e.blurb)}</div>` : ""}
      </td></tr>`;
    })
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#f6f6f4;padding:24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;padding:28px 28px 8px">
      <tr><td>
        <div style="font:700 26px/1.1 Georgia,serif;color:#111">What's on in <span style="color:#ff5a3c">Atlanta</span> this week</div>
        <div style="font:400 14px/1.5 -apple-system,Segoe UI,sans-serif;color:#666;margin:6px 0 8px">
          The top ${events.length} upcoming live-music events, aggregated from multiple sources.
        </div>
      </td></tr>
      <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
      <tr><td style="padding:18px 0 10px;font:400 13px/1.5 -apple-system,Segoe UI,sans-serif;color:#888">
        <a href="${SITE}" style="color:#ff5a3c;text-decoration:none;font-weight:600">See all events &amp; filters &rarr;</a><br>
        <span style="color:#aaa">You're receiving this because you set up the ATLive weekly digest.</span>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

async function main() {
  if (!KEY || !TO) {
    console.log("digest: skipped (RESEND_API_KEY / DIGEST_TO not set)");
    return;
  }
  const { events, error } = await getUpcomingEvents(7);
  if (error) throw new Error(`digest: events query failed: ${error}`);
  const top = events.slice(0, 10);
  if (top.length === 0) {
    console.log("digest: no upcoming events this week — skipping send");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      subject: `ATLive — ${top.length} live shows in Atlanta this week`,
      html: renderHtml(top),
    }),
  });
  if (!res.ok) {
    throw new Error(`digest: Resend ${res.status}: ${await res.text()}`);
  }
  const j = (await res.json()) as { id?: string };
  console.log(`digest: sent to ${TO} (${top.length} events, id ${j.id ?? "?"})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
