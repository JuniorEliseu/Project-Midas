export type AccountType = 'banco' | 'corretora' | 'cripto' | 'caixinha' | 'dinheiro';
export type Currency = 'BRL' | 'USD' | 'USDC' | 'EUR' | 'BTC' | 'ETH' | 'SOL';
export type BaseCurrency = 'BRL' | 'USD' | 'USDC' | 'EUR';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type InvestmentType = 'acao' | 'renda_fixa' | 'fundo' | 'cripto_ativo';

export interface Account {
  id?: number;
  name: string;
  type: AccountType;
  currency: Currency;
  initialBalance: number;
  color: string;
  icon?: string;
  updatedAt: string;
}

export interface Transaction {
  id?: number;
  type: TransactionType;
  accountId: number;
  destinationAccountId?: number;
  amount: number;
  destinationAmount?: number;
  category: string;
  description: string;
  date: string;
  goalId?: number;
  fixedExpenseId?: number;
}

export interface GoalAllocation {
  accountId: number;
  amount: number;
}

export interface Goal {
  id?: number;
  title: string;
  targetAmount: number;
  currentAmount: number;
  currency: Currency;
  accountId?: number; // Legacy, mantido opcional
  allocations?: GoalAllocation[]; // Novo sistema multi-contas
  deadline: string;
  color: string;
  icon?: string;
  category?: string;
}

export interface Investment {
  id?: number;
  name: string;
  ticker: string;
  type: InvestmentType;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  currency: Currency;
  yieldPercentage?: number;
  accountId?: number;
  purchaseDate?: string;
}

export interface DeFiPool {
  id?: number;
  protocol: string;
  pair: string;
  tokenA: string;
  tokenB: string;
  tokenAQuantity: number;
  tokenBQuantity: number;
  tokenAPriceUSD: number;
  tokenBPriceUSD: number;
  initialTokenAPriceUSD?: number;
  initialTokenBPriceUSD?: number;
  apr: number;
  apy?: number;
  stakedTotalValueUSD: number;
  pendingRewardsUSD: number;
  rewardToken: string;
  harvestCount?: number;
  totalHarvestedUSD?: number;
}

export interface RatesCache {
  id: string; // ex: 'latest'
  rates: Record<string, number>; // cotação em BRL (ex: BRL: 1, USD: 5.45, BTC: 350000)
  change24h: Record<string, number>; // variação 24h (%)
  timestamp: number;
  isOfflineFallback?: boolean;
}

export interface FixedExpense {
  id?: number;
  name: string;
  amount: number;
  accountId: number;
  category: string;
  isRecurring: boolean;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  lastProcessedMonth?: string; // YYYY-MM
}

export interface BackupPayload {
  version: string;
  createdAt: string;
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  investments: Investment[];
  defiPools: DeFiPool[];
  fixedExpenses?: FixedExpense[];
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  icon: string;
  color: string;
}
