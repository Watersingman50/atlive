import { test } from "node:test";
import assert from "node:assert/strict";
import { sameEvent, artistSimilar } from "./dedup.js";

const at = (artist: string, venue: string, date = "2026-06-30") => ({
  artist,
  venueName: venue,
  eventDate: date,
});

test("merges cross-source name variants of the same show", () => {
  // "&" vs "and" (the real TM <-> Variety case)
  assert.ok(sameEvent(at("Josiah & the Bonnevilles", "Variety Playhouse"), at("Josiah and the Bonnevilles", "Variety Playhouse")));
  // tour suffix on one side
  assert.ok(sameEvent(at("Goose", "Variety Playhouse"), at("Goose - Summer Tour 2026", "Variety Playhouse")));
  // dropped article in venue
  assert.ok(sameEvent(at("Some Band", "The Earl"), at("Some Band", "Earl")));
  // parenthetical noise
  assert.ok(artistSimilar("Goose", "Goose (Live)"));
});

test("FALSE-MERGE GUARD: different acts, same venue + night, stay separate", () => {
  // two distinct 529 shows on the same date — must NOT merge (the critical gap)
  assert.ok(!sameEvent(at("Drosera", "529"), at("Flesh Carving", "529")));
  assert.ok(!sameEvent(at("American Football", "529"), at("Tony Evans Jr.", "529")));
  // share one common word but are different acts
  assert.ok(!sameEvent(at("John Smith Band", "529"), at("John Doe Band", "529")));
});

test("does not merge same artist on a different date", () => {
  assert.ok(!sameEvent(at("Goose", "Variety Playhouse", "2026-06-30"), at("Goose", "Variety Playhouse", "2026-07-01")));
});

test("does not merge same artist at a different venue", () => {
  assert.ok(!sameEvent(at("Goose", "Variety Playhouse"), at("Goose", "The Masquerade")));
});
