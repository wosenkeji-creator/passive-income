const form = document.querySelector('#calculator');
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

async function calculate(event) {
  event?.preventDefault();
  const input = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, Number(value)]));
  const response = await fetch('/api/calculate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Calculation failed');
  document.querySelector('#total-usd').textContent = money.format(result.totalCostUsd);
  document.querySelector('#total-cny').textContent = `CNY ${result.totalCostCny.toFixed(2)}`;
  document.querySelector('#model-cost').textContent = money.format(result.modelCostUsd);
  document.querySelector('#platform-cost').textContent = money.format(result.platformCostUsd);
  document.querySelector('#per-run').textContent = `$${result.averageCostPerExecutionUsd.toFixed(4)}`;
  document.querySelector('#tokens').textContent = `${number.format(result.monthlyInputTokens + result.monthlyOutputTokens)} tokens`;
  document.querySelector('#runs').textContent = `${number.format(input.executionsPerMonth)} executions`;
  document.querySelector('#nodes').textContent = `${number.format(result.monthlyNodeInvocations)} node calls`;
  document.querySelector('#error').textContent = '';
}

form.addEventListener('submit', (event) => calculate(event).catch((error) => { document.querySelector('#error').textContent = error.message; }));
calculate().catch((error) => { document.querySelector('#error').textContent = error.message; });
