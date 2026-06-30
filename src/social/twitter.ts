import { createHmac, randomBytes } from "node:crypto";

// X / Twitter auto-poster. Posts via API v2 (POST /2/tweets) signed with
// OAuth 1.0a user context — no SDK, just node:crypto. Activates only when all
// four credentials are present, so the workflow is a no-op until keys land:
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
// (the consumer key/secret of your app + the access token/secret for the
// account that will post — both from developer.x.com).

export interface PostResult {
  platform: string;
  ok: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
}

// RFC 3986 percent-encoding (encodeURIComponent leaves !*'() unescaped).
const pe = (s: string): string =>
  encodeURIComponent(s).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

/**
 * OAuth 1.0a HMAC-SHA1 signature (base64). `params` must include every oauth_*
 * parameter plus any query/body params that participate in signing. Exported
 * for the test that pins it to the canonical Twitter example vector.
 */
export function oauthSignature(args: {
  method: string;
  url: string;
  params: Record<string, string>;
  consumerSecret: string;
  tokenSecret: string;
}): string {
  const { method, url, params, consumerSecret, tokenSecret } = args;
  const paramStr = Object.entries(params)
    .map(([k, v]) => [pe(k), pe(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const base = `${method.toUpperCase()}&${pe(url)}&${pe(paramStr)}`;
  const key = `${pe(consumerSecret)}&${pe(tokenSecret)}`;
  return createHmac("sha1", key).update(base).digest("base64");
}

interface XCreds {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

function xCreds(): XCreds | null {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_SECRET;
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) return null;
  return { apiKey, apiSecret, accessToken, accessSecret };
}

function authHeader(creds: XCreds, method: string, url: string): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  // API v2 body is JSON, so only the oauth params are signed (no body params).
  const signature = oauthSignature({
    method,
    url,
    params: oauth,
    consumerSecret: creds.apiSecret,
    tokenSecret: creds.accessSecret,
  });
  const all: Record<string, string> = { ...oauth, oauth_signature: signature };
  return (
    "OAuth " +
    Object.entries(all)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([k, v]) => `${pe(k)}="${pe(v)}"`)
      .join(", ")
  );
}

// Upload a PNG via the v1.1 media endpoint (the v2 API has no media upload).
// Multipart body → only the oauth params are signed, so authHeader is reused
// as-is. Returns the media_id_string to attach to the tweet.
async function uploadMedia(creds: XCreds, png: Buffer): Promise<string> {
  const url = "https://upload.twitter.com/1.1/media/upload.json";
  const form = new FormData();
  form.append("media", new Blob([new Uint8Array(png)], { type: "image/png" }), "poster.png");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader(creds, "POST", url) },
    body: form,
  });
  if (!res.ok) throw new Error(`media/upload ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { media_id_string?: string };
  if (!j.media_id_string) throw new Error("media/upload returned no media_id_string");
  return j.media_id_string;
}

export async function postToX(text: string, image?: { png: Buffer }): Promise<PostResult> {
  const creds = xCreds();
  if (!creds) return { platform: "x", ok: false, skipped: true, error: "X creds not set" };

  let mediaIds: string[] | undefined;
  if (image) {
    try {
      mediaIds = [await uploadMedia(creds, image.png)];
    } catch (e) {
      // Don't lose the post over an image — fall back to text-only.
      console.warn(`social: X media upload failed, posting text-only: ${(e as Error).message}`);
    }
  }

  const url = "https://api.twitter.com/2/tweets";
  const body = mediaIds ? { text, media: { media_ids: mediaIds } } : { text };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader(creds, "POST", url), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { platform: "x", ok: false, error: `X ${res.status}: ${await res.text()}` };
  const j = (await res.json()) as { data?: { id?: string } };
  return { platform: "x", ok: true, id: j.data?.id };
}
