import { NextResponse } from "next/server";
import { subscribe } from "@/lib/subscribers";
import { sendEmail, confirmEmailHtml, emailEnabled } from "@/lib/email";
import { SITE_URL } from "@/lib/site";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Per-IP cap on signups. Best-effort (per serverless instance) — blunts casual
// spam and double-submits without a datastore.
const LIMIT = 5;
const WINDOW_MS = 60_000;

// Waitlist mode (default ON): until a Resend sending domain is verified, store
// signups but DON'T attempt a confirm email — it would 403 and dead-end the
// user. The send path below stays wired; flip WAITLIST_MODE=false once a domain
// is live to switch on real double opt-in. See waitlist:promote for launch day.
const WAITLIST = process.env.WAITLIST_MODE !== "false";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`subscribe:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests - please try again in a minute." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let email = "";
  try {
    const body = (await req.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email : "";
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const r = await subscribe(email);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  if (r.status === "already") {
    return NextResponse.json({ ok: true, message: "You're already on the list." });
  }

  // Waitlist mode: the pending signup is stored (above). Skip the confirm email
  // entirely and tell the truth — no inbox to check yet.
  if (WAITLIST) {
    return NextResponse.json({
      ok: true,
      message: "You're on the list - the first roundup comes when we launch.",
    });
  }

  // Double opt-in: send the confirm link. Best-effort — on the Resend free tier
  // this 403s for non-owner addresses until a domain is verified. We log it but
  // still return success so the UX is correct once the domain is live.
  if (emailEnabled()) {
    const confirmUrl = `${SITE_URL}/confirm?token=${r.token}`;
    const res = await sendEmail({
      to: r.email,
      subject: "Confirm your ATLive subscription",
      html: confirmEmailHtml(confirmUrl),
    });
    if (!res.ok) console.error(`subscribe: confirm email failed for ${r.email}: ${res.error}`);
  } else {
    console.warn("subscribe: RESEND_API_KEY not set — no confirm email sent");
  }

  return NextResponse.json({ ok: true, message: "Almost there - check your inbox to confirm." });
}
