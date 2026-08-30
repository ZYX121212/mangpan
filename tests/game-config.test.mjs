import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_CHALLENGE_DECISIONS,
  INITIAL_CASH,
  MARKET_COLORS,
  probabilityCalibrationScore,
  probabilityForecast,
  orderQuantity,
  transactionQuote,
} from "../app/game-config.ts";

test("uses the color convention of the selected stock market", () => {
  assert.deepEqual(MARKET_COLORS.us, {
    up: "#129a76",
    down: "#df4a56",
    buy: "#129a76",
    sell: "#df4a56",
  });
  assert.deepEqual(MARKET_COLORS.cn, {
    up: "#df4a56",
    down: "#129a76",
    buy: "#df4a56",
    sell: "#129a76",
  });
});

test("probability contract rewards calibration and penalizes confident errors", () => {
  assert.equal(DAILY_CHALLENGE_DECISIONS, 5);
  const cautious = probabilityForecast("up", 1);
  const strong = probabilityForecast("up", 3);

  assert.deepEqual(cautious, { up: 50, range: 25, down: 25 });
  assert.deepEqual(strong, { up: 80, range: 10, down: 10 });
  assert.equal(probabilityCalibrationScore(strong, "up"), 97);
  assert.equal(probabilityCalibrationScore(strong, "down"), 27);
  assert.ok(
    probabilityCalibrationScore(cautious, "down") >
      probabilityCalibrationScore(strong, "down"),
  );
});

test("A-share full-position quote includes transparent slippage and fees", () => {
  const quantity = orderQuantity({
    market: "cn",
    kind: "buy",
    price: 100,
    cash: INITIAL_CASH,
    shares: 0,
  });
  const quote = transactionQuote({
    market: "cn",
    kind: "buy",
    referencePrice: 100,
    quantity,
  });

  assert.equal(INITIAL_CASH, 1_000_000);
  assert.equal(quantity, 9_900);
  assert.equal(quote.referenceGross, 990_000);
  assert.equal(quote.slippageCost, 198);
  assert.equal(quote.totalFees, 257.45);
  assert.equal(-quote.cashDelta, 990_455.45);
  assert.equal(
    quote.referenceGross + quote.slippageCost + quote.totalFees,
    -quote.cashDelta,
  );
});

test("sell proceeds reconcile to reference amount minus slippage and fees", () => {
  const quote = transactionQuote({
    market: "cn",
    kind: "sell",
    referencePrice: 100,
    quantity: 900,
  });

  assert.equal(
    quote.referenceGross - quote.slippageCost - quote.totalFees,
    quote.cashDelta,
  );
});
