import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCost } from './cost.js';

test('calculates monthly model and platform cost', () => {
  const result = calculateCost({
    executionsPerMonth: 1000,
    nodeInvocationsPerExecution: 2,
    inputTokensPerInvocation: 1000,
    outputTokensPerInvocation: 500,
    inputPricePerMillion: 2,
    outputPricePerMillion: 8,
    platformCostPerExecution: 0.001,
    usdToCny: 7.2,
  });
  assert.equal(result.monthlyNodeInvocations, 2000);
  assert.equal(result.modelCostUsd, 12);
  assert.equal(result.platformCostUsd, 1);
  assert.ok(Math.abs(result.totalCostCny - 93.6) < 1e-9);
});

test('rejects a missing required cost field', () => {
  assert.throws(() => calculateCost({
    executionsPerMonth: 1000,
    nodeInvocationsPerExecution: 2,
    inputTokensPerInvocation: 1000,
    outputTokensPerInvocation: 500,
    inputPricePerMillion: 2,
    outputPricePerMillion: 8,
    platformCostPerExecution: 0.001,
  } as never), /usdToCny must be a non-negative number/);
});
