export interface CompoundInterestResult {
  timeline: Array<{
    month: number;
    invested: number;
    total: number;
    interest: number;
  }>;
  totalInvested: number;
  finalBalance: number;
  totalInterestEarned: number;
}

export function calculateCompoundInterest(
  initialPrincipal: number,
  monthlyContribution: number,
  annualYieldPercentage: number,
  years: number
): CompoundInterestResult {
  const months = years * 12;
  const monthlyRate = Math.pow(1 + annualYieldPercentage / 100, 1 / 12) - 1;

  let balance = initialPrincipal;
  let invested = initialPrincipal;
  const timeline = [];

  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
    invested += monthlyContribution;
    timeline.push({
      month: m,
      invested: Number(invested.toFixed(2)),
      total: Number(balance.toFixed(2)),
      interest: Number((balance - invested).toFixed(2))
    });
  }

  return {
    timeline,
    totalInvested: Number(invested.toFixed(2)),
    finalBalance: Number(balance.toFixed(2)),
    totalInterestEarned: Number((balance - invested).toFixed(2))
  };
}

export interface ImpermanentLossResult {
  priceRatioP: number;
  impermanentLossPercentage: number; // Porcentagem de perda em relação a segurar na carteira (HODL)
  hodlValueUSD: number; // Valor se apenas segurasse na carteira
  poolValueUSD: number; // Valor no pool de liquidez
  lossInUSD: number;
}

/**
 * Simulador Matemático de Impermanent Loss em Pools de Liquidez Automáticos (AMM - Constant Product x * y = k)
 * A fórmula de IL em relação à variação do preço do Token A vs Token B (Razão P) é:
 * IL = (2 * sqrt(P) / (1 + P)) - 1
 */
export function calculateImpermanentLoss(
  initialTokenAPhysical: number,
  initialTokenBPhysical: number,
  initialPriceA: number, // USD
  initialPriceB: number, // USD
  newPriceA: number, // USD
  newPriceB: number  // USD
): ImpermanentLossResult {
  const initialRatio = initialPriceA / (initialPriceB || 1);
  const newRatio = newPriceA / (newPriceB || 1);
  const P = newRatio / (initialRatio || 1);

  // Fórmula de Impermanent Loss
  const ilFactor = (2 * Math.sqrt(P)) / (1 + P) - 1; // Valor negativo, ex: -0.057 para 5.7% de perda
  const impermanentLossPercentage = Math.abs(ilFactor * 100);

  // Valor HODL (Se tivesse mantido fora do pool de liquidez, na carteira física)
  const hodlValueUSD = initialTokenAPhysical * newPriceA + initialTokenBPhysical * newPriceB;
  
  // Valor real no Pool após rebalanceamento algorítmico do AMM
  const poolValueUSD = hodlValueUSD * (1 + ilFactor);
  const lossInUSD = hodlValueUSD - poolValueUSD;

  return {
    priceRatioP: Number(P.toFixed(4)),
    impermanentLossPercentage: Number(impermanentLossPercentage.toFixed(2)),
    hodlValueUSD: Number(hodlValueUSD.toFixed(2)),
    poolValueUSD: Number(poolValueUSD.toFixed(2)),
    lossInUSD: Number(Math.max(0, lossInUSD).toFixed(2))
  };
}
