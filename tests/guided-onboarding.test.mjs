import assert from "node:assert/strict";
import test from "node:test";

import {
  guidedWindow,
  selectGuidedDecisionIndex,
} from "../app/guided-onboarding.ts";

function candles(closes) {
  return closes.map((close, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, "0")}`,
    open: close,
    close,
    high: close * 1.005,
    low: close * 0.995,
    volume: 1_000,
  }));
}

test("accepts a readable real-history continuation for the beginner lesson", () => {
  const closes = Array.from({ length: 183 }, (_, index) =>
    index < 99 ? 100 : 100 * 1.006 ** (index - 98),
  );
  const sample = candles(closes);
  const window = guidedWindow(sample, 120);

  assert.equal(window?.direction, "up");
  assert.ok((window?.score ?? 0) > 0);
  const selected = selectGuidedDecisionIndex(sample, 4, 120, 60);
  assert.ok(selected != null && selected >= 120 && selected <= 123);
  assert.ok(guidedWindow(sample, selected));
});

test("rejects a first reveal that contradicts the visible setup", () => {
  const closes = Array.from({ length: 123 }, (_, index) =>
    index < 120 ? 100 * 1.006 ** Math.max(0, index - 98) : 80 - index,
  );
  const sample = candles(closes);

  assert.equal(guidedWindow(sample, 120), null);
});

test("keeps shock moves out of the unranked beginner sample", () => {
  const closes = Array.from({ length: 123 }, (_, index) =>
    index < 120 ? 100 * 1.006 ** Math.max(0, index - 98) : 160 + index,
  );
  const sample = candles(closes);

  assert.equal(guidedWindow(sample, 120), null);
});
