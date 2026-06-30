import { getUpcomingEvents, type UpcomingEvent } from "../lib/events.js";
import { sendEmail, esc, emailEnabled, DIGEST_FROM } from "../lib/email.js";
import { getConfirmedSubscribers } from "../lib/subscribers.js";
import { SITE_URL } from "../lib/site.js";

// T10: weekly email digest. Pulls the top upcoming Atlanta events and sends a
// summary via Resend. Runs Monday mornings from GitHub Actions (see
// .github/workflows/digest.yml).
//
// Recipients: confirmed newsletter subscribers (task 2). Falls back to DIGEST_TO
// (the account-owner email) when there are no confirmed subscribers yet, so the
// job stays testable. Each subscriber email carries their own unsubscribe link.
//
// Free-tier note: with no verified domain, Resend only delivers to the account
// owner; sends to other addresses 403. Code is complete — it activates fully
// the moment a domain is verified.

const TO = process.env.DIGEST_TO;

const safeUrl = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);
const fmtDate = (s: string | null) =>
  s
    ? new Date(s + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "Date TBA";
const fmtTime = (s: string | null) =>
  s ? new Date(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;

function renderHtml(events: UpcomingEvent[], unsubUrl: string | null): string {
  const rows = events
    .map((e) => {
      const link = safeUrl(e.url);
      const time = fmtTime(e.starts_at);
      const title = link
        ? `<a href="${link}" style="color:#111;text-decoration:none">${esc(e.title)}</a>`
        : esc(e.title);
      return `
      <tr><td style="padding:14px 0;border-bottom:1px solid #ececec">
        <div style="font:600 12px/1.2 -apple-system,Segoe UI,sans-serif;color:#e08a00;text-transform:uppercase;letter-spacing:.04em">
          ${esc(fmtDate(e.event_date))}${time ? " &middot; " + esc(time) : ""}
        </div>
        <div style="font:700 17px/1.3 Georgia,serif;color:#111;margin-top:4px">${title}</div>
        <div style="font:400 14px/1.4 -apple-system,Segoe UI,sans-serif;color:#666;margin-top:2px">${esc(e.venue_name ?? "Venue TBA")}</div>
        ${e.blurb ? `<div style="font:400 13px/1.5 -apple-system,Segoe UI,sans-serif;color:#444;margin-top:6px">${esc(e.blurb)}</div>` : ""}
      </td></tr>`;
    })
    .join("");

  const unsub = unsubUrl
    ? `<br><a href="${esc(unsubUrl)}" style="color:#aaa;text-decoration:underline">Unsubscribe</a>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#f6f6f4;padding:24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;padding:28px 28px 8px">
      <tr><td>
        <div style="font:700 26px/1.1 Georgia,serif;color:#111">What's on in <span style="color:#e08a00">Atlanta</span> this week</div>
        <div style="font:400 14px/1.5 -apple-system,Segoe UI,sans-serif;color:#666;margin:6px 0 8px">
          The top ${events.length} upcoming live-music events, aggregated from multiple sources.
        </div>
      </td></tr>
      <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
      <tr><td style="padding:18px 0 10px;font:400 13px/1.5 -apple-system,Segoe UI,sans-serif;color:#888">
        <a href="${SITE_URL}" style="color:#e08a00;text-decoration:none;font-weight:600">See all events &amp; filters &rarr;</a><br>
        <span style="color:#aaa">You're getting this because you subscribed to the ATLive weekly roundup.</span>${unsub}
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

async function main() {
  if (!emailEnabled()) {
    console.log("digest: skipped (RESEND_API_KEY not set)");
    return;
  }
  const { events, error } = await getUpcomingEvents(7);
  if (error) throw new Error(`digest: events query failed: ${error}`);
  const top = events.slice(0, 10);
  if (top.length === 0) {
    console.log("digest: no upcoming events this week — skipping send");
    return;
  }

  const subs = await getConfirmedSubscribers();
  const recipients: { email: string; token: string | null }[] =
    subs.length > 0 ? subs : TO ? [{ email: TO, token: null }] : [];

  if (recipients.length === 0) {
    console.log("digest: no confirmed subscribers and no DIGEST_TO — nothing to send");
    return;
  }
  console.log(`digest: ${top.length} events → ${recipients.length} recipient(s) (${subs.length} confirmed subscribers)`);

  let sent = 0;
  const failures: string[] = [];
  for (const r of recipients) {
    const unsubUrl = r.token ? `${SITE_URL}/unsubscribe?token=${r.token}` : null;
    const res = await sendEmail({
      to: r.email,
      from: DIGEST_FROM,
      subject: `ATLive — ${top.length} live shows in Atlanta this week`,
      html: renderHtml(top, unsubUrl),
    });
    if (res.ok) sent++;
    else failures.push(`${r.email}: ${res.error}`);
  }

  console.log(`digest: sent ${sent}/${recipients.length}`);
  if (failures.length > 0) {
    console.error("digest: failures:\n  " + failures.join("\n  "));
    // Non-zero exit so the GitHub Action surfaces a delivery problem.
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
