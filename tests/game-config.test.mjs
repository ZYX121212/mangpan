import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_CASH,
  orderQuantity,
  transactionQuote,
} from "../app/game-config.ts";

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
