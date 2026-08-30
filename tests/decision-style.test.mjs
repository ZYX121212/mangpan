import assert from "node:assert/strict";
import test from "node:test";
import { decisionStyleFor } from "../app/decision-style.ts";

const base = {
  calibration: 60,
  risk: 70,
  discipline: 70,
  accuracy: 40,
  confidentMisses: 1,
  trades: 2,
  peakExposure: 60,
  contrarianCalls: 0,
  contrarianWins: 0,
};

test("recognizes a rare earned contrarian style before generic strengths", () => {
  const style = decisionStyleFor({
    ...base,
    calibration: 85,
    contrarianCalls: 3,
    contrarianWins: 2,
  });
  assert.equal(style.key, "independent-reader");
  assert.match(style.description, /2 of 3/);
});

test("maps probability discipline to a calibrated decision identity", () => {
  const style = decisionStyleFor({
    ...base,
    calibration: 82,
    confidentMisses: 0,
  });
  assert.equal(style.key, "calibrated-reader");
  assert.equal(style.badge, "CAL");
});

test("does not label staying entirely in cash as risk architecture", () => {
  const style = decisionStyleFor({
    ...base,
    trades: 0,
    risk: 100,
    discipline: 100,
    peakExposure: 0,
  });
  assert.equal(style.key, "patient-observer");
});

test("separates controlled risk from high exposure conviction", () => {
  assert.equal(
    decisionStyleFor({
      ...base,
      risk: 88,
      discipline: 90,
      peakExposure: 55,
    }).key,
    "risk-architect",
  );
  assert.equal(
    decisionStyleFor({
      ...base,
      peakExposure: 92,
    }).key,
    "conviction-tester",
  );
});

test("returns localized, constructive guidance for the adaptive fallback", () => {
  const style = decisionStyleFor(base, "zh");
  assert.equal(style.key, "adaptive-analyst");
  assert.equal(style.title, "自适应分析者");
  assert.match(style.nextGoal, /下一局/);
});
