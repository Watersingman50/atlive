import type { PostResult } from "./twitter.js";

// Bluesky auto-poster via the AT Protocol HTTP API. Activates only when both
// credentials are present:
//   BLUESKY_HANDLE        e.g. atlive.bsky.social (or a custom-domain handle)
//   BLUESKY_APP_PASSWORD  an app password from Settings → App Passwords
//                         (NOT the account password)

const PDS = "https://bsky.social";

// Link facets carry UTF-8 BYTE offsets (not JS string indices), so URLs render
// as clickable links. Exported for the offset test.
export function linkFacets(text: string) {
  const enc = new TextEncoder();
  const facets: unknown[] = [];
  const re = /https?:\/\/[^\s]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const byteStart = enc.encode(text.slice(0, m.index)).length;
    const byteEnd = byteStart + enc.encode(m[0]).length;
    facets.push({
      index: { byteStart, byteEnd },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: m[0] }],
    });
  }
  return facets.length > 0 ? facets : undefined;
}

export async function postToBluesky(text: string): Promise<PostResult> {
  const identifier = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!identifier || !password) return { platform: "bluesky", ok: false, skipped: true, error: "Bluesky creds not set" };

  const sessionRes = await fetch(`${PDS}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  if (!sessionRes.ok) return { platform: "bluesky", ok: false, error: `createSession ${sessionRes.status}: ${await sessionRes.text()}` };
  const session = (await sessionRes.json()) as { accessJwt: string; did: string };

  const record = {
    $type: "app.bsky.feed.post",
    text,
    createdAt: new Date().toISOString(),
    ...(linkFacets(text) ? { facets: linkFacets(text) } : {}),
  };
  const postRes = await fetch(`${PDS}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ repo: session.did, collection: "app.bsky.feed.post", record }),
  });
  if (!postRes.ok) return { platform: "bluesky", ok: false, error: `createRecord ${postRes.status}: ${await postRes.text()}` };
  const j = (await postRes.json()) as { uri?: string };
  return { platform: "bluesky", ok: true, id: j.uri };
}
