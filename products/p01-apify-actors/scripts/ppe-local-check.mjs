/**
 * Local pay-per-event check against the real SDK charging path.
 *
 * The unit tests in `src/billing.test.ts` drive `deliverAndCharge` through a
 * test double. This script drives it through the actual `Actor.charge`, which is
 * what catches wiring mistakes the double cannot see — a wrong event name, a
 * missing `Actor.init`, or a charge that never reaches the ChargingManager.
 *
 * `ACTOR_TEST_PAY_PER_EVENT` puts the SDK into pay-per-event mode locally; both
 * it and `ACTOR_USE_CHARGING_LOG_DATASET` throw on the platform, so this can
 * only ever run on a developer machine.
 *
 * Two modes, because one run cannot check both things. Locally the SDK values
 * every event at a notional $1 when deciding whether the budget allows another
 * charge (`calculateEventPrice` returns 1 unless `isAtHome`), but bills the
 * declared price. With `$0.003` declared, those two disagree by 300x and no
 * sane budget both stops the loop and matches the real price:
 *
 * - `declared` injects `.actor/pricing.json` the way the platform does, and
 *   checks the event this code charges is actually a declared, priced event. An
 *   undeclared name is billed at $0 in production — the Actor would run, deliver,
 *   and earn nothing.
 * - `budget` declares no prices, so the $1 notional applies to both sides of the
 *   arithmetic and the run budget is reachable. It checks that an exhausted
 *   budget stops delivery.
 *
 * Run with: npm run check:ppe
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
if (mode !== 'declared' && mode !== 'budget') {
  console.error('usage: node scripts/ppe-local-check.mjs <declared|budget>');
  process.exit(2);
}

const RESULT_COUNT = 5;
/** Only meaningful in `budget` mode, where one event costs the notional $1. */
const BUDGETED_EVENTS = 3;

process.env.ACTOR_TEST_PAY_PER_EVENT = 'true';
process.env.ACTOR_USE_CHARGING_LOG_DATASET = 'true';
process.env.APIFY_CHARGED_ACTOR_EVENT_COUNTS = '{}';

if (mode === 'declared') {
  const pricingPath = fileURLToPath(new URL('../.actor/pricing.json', import.meta.url));
  const actorChargeEvents = JSON.parse(readFileSync(pricingPath, 'utf8'));
  process.env.APIFY_ACTOR_PRICING_INFO = JSON.stringify({
    pricingModel: 'PAY_PER_EVENT',
    pricingPerEvent: { actorChargeEvents },
  });
  // Far above anything RESULT_COUNT can spend, so this mode says nothing about
  // budget behaviour — that is what `budget` mode is for.
  process.env.ACTOR_MAX_TOTAL_CHARGE_USD = '1000';
} else {
  process.env.APIFY_ACTOR_PRICING_INFO = JSON.stringify({
    pricingModel: 'PAY_PER_EVENT',
    pricingPerEvent: { actorChargeEvents: {} },
  });
  process.env.ACTOR_MAX_TOTAL_CHARGE_USD = String(BUDGETED_EVENTS);
}

const { Actor } = await import('apify');
const { deliverAndCharge, JOB_RESULT_EVENT } = await import('../dist/billing.js');

await Actor.init();

const results = Array.from({ length: RESULT_COUNT }, (_, index) => ({
  url: `https://example.com/job/${index}`,
  title: `Job ${index}`,
  jobLocation: [],
}));

const summary = await deliverAndCharge(
  results,
  { charge: (options) => Actor.charge(options) },
  { push: (record) => Actor.pushData(record) },
);

const chargingManager = Actor.getChargingManager();
const chargedCount = chargingManager.getChargedEventCount(JOB_RESULT_EVENT);
const pricingInfo = chargingManager.getPricingInfo();

const problems = [];
if (!pricingInfo.isPayPerEvent) {
  problems.push('the SDK did not enter pay-per-event mode');
}
if (chargedCount !== summary.chargedEvents) {
  problems.push(
    `ChargingManager recorded ${chargedCount} '${JOB_RESULT_EVENT}' events but the ` +
      `run reported ${summary.chargedEvents} — the charge is not reaching the SDK ` +
      'under the name this code thinks it is using',
  );
}

if (mode === 'declared') {
  const declared = Object.keys(pricingInfo.perEventPrices);
  if (!declared.includes(JOB_RESULT_EVENT)) {
    problems.push(
      `'${JOB_RESULT_EVENT}' is not declared in .actor/pricing.json ` +
        `(declared: ${declared.join(', ') || 'none'}) — an undeclared event is ` +
        'billed at $0 in production and earns nothing',
    );
  }
  if (summary.deliveredResults !== RESULT_COUNT || summary.chargedEvents !== RESULT_COUNT) {
    problems.push(
      `delivered ${summary.deliveredResults} and charged ${summary.chargedEvents} of ` +
        `${RESULT_COUNT} results with budget to spare — every result must be both`,
    );
  }
  if (summary.budgetExhausted) {
    problems.push('the budget was reported exhausted on a run that cannot exhaust it');
  }
} else {
  if (summary.chargedEvents !== BUDGETED_EVENTS) {
    problems.push(`charged ${summary.chargedEvents} events, expected ${BUDGETED_EVENTS}`);
  }
  if (summary.deliveredResults !== BUDGETED_EVENTS) {
    problems.push(
      `delivered ${summary.deliveredResults} results on a ${BUDGETED_EVENTS}-event ` +
        'budget — results must not outrun what was paid for',
    );
  }
  if (summary.withheldForBudget !== RESULT_COUNT - BUDGETED_EVENTS) {
    problems.push(`withheld ${summary.withheldForBudget}, expected ${RESULT_COUNT - BUDGETED_EVENTS}`);
  }
  if (!summary.budgetExhausted) {
    problems.push('the exhausted budget was not reported');
  }
}

console.log(`mode=${mode} event=${JOB_RESULT_EVENT} summary=${JSON.stringify(summary)}`);
console.log(`declaredPrices=${JSON.stringify(pricingInfo.perEventPrices)}`);
console.log(`chargingManager.getChargedEventCount=${chargedCount}`);

await Actor.exit({ exit: false });

if (problems.length > 0) {
  for (const problem of problems) console.error(`FAIL[${mode}]: ${problem}`);
  process.exit(1);
}
console.log(`OK[${mode}]`);
