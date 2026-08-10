export interface CostInput {
  executionsPerMonth: number;
  nodeInvocationsPerExecution: number;
  inputTokensPerInvocation: number;
  outputTokensPerInvocation: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  platformCostPerExecution: number;
  usdToCny: number;
}

export interface CostResult {
  monthlyNodeInvocations: number;
  monthlyInputTokens: number;
  monthlyOutputTokens: number;
  modelCostUsd: number;
  platformCostUsd: number;
  totalCostUsd: number;
  totalCostCny: number;
  averageCostPerExecutionUsd: number;
}

const requiredCostFields: Array<keyof CostInput> = [
  'executionsPerMonth',
  'nodeInvocationsPerExecution',
  'inputTokensPerInvocation',
  'outputTokensPerInvocation',
  'inputPricePerMillion',
  'outputPricePerMillion',
  'platformCostPerExecution',
  'usdToCny',
];

function finiteNonNegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`);
  return value;
}

export function calculateCost(input: CostInput): CostResult {
  for (const name of requiredCostFields) finiteNonNegative(input[name], name);
  const monthlyNodeInvocations = input.executionsPerMonth * input.nodeInvocationsPerExecution;
  const monthlyInputTokens = monthlyNodeInvocations * input.inputTokensPerInvocation;
  const monthlyOutputTokens = monthlyNodeInvocations * input.outputTokensPerInvocation;
  const modelCostUsd = (monthlyInputTokens / 1_000_000) * input.inputPricePerMillion
    + (monthlyOutputTokens / 1_000_000) * input.outputPricePerMillion;
  const platformCostUsd = input.executionsPerMonth * input.platformCostPerExecution;
  const totalCostUsd = modelCostUsd + platformCostUsd;
  return {
    monthlyNodeInvocations,
    monthlyInputTokens,
    monthlyOutputTokens,
    modelCostUsd,
    platformCostUsd,
    totalCostUsd,
    totalCostCny: totalCostUsd * input.usdToCny,
    averageCostPerExecutionUsd: input.executionsPerMonth ? totalCostUsd / input.executionsPerMonth : 0,
  };
}
