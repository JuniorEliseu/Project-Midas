import { create } from 'zustand';
import type { BaseCurrency } from '@/types';
import { fetchLiveRates } from '@/services/api';

export type ActiveTab = 'dashboard' | 'accounts' | 'transactions' | 'goals' | 'investments' | 'settings';
export type ThemeMode = 'dark' | 'light';

interface AppState {
  theme: ThemeMode;
  baseCurrency: BaseCurrency;
  privacyMode: boolean;
  activeTab: ActiveTab;
  quotes: Record<string, number>;
  quotesChange24h: Record<string, number>;
  quotesUpdated: number;
  isOffline: boolean;
  quotesSource: string;
  isRefreshingRates: boolean;

  // Actions
  toggleTheme: () => void;
  setBaseCurrency: (currency: BaseCurrency) => void;
  togglePrivacyMode: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  refreshRates: () => Promise<void>;
  initTheme: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: 'dark',
  baseCurrency: (localStorage.getItem('midas_base_currency') as BaseCurrency) || 'BRL',
  privacyMode: localStorage.getItem('midas_privacy') === 'true',
  activeTab: 'dashboard',
  quotes: { BRL: 1, USD: 5.50, USDC: 5.50, EUR: 6.05, BTC: 345000, ETH: 17875, SOL: 825 },
  quotesChange24h: { BRL: 0, USD: 0.25, USDC: 0.05, EUR: -0.15, BTC: 3.45, ETH: 2.15, SOL: 6.80 },
  quotesUpdated: Date.now(),
  isOffline: !navigator.onLine,
  quotesSource: 'Carregando...',
  isRefreshingRates: false,

  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme: nextTheme });
    localStorage.setItem('midas_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  initTheme: () => {
    const saved = localStorage.getItem('midas_theme') as ThemeMode;
    const theme: ThemeMode = saved ? saved : 'dark';
    set({ theme });
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },

  setBaseCurrency: (baseCurrency: BaseCurrency) => {
    localStorage.setItem('midas_base_currency', baseCurrency);
    set({ baseCurrency });
  },

  togglePrivacyMode: () => {
    const next = !get().privacyMode;
    localStorage.setItem('midas_privacy', next ? 'true' : 'false');
    set({ privacyMode: next });
  },

  setActiveTab: (activeTab: ActiveTab) => {
    set({ activeTab });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  refreshRates: async () => {
    set({ isRefreshingRates: true });
    try {
      const res = await fetchLiveRates();
      set({
        quotes: res.rates,
        quotesChange24h: res.change24h,
        quotesUpdated: res.timestamp,
        isOffline: res.isOffline,
        quotesSource: res.source,
      });
    } finally {
      set({ isRefreshingRates: false });
    }
  }
}));
