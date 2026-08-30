import assert from "node:assert/strict";
import test from "node:test";
import {
  displayedCrewStreak,
  nextCrewStreak,
} from "../app/crew-streak.ts";

test("starts a crew streak when the group completes together", () => {
  assert.equal(nextCrewStreak(0, null, "2026-08-30"), 1);
});

test("extends only a consecutive shared completion", () => {
  assert.equal(nextCrewStreak(4, "2026-08-29", "2026-08-30"), 5);
  assert.equal(nextCrewStreak(4, "2026-08-28", "2026-08-30"), 1);
});

test("shows zero after the crew misses a full day", () => {
  assert.equal(displayedCrewStreak(7, "2026-08-29", "2026-08-30"), 7);
  assert.equal(displayedCrewStreak(7, "2026-08-28", "2026-08-30"), 0);
});
