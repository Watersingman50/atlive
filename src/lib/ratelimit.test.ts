import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit } from "./ratelimit.js";

test("allows up to the limit, then blocks within the window", () => {
  const key = "t1";
  const t0 = 1_000_000;
  for (let i = 0; i < 5; i++) {
    assert.equal(rateLimit(key, 5, 60_000, t0 + i).ok, true, `hit ${i} should pass`);
  }
  const blocked = rateLimit(key, 5, 60_000, t0 + 6);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter > 0 && blocked.retryAfter <= 60);
});

test("resets after the window elapses", () => {
  const key = "t2";
  const t0 = 2_000_000;
  for (let i = 0; i < 5; i++) rateLimit(key, 5, 60_000, t0);
  assert.equal(rateLimit(key, 5, 60_000, t0).ok, false);
  // Past the reset boundary → fresh window.
  assert.equal(rateLimit(key, 5, 60_000, t0 + 60_000).ok, true);
});

test("separate keys have independent budgets", () => {
  const t0 = 3_000_000;
  for (let i = 0; i < 5; i++) rateLimit("ipA", 5, 60_000, t0);
  assert.equal(rateLimit("ipA", 5, 60_000, t0).ok, false);
  assert.equal(rateLimit("ipB", 5, 60_000, t0).ok, true);
});
