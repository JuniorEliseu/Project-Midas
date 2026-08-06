import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { BaseCurrency } from '@/types';
import { Eye, EyeOff, Sun, Moon, Wifi, WifiOff, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { formatPercentage } from '@/utils/formatters';

export const Header: React.FC = () => {
  const {
    theme,
    toggleTheme,
    privacyMode,
    togglePrivacyMode,
    baseCurrency,
    setBaseCurrency,
    quotes,
    quotesChange24h,
    isOffline,
    isRefreshingRates,
    refreshRates,
    quotesSource
  } = useAppStore();

  const currencies: BaseCurrency[] = ['BRL', 'USD', 'USDC', 'EUR'];

  // Principais ativos monitorados no Ticker ao vivo
  const tickerItems = [
    { symbol: 'USD', rate: quotes.USD || 5.50, change: quotesChange24h.USD || 0, prefix: 'R$' },
    { symbol: 'EUR', rate: quotes.EUR || 6.05, change: quotesChange24h.EUR || 0, prefix: 'R$' },
    { symbol: 'BTC', rate: quotes.BTC || 345000, change: quotesChange24h.BTC || 0, prefix: 'R$' },
    { symbol: 'ETH', rate: quotes.ETH || 17875, change: quotesChange24h.ETH || 0, prefix: 'R$' },
    { symbol: 'SOL', rate: quotes.SOL || 825, change: quotesChange24h.SOL || 0, prefix: 'R$' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-dark-bg/95 backdrop-blur-md border-b border-gray-200 dark:border-dark-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo / Título */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-gray-950 font-bold text-xl tracking-tighter">
              M
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-600 dark:from-white dark:via-gray-200 dark:to-amber-400 bg-clip-text text-transparent">
                Midas Wb
              </h1>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-amber-500/90 dark:text-amber-400">
                Wealth & DeFi Tracker
              </p>
            </div>
          </div>

          {/* Ticker de Cotações Ao Vivo (Apenas em telas médias/grandes) */}
          <div className="hidden lg:flex items-center gap-4 overflow-x-auto py-1 px-3 bg-gray-50 dark:bg-dark-card/60 rounded-xl border border-gray-200/60 dark:border-dark-border/80 text-xs">
            <div className="flex items-center gap-1 text-gray-500 font-semibold border-r border-gray-200 dark:border-gray-800 pr-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Mercado 24h:</span>
            </div>
            {tickerItems.map((item) => {
              const isPositive = item.change >= 0;
              return (
                <div key={item.symbol} className="flex items-center gap-1.5 font-medium whitespace-nowrap">
                  <span className="text-gray-700 dark:text-gray-300 font-bold">{item.symbol}:</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {item.symbol === 'BTC' || item.symbol === 'ETH'
                      ? `R$ ${(item.rate / 1000).toFixed(1)}k`
                      : `R$ ${item.rate.toFixed(2)}`}
                  </span>
                  <span className={`flex items-center text-[10px] ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isPositive ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                    {formatPercentage(item.change)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Controles do Sistema */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Badge de Status da Conexão / Fallback Offline */}
            <div 
              title={`Fonte: ${quotesSource}`}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                isOffline
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
              }`}
            >
              {isOffline ? <WifiOff className="w-3.5 h-3.5 text-amber-500" /> : <Wifi className="w-3.5 h-3.5 text-emerald-500" />}
              <span>{isOffline ? 'Offline (Cache)' : 'API Ao Vivo'}</span>
              <button
                onClick={() => refreshRates()}
                disabled={isRefreshingRates}
                className="ml-1 hover:opacity-75 transition-opacity"
                title="Atualizar cotações agora"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingRates ? 'animate-spin text-brand-primary' : ''}`} />
              </button>
            </div>

            {/* Seletor de Moeda Base para Exibição no Dashboard */}
            <div className="flex items-center bg-gray-100 dark:bg-dark-card rounded-lg p-1 border border-gray-200 dark:border-dark-border">
              <span className="text-[10px] text-gray-400 font-semibold px-1.5 hidden md:inline">Base:</span>
              {currencies.map((curr) => (
                <button
                  key={curr}
                  onClick={() => setBaseCurrency(curr)}
                  className={`px-2 py-0.5 text-xs font-semibold rounded-md transition-all ${
                    baseCurrency === curr
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>

            {/* Botão de Modo Privacidade */}
            <button
              onClick={togglePrivacyMode}
              className="p-2 rounded-lg bg-gray-100 dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
              title={privacyMode ? 'Exibir valores (Modo Privacidade Ativado)' : 'Ocultar valores (Ativar Privacidade)'}
            >
              {privacyMode ? <EyeOff className="w-5 h-5 text-amber-500 animate-pulse" /> : <Eye className="w-5 h-5" />}
            </button>

            {/* Alternador de Tema Claro / Escuro */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-yellow-400 transition-colors"
              title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro Premium'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-indigo-400" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
