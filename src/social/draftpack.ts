import { mkdirSync, writeFileSync } from "node:fs";
import { getUpcomingEvents } from "../lib/events.js";
import { sendEmail, emailEnabled, esc } from "../lib/email.js";
import { igCaption, redditPost } from "./compose.js";
import { posterPng } from "./image.js";

// Weekly DRAFT PACK for the channels we never auto-post to (Instagram + Reddit
// — both ban automated posting). Builds ready-to-paste copy, writes it to
// drafts/ for local runs, and emails it to the owner so it lands in the inbox
// each week. Manual posting only.
//
// Recipient: DRAFTS_TO, falling back to DIGEST_TO (the owner address).

async function main() {
  const { events, error } = await getUpcomingEvents(7);
  if (error) {
    console.error(`draftpack: events query failed: ${error}`);
    process.exit(1);
  }
  if (events.length === 0) {
    console.log("draftpack: no upcoming events this week — nothing to draft.");
    return;
  }

  const ig = igCaption(events);
  const reddit = redditPost(events);
  const stamp = new Date().toISOString().slice(0, 10);

  // Roundup poster (real data). 1080×1350 — ready to post on Instagram as-is.
  let poster: Buffer | null = null;
  try {
    poster = posterPng(events);
  } catch (e) {
    console.warn(`draftpack: poster render failed (drafts still written): ${(e as Error).message}`);
  }

  const md = [
    `# ATLive draft pack — week of ${stamp}`,
    "",
    "Manual posting only. Instagram and Reddit both ban automated posting, so these are ready-to-paste drafts.",
    "",
    "## Instagram caption",
    "",
    "```",
    ig,
    "```",
    "",
    poster
      ? `_Poster image: \`drafts/${stamp}.png\` (1080×1350, ready to post — also attached to this email)._`
      : "_Poster image: render failed this run — post text-only or screenshot the homepage grid._",
    "",
    "## Reddit post (r/Atlanta, r/atlanta_music, or a relevant venue/genre sub)",
    "",
    `**Title:** ${reddit.title}`,
    "",
    "```",
    reddit.body,
    "```",
    "",
    "_Reddit etiquette: post from a real account with history, reply to comments, don't cross-post the same text to many subs the same day._",
    "",
  ].join("\n");

  // Local artifacts (handy when run on a dev machine; ephemeral in CI).
  try {
    mkdirSync("drafts", { recursive: true });
    writeFileSync(`drafts/${stamp}.md`, md, "utf8");
    console.log(`draftpack: wrote drafts/${stamp}.md`);
    if (poster) {
      writeFileSync(`drafts/${stamp}.png`, poster);
      console.log(`draftpack: wrote drafts/${stamp}.png`);
    }
  } catch (e) {
    console.warn(`draftpack: could not write local files: ${(e as Error).message}`);
  }

  const to = process.env.DRAFTS_TO || process.env.DIGEST_TO;
  if (emailEnabled() && to) {
    const html = `<!doctype html><html><body style="margin:0;background:#f6f6f4;padding:20px;font-family:-apple-system,Segoe UI,sans-serif">
      <h2 style="color:#111">ATLive draft pack — week of ${esc(stamp)}</h2>
      <p style="color:#555;font-size:14px">Ready-to-paste social drafts. Manual posting only (IG + Reddit ban automation).</p>
      ${poster ? `<p style="color:#555;font-size:14px">📎 Roundup poster attached (1080×1350) — ready to post on Instagram.</p>` : ""}
      <h3 style="color:#111">Instagram caption</h3>
      <pre style="white-space:pre-wrap;background:#fff;border:1px solid #e3e3e0;border-radius:8px;padding:14px;font-size:13px;color:#222">${esc(ig)}</pre>
      <h3 style="color:#111">Reddit — title</h3>
      <pre style="white-space:pre-wrap;background:#fff;border:1px solid #e3e3e0;border-radius:8px;padding:14px;font-size:13px;color:#222">${esc(reddit.title)}</pre>
      <h3 style="color:#111">Reddit — body</h3>
      <pre style="white-space:pre-wrap;background:#fff;border:1px solid #e3e3e0;border-radius:8px;padding:14px;font-size:13px;color:#222">${esc(reddit.body)}</pre>
    </body></html>`;
    const res = await sendEmail({
      to,
      subject: `ATLive draft pack — week of ${stamp}`,
      html,
      attachments: poster ? [{ filename: `atlive-${stamp}.png`, content: poster.toString("base64") }] : undefined,
    });
    if (res.ok) console.log(`draftpack: emailed drafts to ${to}`);
    else console.error(`draftpack: email failed: ${res.error}`);
  } else {
    console.warn("draftpack: RESEND_API_KEY or DRAFTS_TO/DIGEST_TO unset — skipped email (local file still written).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
