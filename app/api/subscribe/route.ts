import { NextResponse } from "next/server";
import { subscribe } from "@/lib/subscribers";
import { sendEmail, confirmEmailHtml, emailEnabled } from "@/lib/email";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

export async function POST(req: Request) {
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

  return NextResponse.json({ ok: true, message: "Almost there — check your inbox to confirm." });
}
