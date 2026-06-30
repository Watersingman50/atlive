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

export async function postToX(text: string): Promise<PostResult> {
  const creds = xCreds();
  if (!creds) return { platform: "x", ok: false, skipped: true, error: "X creds not set" };

  const url = "https://api.twitter.com/2/tweets";
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader(creds, "POST", url), "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return { platform: "x", ok: false, error: `X ${res.status}: ${await res.text()}` };
  const j = (await res.json()) as { data?: { id?: string } };
  return { platform: "x", ok: true, id: j.data?.id };
}
