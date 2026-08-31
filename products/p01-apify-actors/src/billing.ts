import type { ChargeResult } from 'apify';
import type { JobPostingRecord } from './types.js';

/**
 * The single billable event this Actor charges for.
 *
 * One event, one unit of delivered value: a job posting that survived parsing
 * and filtering and is about to be handed to the user. SPEC prices it at
 * $0.003 per result, but the price lives on the platform, not here — this
 * module only decides *when* to charge, never *how much*.
 *
 * The name must match the event declared in `.actor/pricing.json` and applied
 * in Apify Console; an unknown name charges nothing and logs a warning.
 */
export const JOB_RESULT_EVENT = 'job-result';

/**
 * The slice of `Actor` this module needs, so the charging decisions can be
 * tested without a platform run or a live account.
 */
export interface ChargeGateway {
  charge(options: { eventName: string; count?: number }): Promise<ChargeResult>;
}

/** Where a paid-for result goes. In production this is `Actor.pushData`. */
export interface ResultSink {
  push(record: JobPostingRecord): Promise<unknown>;
}

export interface BillingSummary {
  /** Results handed to the user. */
  deliveredResults: number;
  /** Events actually billed. Equals 0 on a non-pay-per-event run. */
  chargedEvents: number;
  /** Results withheld because the run's budget was exhausted. */
  withheldForBudget: number;
  /** True when the user's `maxTotalChargeUsd` stopped the run early. */
  budgetExhausted: boolean;
}

/**
 * Charge for each result, then deliver it.
 *
 * Charge-then-deliver, one event at a time, is the order the SDK documents:
 * batching via `count` can be partially fulfilled, which leaves the caller
 * having promised more work than the budget bought. Per-unit charging means the
 * decision to stop is taken before any value leaves the Actor.
 *
 * Two distinct zero-charge cases must not be confused, which is the subtle part:
 *
 * - `chargedCount === 0` with `eventChargeLimitReached === false` is a run that
 *   is not on pay-per-event pricing at all (`ChargingManager.charge` returns
 *   exactly this and warns once). Results are still owed to the user — free is
 *   a valid price, and withholding here would silently break every free run.
 * - `chargedCount === 0` with `eventChargeLimitReached === true` is a depleted
 *   budget. Delivering anyway would be unpaid work.
 *
 * A charged result whose `eventChargeLimitReached` is true is the SDK's
 * deliberate overcharge-by-one: it is billed and delivered, and the platform
 * terminates the run afterwards. So the flag is checked again after delivery.
 */
export async function deliverAndCharge(
  results: readonly JobPostingRecord[],
  gateway: ChargeGateway,
  sink: ResultSink,
  onBudgetExhausted?: (delivered: number, withheld: number) => void,
): Promise<BillingSummary> {
  let deliveredResults = 0;
  let chargedEvents = 0;
  let budgetExhausted = false;

  for (const result of results) {
    const { chargedCount, eventChargeLimitReached } = await gateway.charge({
      eventName: JOB_RESULT_EVENT,
    });

    if (chargedCount === 0 && eventChargeLimitReached) {
      budgetExhausted = true;
      break;
    }

    await sink.push(result);
    deliveredResults += 1;
    chargedEvents += chargedCount;

    if (eventChargeLimitReached) {
      budgetExhausted = true;
      break;
    }
  }

  const withheldForBudget = results.length - deliveredResults;
  if (budgetExhausted && onBudgetExhausted) {
    onBudgetExhausted(deliveredResults, withheldForBudget);
  }

  return { deliveredResults, chargedEvents, withheldForBudget, budgetExhausted };
}
