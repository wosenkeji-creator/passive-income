import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChargeResult } from 'apify';
import { JOB_RESULT_EVENT, deliverAndCharge } from './billing.js';
import type { ChargeGateway, ResultSink } from './billing.js';
import type { JobPostingRecord } from './types.js';

function records(count: number): JobPostingRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    url: `https://example.com/job/${index}`,
    title: `Job ${index}`,
    jobLocation: [],
  }));
}

function collectingSink(): ResultSink & { pushed: JobPostingRecord[] } {
  const pushed: JobPostingRecord[] = [];
  return {
    pushed,
    async push(record) {
      pushed.push(record);
    },
  };
}

/** A gateway with a finite budget, shaped like `ChargingManager.charge`. */
function budgetedGateway(budget: number): ChargeGateway & { calls: () => number } {
  let charged = 0;
  let calls = 0;
  return {
    calls: () => calls,
    async charge({ eventName, count = 1 }): Promise<ChargeResult> {
      calls += 1;
      assert.equal(eventName, JOB_RESULT_EVENT);
      const remaining = budget - charged;
      const chargedCount = Math.min(count, Math.max(0, remaining));
      charged += chargedCount;
      return {
        chargedCount,
        eventChargeLimitReached: charged >= budget,
        chargeableWithinLimit: { [JOB_RESULT_EVENT]: Math.max(0, budget - charged) },
      };
    },
  };
}

test('every delivered result is charged exactly once', async () => {
  const sink = collectingSink();
  const gateway = budgetedGateway(10);
  const summary = await deliverAndCharge(records(4), gateway, sink);
  assert.equal(summary.deliveredResults, 4);
  assert.equal(summary.chargedEvents, 4);
  assert.equal(summary.withheldForBudget, 0);
  assert.equal(summary.budgetExhausted, false);
  assert.equal(sink.pushed.length, 4);
  // One charge call per result, not one batched call — batching can be partially
  // fulfilled, which would leave results delivered but unbilled.
  assert.equal(gateway.calls(), 4);
});

test('a depleted budget stops delivery instead of giving results away', async () => {
  // This is the whole point of charging before pushing: the third result must
  // never reach the dataset, because nothing would pay for it.
  const sink = collectingSink();
  const gateway = budgetedGateway(2);
  const summary = await deliverAndCharge(records(5), gateway, sink);
  assert.equal(summary.deliveredResults, 2);
  assert.equal(summary.chargedEvents, 2);
  assert.equal(summary.withheldForBudget, 3);
  assert.equal(summary.budgetExhausted, true);
  assert.equal(sink.pushed.length, 2, 'unpaid results must not be pushed');
});

test('a budget already exhausted before the first charge delivers nothing', async () => {
  // Distinct from the test above, and the only case that exercises the pre-charge
  // guard: there, the budget runs out *during* the loop and the post-delivery
  // break stops it. Here the budget is gone before the loop starts — the run
  // budget was already consumed, e.g. by the apify-actor-start synthetic event —
  // so the first charge returns nothing and reports the limit. Without the guard,
  // every result would be pushed for free.
  const sink = collectingSink();
  const gateway = budgetedGateway(0);
  const summary = await deliverAndCharge(records(3), gateway, sink);
  assert.equal(summary.deliveredResults, 0);
  assert.equal(summary.chargedEvents, 0);
  assert.equal(summary.withheldForBudget, 3);
  assert.equal(summary.budgetExhausted, true);
  assert.equal(sink.pushed.length, 0, 'nothing may be delivered on a zero budget');
  assert.equal(gateway.calls(), 1, 'the loop must stop after the first refusal');
});

test('a free (non-pay-per-event) run still delivers every result', async () => {
  // ChargingManager.charge returns chargedCount 0 with the limit flag false when
  // the Actor is not on PPE pricing. Reading that as "budget gone" would silently
  // deliver nothing on every free run — the failure mode this pins.
  const sink = collectingSink();
  const gateway: ChargeGateway = {
    async charge(): Promise<ChargeResult> {
      return { chargedCount: 0, eventChargeLimitReached: false, chargeableWithinLimit: {} };
    },
  };
  const summary = await deliverAndCharge(records(3), gateway, sink);
  assert.equal(summary.deliveredResults, 3);
  assert.equal(summary.chargedEvents, 0);
  assert.equal(summary.withheldForBudget, 0);
  assert.equal(summary.budgetExhausted, false);
  assert.equal(sink.pushed.length, 3);
});

test('the overcharge-by-one result is delivered, then the run stops', async () => {
  // The SDK deliberately overcharges by one event when the budget is exceeded so
  // the platform terminates the run. That event was billed, so the user is owed
  // the result; what must not happen is continuing past it.
  const sink = collectingSink();
  let calls = 0;
  const gateway: ChargeGateway = {
    async charge(): Promise<ChargeResult> {
      calls += 1;
      // First call lands inside the budget; the second is the overcharge.
      return {
        chargedCount: 1,
        eventChargeLimitReached: calls >= 2,
        chargeableWithinLimit: {},
      };
    },
  };
  const summary = await deliverAndCharge(records(5), gateway, sink);
  assert.equal(summary.deliveredResults, 2, 'the billed overcharge result is still owed');
  assert.equal(summary.chargedEvents, 2);
  assert.equal(summary.withheldForBudget, 3);
  assert.equal(summary.budgetExhausted, true);
  assert.equal(calls, 2, 'no charge attempt after the limit was reported');
});

test('an exhausted budget is reported to the caller with real counts', async () => {
  const sink = collectingSink();
  const gateway = budgetedGateway(1);
  const seen: Array<{ delivered: number; withheld: number }> = [];
  const summary = await deliverAndCharge(records(4), gateway, sink, (delivered, withheld) => {
    seen.push({ delivered, withheld });
  });
  assert.deepEqual(seen, [{ delivered: 1, withheld: 3 }]);
  assert.equal(summary.deliveredResults, 1);
});

test('no charge is attempted when there is nothing to deliver', async () => {
  const sink = collectingSink();
  const gateway = budgetedGateway(10);
  const summary = await deliverAndCharge([], gateway, sink);
  assert.equal(gateway.calls(), 0, 'an empty run must cost the user nothing');
  assert.equal(summary.deliveredResults, 0);
  assert.equal(summary.chargedEvents, 0);
  assert.equal(summary.budgetExhausted, false);
});
