import type { Candle } from "./stock-types";

export const GUIDED_LOOKBACK_DAYS = 20;
export const GUIDED_SHORT_LOOKBACK_DAYS = 7;
export const GUIDED_REVEAL_DAYS = 3;

type GuidedWindow = {
  direction: "up" | "down";
  score: number;
};

function move(from: number, to: number) {
  return from > 0 ? to / from - 1 : 0;
}

/**
 * Rank real-history windows for the unranked first-run lesson. A useful
 * beginner window has one readable recent direction and a modest continuation
 * after the reveal. Daily, duel, practice, and training selection never use
 * this outcome-aware filter.
 */
export function guidedWindow(
  candles: readonly Candle[],
  decisionIndex: number,
): GuidedWindow | null {
  if (
    decisionIndex < GUIDED_LOOKBACK_DAYS + 1 ||
    decisionIndex + GUIDED_REVEAL_DAYS > candles.length
  )
    return null;

  const visibleClose = candles[decisionIndex - 1].close;
  const longMove = move(
    candles[decisionIndex - 1 - GUIDED_LOOKBACK_DAYS].close,
    visibleClose,
  );
  const shortMove = move(
    candles[decisionIndex - 1 - GUIDED_SHORT_LOOKBACK_DAYS].close,
    visibleClose,
  );
  const revealedMove = move(
    candles[decisionIndex].open,
    candles[decisionIndex + GUIDED_REVEAL_DAYS - 1].close,
  );
  const direction = longMove > 0 ? "up" : "down";
  const aligned =
    Math.sign(longMove) === Math.sign(shortMove) &&
    Math.sign(shortMove) === Math.sign(revealedMove);

  // Avoid flat, ambiguous, and shock windows. The lesson should feel readable,
  // but the move remains real and the player still has to make the call.
  if (
    !aligned ||
    Math.abs(longMove) < 0.035 ||
    Math.abs(shortMove) < 0.012 ||
    Math.abs(revealedMove) < 0.01 ||
    Math.abs(longMove) > 0.35 ||
    Math.abs(revealedMove) > 0.09
  )
    return null;

  return {
    direction,
    score:
      Math.abs(longMove) * 2 +
      Math.abs(shortMove) * 3 +
      Math.abs(revealedMove),
  };
}

export function selectGuidedDecisionIndex(
  candles: readonly Candle[],
  seed: number,
  minimumIndex: number,
  futureReserve: number,
) {
  const latestIndex = candles.length -
    Math.max(futureReserve, GUIDED_REVEAL_DAYS);
  const candidates: { index: number; score: number }[] = [];

  for (let index = minimumIndex; index <= latestIndex; index += 1) {
    const window = guidedWindow(candles, index);
    if (window) candidates.push({ index, score: window.score });
  }
  if (!candidates.length) return null;

  candidates.sort(
    (left, right) =>
      right.score - left.score ||
      ((left.index + seed) % 97) - ((right.index + seed) % 97),
  );
  const readablePool = candidates.slice(0, Math.min(6, candidates.length));
  return readablePool[(seed >>> 0) % readablePool.length].index;
}
