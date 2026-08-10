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
  impermanentLossPercentage: number;
  hodlValueUSD: number;
  poolValueUSD: number;
  lossInUSD: number;
}

export function calculateImpermanentLoss(
  initialTokenAPhysical: number,
  initialTokenBPhysical: number,
  initialPriceA: number,
  initialPriceB: number,
  newPriceA: number,
  newPriceB: number
): ImpermanentLossResult {
  const initialRatio = initialPriceA / (initialPriceB || 1);
  const newRatio = newPriceA / (newPriceB || 1);
  const P = newRatio / (initialRatio || 1);

  const ilFactor = (2 * Math.sqrt(P)) / (1 + P) - 1;
  const impermanentLossPercentage = Math.abs(ilFactor * 100);

  const hodlValueUSD = initialTokenAPhysical * newPriceA + initialTokenBPhysical * newPriceB;
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

export function getDaysBetween(startDateStr: string): number {
  const start = new Date(startDateStr);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - start.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function getIRRate(days: number): number {
  if (days <= 180) return 22.5;
  if (days <= 360) return 20.0;
  if (days <= 720) return 17.5;
  return 15.0;
}

export function getIOFRate(days: number): number {
  if (days >= 30) return 0;
  const iofTable = [
    96, 93, 90, 86, 83, 80, 76, 73, 70, 66,
    63, 60, 56, 53, 50, 46, 43, 40, 36, 33,
    30, 26, 23, 20, 16, 13, 10, 6, 3, 0
  ];
  return iofTable[days] || 0;
}
