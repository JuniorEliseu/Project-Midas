import Dexie, { type EntityTable } from 'dexie';
import type { Account, Transaction, Goal, Investment, DeFiPool, RatesCache } from '@/types';

export class MidasDatabase extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  investments!: EntityTable<Investment, 'id'>;
  defiPools!: EntityTable<DeFiPool, 'id'>;
  ratesCache!: EntityTable<RatesCache, 'id'>;

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
  }
}

export const db = new MidasDatabase();

export async function seedDatabase(): Promise<void> {
  await db.transaction('rw', [db.accounts, db.transactions, db.goals, db.investments, db.defiPools, db.ratesCache], async () => {
    // Limpar tabelas caso existam para re-popular
    await db.accounts.clear();
    await db.transactions.clear();
    await db.goals.clear();
    await db.investments.clear();
    await db.defiPools.clear();
    await db.ratesCache.clear();

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
        category: 'Salário & Proventos',
        description: 'Recebimento Mensal Empresa Tech',
        date: formatDate(1)
      },
      {
        type: 'expense',
        accountId: nubankId as number,
        amount: 1850.40,
        category: 'Moradia & Aluguel',
        description: 'Aluguel + Condomínio Mês Vigente',
        date: formatDate(3)
      },
      {
        type: 'expense',
        accountId: nubankId as number,
        amount: 640.20,
        category: 'Alimentação & Lazer',
        description: 'Jantar Restaurante + Supermercado',
        date: formatDate(4)
      },
      {
        type: 'transfer',
        accountId: nubankId as number,
        destinationAccountId: xpId as number,
        amount: 3000.00,
        destinationAmount: 3000.00,
        category: 'Aporte Mensal',
        description: 'Transferência para Aportes em Ações e FIIs',
        date: formatDate(5)
      },
      {
        type: 'transfer',
        accountId: xpId as number,
        destinationAccountId: binanceId as number,
        amount: 5500.00, // em BRL approx $1000
        destinationAmount: 1000.00, // em USD
        category: 'Aporte Cripto',
        description: 'Depósito Via PIX na Binance para compra de Stablecoins',
        date: formatDate(8)
      },
      {
        type: 'income',
        accountId: binanceId as number,
        amount: 145.80,
        category: 'DeFi & Rendimentos',
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
}
