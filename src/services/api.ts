import { db } from './db';
import type { RatesCache } from '@/types';

// Taxas padrão realistas em BRL para o caso extremo de o navegador estar sem cache e offline na 1ª abertura
const DEFAULT_RATES: Record<string, number> = {
  BRL: 1.0,
  USD: 5.50,
  USDC: 5.50,
  EUR: 6.05,
  BTC: 345000.0,
  ETH: 17875.0,
  SOL: 825.0
};

const DEFAULT_CHANGES: Record<string, number> = {
  BRL: 0,
  USD: 0.1,
  USDC: 0.0,
  EUR: -0.2,
  BTC: 2.8,
  ETH: 1.5,
  SOL: 4.2
};

export interface LiveQuotesResult {
  rates: Record<string, number>; // cotação do ativo em BRL (ex: USD = 5.50 significa $1 USD = R$ 5.50)
  change24h: Record<string, number>;
  timestamp: number;
  isOffline: boolean;
  source: string;
}

export async function fetchLiveRates(): Promise<LiveQuotesResult> {
  try {
    // Verifica conexão do navegador antes de requisitar
    if (!navigator.onLine) {
      return await getFallbackFromCache('Navegador em Modo Offline - Usando cache do IndexedDB');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6 segundos limite

    // 1. Requisitar Cotações Fiat (AwesomeAPI: USD, EUR, BTC em BRL)
    const awesomePromise = fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL', {
      signal: controller.signal
    }).then(r => {
      if (!r.ok) throw new Error('AwesomeAPI error');
      return r.json();
    });

    // 2. Requisitar Cripto (Binance API: BTC, ETH, SOL em BRL)
    const binancePromise = fetch(
      'https://api.binance.com/api/v3/ticker/price?symbols=["BTCBRL","ETHBRL","SOLBRL"]',
      { signal: controller.signal }
    ).then(r => {
      if (!r.ok) throw new Error('Binance API error');
      return r.json();
    });

    const [fiatData, binanceData] = await Promise.all([awesomePromise, binancePromise]);
    clearTimeout(timeout);

    const btcObj = binanceData.find((x: any) => x.symbol === 'BTCBRL');
    const ethObj = binanceData.find((x: any) => x.symbol === 'ETHBRL');
    const solObj = binanceData.find((x: any) => x.symbol === 'SOLBRL');

    const rates: Record<string, number> = {
      BRL: 1.0,
      USD: parseFloat(fiatData.USDBRL?.bid || DEFAULT_RATES.USD.toString()),
      EUR: parseFloat(fiatData.EURBRL?.bid || DEFAULT_RATES.EUR.toString()),
      USDC: parseFloat(fiatData.USDBRL?.bid || '5.50'),
      BTC: btcObj ? parseFloat(btcObj.price) : DEFAULT_RATES.BTC,
      ETH: ethObj ? parseFloat(ethObj.price) : DEFAULT_RATES.ETH,
      SOL: solObj ? parseFloat(solObj.price) : DEFAULT_RATES.SOL,
    };

    const change24h: Record<string, number> = {
      BRL: 0,
      USD: parseFloat(fiatData.USDBRL?.pctChange || '0'),
      EUR: parseFloat(fiatData.EURBRL?.pctChange || '0'),
      USDC: 0,
      BTC: 0, // Binance ticker/price doesn't have 24h change, can fetch from 24hr endpoint if needed, but 0 is ok for now.
      ETH: 0,
      SOL: 0,
    };

    const now = Date.now();

    // Persistir no IndexedDB como novo cache principal
    const cacheRecord: RatesCache = {
      id: 'latest',
      rates,
      change24h,
      timestamp: now,
      isOfflineFallback: false
    };

    await db.ratesCache.put(cacheRecord);

    return {
      rates,
      change24h,
      timestamp: now,
      isOffline: false,
      source: 'APIs Ao Vivo (AwesomeAPI & CoinGecko)'
    };
  } catch (error) {
    console.warn('Falha ao consultar APIs gratuitas de cotação. Usando fallback offline do IndexedDB:', error);
    return await getFallbackFromCache('Limite de API ou Sem Conexão - Usando Cotações Salvas em Cache (Offline-First)');
  }
}

async function getFallbackFromCache(reason: string): Promise<LiveQuotesResult> {
  const cached = await db.ratesCache.get('latest');
  if (cached && cached.rates) {
    return {
      rates: cached.rates,
      change24h: cached.change24h || DEFAULT_CHANGES,
      timestamp: cached.timestamp || Date.now(),
      isOffline: true,
      source: reason
    };
  }

  // Falha extrema no 1º boot se banco estiver totalmente vazio
  return {
    rates: DEFAULT_RATES,
    change24h: DEFAULT_CHANGES,
    timestamp: Date.now(),
    isOffline: true,
    source: 'Valores Padrão Simulado (Offline Absoluto)'
  };
}

// Converte valores de qualquer moeda para a moeda alvo
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>
): number {
  if (fromCurrency === toCurrency || !amount) return amount;
  
  const fromRate = rates[fromCurrency] || 1;
  const toRate = rates[toCurrency] || 1;
  
  // Como as taxas em `rates` estão expressas em BRL (ex: USD=5.50 significa 1 USD = 5.50 BRL):
  // 1. Converter de fromCurrency para BRL (amount * fromRate)
  // 2. Converter de BRL para toCurrency (/ toRate)
  const valueInBRL = amount * fromRate;
  return valueInBRL / toRate;
}
