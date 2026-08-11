import Dexie, { type EntityTable } from 'dexie';
import type { Account, Transaction, Goal, Investment, DeFiPool, RatesCache, FixedExpense } from '@/types';

export class MidasDatabase extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  investments!: EntityTable<Investment, 'id'>;
  defiPools!: EntityTable<DeFiPool, 'id'>;
  ratesCache!: EntityTable<RatesCache, 'id'>;
  fixedExpenses!: EntityTable<FixedExpense, 'id'>;

  constructor() {
    super('MidasWbDB');

    this.version(1).stores({
      accounts: '++id, name, type, currency',
      transactions: '++id, accountId, destinationAccountId, date, category, type, goalId',
      goals: '++id, title, accountId, deadline',
      investments: '++id, ticker, type, accountId',
      defiPools: '++id, protocol, pair',
      ratesCache: 'id'
    });

    this.version(2).stores({
      fixedExpenses: '++id, accountId, name, isRecurring'
    });
  }
}

export const db = new MidasDatabase();

export async function seedDatabase(): Promise<void> {
  await db.transaction('rw', [db.accounts, db.transactions, db.goals, db.investments, db.defiPools, db.ratesCache, db.fixedExpenses], async () => {
    // Limpar tabelas caso existam para re-popular
    await db.accounts.clear();
    await db.transactions.clear();
    await db.goals.clear();
    await db.investments.clear();
    await db.defiPools.clear();
    await db.ratesCache.clear();
    await db.fixedExpenses.clear();

    const now = new Date().toISOString();

    // 1. Contas & Carteiras
    const nubankId = await db.accounts.add({
      name: 'Nubank (Conta Corrente)',
      type: 'banco',
      currency: 'BRL',
      initialBalance: 14500.00,
      color: '#8B5CF6', // Roxo Nubank
      icon: 'landmark',
      updatedAt: now,
    });

    const xpId = await db.accounts.add({
      name: 'XP Investimentos',
      type: 'corretora',
      currency: 'BRL',
      initialBalance: 45000.00,
      color: '#F59E0B', // Dourado/Amarelo XP
      icon: 'trending-up',
      updatedAt: now,
    });

    const binanceId = await db.accounts.add({
      name: 'Binance Exchange',
      type: 'cripto',
      currency: 'USD',
      initialBalance: 3200.00,
      color: '#FBBF24', // Binance Yellow
      icon: 'coins',
      updatedAt: now,
    });

    const ledgerId = await db.accounts.add({
      name: 'Ledger Hardware Wallet',
      type: 'cripto',
      currency: 'BTC',
      initialBalance: 0.15, // 0.15 BTC
      color: '#10B981', // Verde
      icon: 'shield-check',
      updatedAt: now,
    });

    const caixinhaId = await db.accounts.add({
      name: 'Caixinha Reserva de Emergência',
      type: 'caixinha',
      currency: 'BRL',
      initialBalance: 25000.00,
      color: '#3B82F6', // Azul
      icon: 'vault',
      updatedAt: now,
    });

    // 2. Transações Recentes
    const today = new Date();
    const formatDate = (daysAgo: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split('T')[0];
    };

    await db.transactions.bulkAdd([
      {
        type: 'income',
        accountId: nubankId as number,
        amount: 8500.00,
        category: 'Salário',
        description: 'Recebimento Mensal Empresa Tech',
        date: formatDate(1)
      },
      {
        type: 'expense',
        accountId: nubankId as number,
        amount: 1850.40,
        category: 'Aluguéis',
        description: 'Aluguel + Condomínio Mês Vigente',
        date: formatDate(3)
      },
      {
        type: 'expense',
        accountId: nubankId as number,
        amount: 640.20,
        category: 'Mercado',
        description: 'Jantar Restaurante + Supermercado',
        date: formatDate(4)
      },
      {
        type: 'transfer',
        accountId: nubankId as number,
        destinationAccountId: xpId as number,
        amount: 3000.00,
        destinationAmount: 3000.00,
        category: 'Investimentos',
        description: 'Transferência para Aportes em Ações e FIIs',
        date: formatDate(5)
      },
      {
        type: 'transfer',
        accountId: xpId as number,
        destinationAccountId: binanceId as number,
        amount: 5500.00, // em BRL approx $1000
        destinationAmount: 1000.00, // em USD
        category: 'Investimentos',
        description: 'Depósito Via PIX na Binance para compra de Stablecoins',
        date: formatDate(8)
      },
      {
        type: 'income',
        accountId: binanceId as number,
        amount: 145.80,
        category: 'Rendimentos DeFi',
        description: 'Recompensas de Liquidity Pool (Staking Rewards)',
        date: formatDate(10)
      }
    ]);

    // 3. Caixinhas / Objetivos Financeiros (Goals)
    await db.goals.bulkAdd([
      {
        title: 'Reserva de Emergência (6 Meses)',
        targetAmount: 35000,
        currentAmount: 25000,
        currency: 'BRL',
        accountId: caixinhaId as number,
        allocations: [{ accountId: caixinhaId as number, amount: 25000 }],
        deadline: '2026-12-31',
        color: '#10B981',
        icon: 'shield',
        category: 'Segurança Financeira'
      },
      {
        title: 'Viagem Tech Summit Japão',
        targetAmount: 28000,
        currentAmount: 12400,
        currency: 'BRL',
        accountId: nubankId as number,
        allocations: [{ accountId: nubankId as number, amount: 12400 }],
        deadline: '2027-04-15',
        color: '#F43F5E',
        icon: 'plane',
        category: 'Lazer & Experiências'
      },
      {
        title: 'Acumular 1.0 BTC na Ledger',
        targetAmount: 1.0,
        currentAmount: 0.15,
        currency: 'BTC',
        accountId: ledgerId as number,
        allocations: [{ accountId: ledgerId as number, amount: 0.15 }],
        deadline: '2028-12-31',
        color: '#F59E0B',
        icon: 'coins',
        category: 'Liberdade Financeira'
      }
    ]);

    // 4. Investimentos Tradicionais (Ações e Renda Fixa)
    await db.investments.bulkAdd([
      {
        name: 'Petrobras Preferencial',
        ticker: 'PETR4',
        type: 'acao',
        quantity: 350,
        purchasePrice: 32.50,
        currentPrice: 39.80,
        currency: 'BRL',
        yieldPercentage: 14.8,
        accountId: xpId as number
      },
      {
        name: 'WEG S.A.',
        ticker: 'WEGE3',
        type: 'acao',
        quantity: 200,
        purchasePrice: 44.20,
        currentPrice: 53.90,
        currency: 'BRL',
        yieldPercentage: 3.2,
        accountId: xpId as number
      },
      {
        name: 'Tesouro IPCA+ 2035',
        ticker: 'IPCA+2035',
        type: 'renda_fixa',
        quantity: 5,
        purchasePrice: 3200.00,
        currentPrice: 3450.00,
        currency: 'BRL',
        yieldPercentage: 11.65,
        accountId: xpId as number
      },
      {
        name: 'Ethereum Hold',
        ticker: 'ETH',
        type: 'cripto_ativo',
        quantity: 1.25,
        purchasePrice: 2800.00,
        currentPrice: 3250.00,
        currency: 'USD',
        yieldPercentage: 4.2,
        accountId: ledgerId as number
      }
    ]);

    // 5. Pools de Liquidez DeFi
    await db.defiPools.bulkAdd([
      {
        protocol: 'Uniswap V3 (Arbitrum)',
        pair: 'ETH / USDC (0.05%)',
        tokenA: 'ETH',
        tokenB: 'USDC',
        tokenAQuantity: 0.85,
        tokenBQuantity: 2760,
        tokenAPriceUSD: 3250,
        tokenBPriceUSD: 1.0,
        initialTokenAPriceUSD: 2900,
        initialTokenBPriceUSD: 1.0,
        apr: 28.4,
        apy: 32.8,
        stakedTotalValueUSD: 5522.50,
        pendingRewardsUSD: 142.30,
        rewardToken: 'UNI / ARB'
      },
      {
        protocol: 'Raydium (Solana)',
        pair: 'SOL / USDC Concentrated',
        tokenA: 'SOL',
        tokenB: 'USDC',
        tokenAQuantity: 18.5,
        tokenBQuantity: 2775,
        tokenAPriceUSD: 150.00,
        tokenBPriceUSD: 1.0,
        initialTokenAPriceUSD: 135.00,
        initialTokenBPriceUSD: 1.0,
        apr: 64.2,
        apy: 88.5,
        stakedTotalValueUSD: 5550.00,
        pendingRewardsUSD: 310.80,
        rewardToken: 'RAY / SOL'
      }
    ]);

    // 6. Cache Inicial Preenchido (Fallback de Segurança)
    await db.ratesCache.put({
      id: 'latest',
      rates: {
        BRL: 1.0,
        USD: 5.50,
        USDC: 5.50,
        EUR: 6.05,
        BTC: 345000.0,
        ETH: 17875.0,
        SOL: 825.0
      },
      change24h: {
        BRL: 0,
        USD: 0.25,
        USDC: 0.10,
        EUR: -0.15,
        BTC: 3.45,
        ETH: 2.15,
        SOL: 6.80
      },
      timestamp: Date.now(),
      isOfflineFallback: true
    });
  });
}

