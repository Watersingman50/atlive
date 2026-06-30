// Shared Resend sender + HTML escaping + the double-opt-in confirm template.
// The weekly digest builds its own body but sends through sendEmail() here.
//
// Free-tier note: with no verified domain, Resend only delivers to your own
// account email; sending to anyone else 403s until a domain is verified. Code
// is complete regardless — it activates the moment the domain is added.

const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.DIGEST_FROM ?? "ATLive <onboarding@resend.dev>";

export function emailEnabled(): boolean {
  return Boolean(KEY);
}

export const esc = (s: string | null): string =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!KEY) return { ok: false, error: "RESEND_API_KEY not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, html: opts.html }),
  });
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` };
  const j = (await res.json()) as { id?: string };
  return { ok: true, id: j.id };
}

export function confirmEmailHtml(confirmUrl: string): string {
  const origin = new URL(confirmUrl).origin;
  return `<!doctype html><html><body style="margin:0;background:#f6f6f4;padding:24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:14px;padding:30px 30px 26px">
      <tr><td>
        <div style="font:700 24px/1.1 Georgia,serif;color:#111">Confirm your <span style="color:#e08a00">ATLive</span> subscription</div>
        <div style="font:400 15px/1.55 -apple-system,Segoe UI,sans-serif;color:#555;margin:14px 0 22px">
          Tap the button to start getting the Monday roundup of live music in Atlanta. If you didn&rsquo;t sign up, just ignore this email.
        </div>
        <a href="${esc(confirmUrl)}" style="display:inline-block;background:#FFB433;color:#1a1206;font:700 15px/1 -apple-system,Segoe UI,sans-serif;text-decoration:none;padding:14px 22px;border-radius:999px">Confirm subscription</a>
        <div style="font:400 12px/1.5 -apple-system,Segoe UI,sans-serif;color:#999;margin-top:22px">
          Or paste this link: <br><span style="color:#777">${esc(confirmUrl)}</span>
        </div>
      </td></tr>
    </table>
    <div style="font:400 12px/1.5 -apple-system,Segoe UI,sans-serif;color:#aaa;margin-top:14px">${esc(origin)}</div>
  </td></tr></table>
  </body></html>`;
}
