import React, { useEffect, Suspense } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { autoInitIfEmpty } from '@/services/db';
import { Header } from '@/components/common/Header';
import { Sidebar } from '@/components/common/Sidebar';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { AccountsView } from '@/features/accounts/AccountsView';
import { TransactionsView } from '@/features/transactions/TransactionsView';
import { GoalsView } from '@/features/goals/GoalsView';
import { InvestmentsView } from '@/features/investments/InvestmentsView';
import { SettingsView } from '@/features/settings/SettingsView';
import { Loader2 } from 'lucide-react';

export function App() {
  const { activeTab, initTheme, refreshRates } = useAppStore();

  useEffect(() => {
    // 1. Inicializa o tema escuro/claro salvo no localStorage
    initTheme();

    // 2. Garante que se o IndexedDB estiver absolutamente zerado, auto-injeta o Seed Demo de demonstração
    autoInitIfEmpty().catch(err => console.error('Erro ao verificar auto-init IndexedDB:', err));

    // 3. Requisita as cotações das APIs gratuitas (com fallback gracioso em cache se offline)
    refreshRates();
  }, [initTheme, refreshRates]);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'accounts':
        return <AccountsView />;
      case 'transactions':
        return <TransactionsView />;
      case 'goals':
        return <GoalsView />;
      case 'investments':
        return <InvestmentsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-dark-bg text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Header Superior Fixado */}
      <Header />

      {/* Corpo Principal: Sidebar + Container Dinâmico de Conteúdo */}
      <div className="flex-1 flex flex-col md:flex-row">
        <Sidebar />
        
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full overflow-y-auto">
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
              <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Carregando Módulo Midas Wb...</p>
            </div>
          }>
            {renderActiveView()}
          </Suspense>
        </main>
      </div>

      {/* Rodapé Acadêmico e Institucional */}
      <footer className="py-4 px-6 bg-white dark:bg-dark-card/80 border-t border-gray-200 dark:border-dark-border text-center text-xs text-gray-500 dark:text-gray-400">
        <p>
          <strong>Projeto Midas Wb</strong> &bull; Sistema Profissional de Planejamento Financeiro & Patrimônio (Simulado Acadêmico)
        </p>
        <p className="mt-0.5 text-[11px] opacity-75">
          Desenvolvido com React, TypeScript, Vite, TailwindCSS, TanStack Table, ECharts & Dexie (IndexedDB Offline-First).
        </p>
      </footer>
    </div>
  );
}

export default App;