// Função para garantir retrocompatibilidade com caixinhas antigas sem array de alocações
export async function migrateLegacyGoals(): Promise<void> {
  const goals = await db.goals.toArray();
  for (const goal of goals) {
    if (!goal.allocations && goal.accountId) {
      await db.goals.update(goal.id!, {
        allocations: [{
          accountId: goal.accountId,
          amount: goal.currentAmount
        }]
      });
    }
  }
}

// Inicializa automaticamente com dados simulados caso o banco esteja zerado no primeiro acesso
export async function autoInitIfEmpty(): Promise<void> {
  const hasInitialized = localStorage.getItem('midas_has_initialized_once');
  
  if (!hasInitialized) {
    const count = await db.accounts.count();
    if (count === 0) {
      await seedDatabase();
      localStorage.setItem('midas_has_initialized_once', 'true');
    }
  }

  // Executa migração de dados legados sempre que inicializa o banco
  await migrateLegacyGoals();
}

// Helper para iterar os meses
function getNextMonthStr(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

// Verifica se há despesas fixas para cobrar no mês atual (ou em retroativo se ficou sem abrir)
export async function processFixedExpenses(): Promise<void> {
  const expenses = await db.fixedExpenses.toArray();
  const currentDate = new Date();
  const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  if (expenses.length === 0) return;

  await db.transaction('rw', [db.fixedExpenses, db.transactions, db.accounts], async () => {
    for (const exp of expenses) {
      const startDateObj = new Date(exp.startDate);
      const startMonthStr = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}`;
      
      // Se lastProcessedMonth não existe, iniciamos UM MÊS ANTES do startMonthStr
      // Para que o startMonthStr seja processado dentro do loop.
      let currentIterMonth = exp.lastProcessedMonth 
        ? getNextMonthStr(exp.lastProcessedMonth) 
        : startMonthStr;

      const endMonthStr = exp.endDate 
        ? `${new Date(exp.endDate).getFullYear()}-${String(new Date(exp.endDate).getMonth() + 1).padStart(2, '0')}`
        : '9999-12'; // Futuro distante para recorrentes

      const acc = await db.accounts.get(exp.accountId);
      if (!acc) continue;

      let totalAmountToDeduct = 0;
      let lastProcessedInLoop = exp.lastProcessedMonth;

      while (currentIterMonth <= currentMonthStr && currentIterMonth <= endMonthStr) {
        // Criar transação para este mês
        const txDate = `${currentIterMonth}-01`; // Dia 1 do mês para fins históricos
        
        // Verifica se JÁ EXISTE uma transação para esta despesa fixa neste mês exato
        const existingTxs = await db.transactions
          .filter(t => t.fixedExpenseId === exp.id && t.date.startsWith(currentIterMonth))
          .toArray();

        if (existingTxs.length === 0) {
          await db.transactions.add({
            type: 'expense',
            accountId: exp.accountId,
            amount: exp.amount,
            category: exp.category || 'Gasto Fixo',
            description: `${exp.name} (Ref: ${currentIterMonth})`,
            date: txDate,
            fixedExpenseId: exp.id
          });

          totalAmountToDeduct += exp.amount;
        }
        
        lastProcessedInLoop = currentIterMonth;
        
        currentIterMonth = getNextMonthStr(currentIterMonth);
      }

      if (totalAmountToDeduct > 0) {
        // Atualiza a conta
        await db.accounts.update(exp.accountId, {
          initialBalance: acc.initialBalance - totalAmountToDeduct
        });

        // Atualiza a data processada
        await db.fixedExpenses.update(exp.id!, {
          lastProcessedMonth: lastProcessedInLoop
        });
      }
    }
  });
}

