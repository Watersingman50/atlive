import { test } from "node:test";
import assert from "node:assert/strict";
import { linkFacets } from "./bluesky.js";

test("linkFacets uses UTF-8 byte offsets, not string indices", () => {
  // A multibyte emoji before the URL: byte offset must exceed the char index.
  const text = "🎸 see https://atlive.vercel.app now";
  const facets = linkFacets(text) as { index: { byteStart: number; byteEnd: number }; features: { uri: string }[] }[];
  assert.equal(facets.length, 1);

  const f = facets[0]!;
  const url = "https://atlive.vercel.app";
  // 🎸 is 4 UTF-8 bytes; "🎸 see " is 4 + 5 = 9 bytes ("🎸" + " see ").
  assert.equal(f.index.byteStart, 9);
  assert.equal(f.index.byteEnd, 9 + Buffer.byteLength(url, "utf8"));
  assert.equal(f.features[0]!.uri, url);
});

test("linkFacets returns undefined when there is no link", () => {
  assert.equal(linkFacets("just some text, no url"), undefined);
});
