import assert from "node:assert/strict";
import test from "node:test";

import { calculateStreakProtection } from "../app/streak-protection.ts";

test("earns one streak freeze after five completed daily challenges", () => {
  const result = calculateStreakProtection(
    [
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
    ],
    "2026-08-30",
  );

  assert.equal(result.streak, 5);
  assert.equal(result.availableFreezes, 1);
  assert.equal(result.nextFreezeIn, 5);
  assert.equal(result.freezeEarnedToday, true);
});

test("automatically spends a freeze when the player returns after one missed day", () => {
  const result = calculateStreakProtection(
    [
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-30",
    ],
    "2026-08-30",
  );

  assert.equal(result.streak, 6);
  assert.equal(result.availableFreezes, 0);
  assert.equal(result.freezeUsedToday, true);
  assert.equal(result.nextFreezeIn, 4);
});

test("shows an active protection before the player returns", () => {
  const result = calculateStreakProtection(
    [
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
    ],
    "2026-08-30",
  );

  assert.equal(result.streak, 5);
  assert.equal(result.availableFreezes, 0);
  assert.equal(result.protectedMissedDays, 1);
});

test("resets the streak when a gap exceeds earned protection", () => {
  const result = calculateStreakProtection(
    [
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
      "2026-08-24",
      "2026-08-27",
    ],
    "2026-08-27",
  );

  assert.equal(result.streak, 1);
  assert.equal(result.availableFreezes, 0);
  assert.equal(result.freezeUsedToday, false);
  assert.equal(result.nextFreezeIn, 4);
});

test("caps stored streak freezes at two", () => {
  const dates = Array.from({ length: 15 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 7, 16 + index));
    return date.toISOString().slice(0, 10);
  });
  const result = calculateStreakProtection(dates, "2026-08-30");

  assert.equal(result.streak, 15);
  assert.equal(result.availableFreezes, 2);
  assert.equal(result.nextFreezeIn, 0);
});
