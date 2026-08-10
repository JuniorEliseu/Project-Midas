import { db } from '@/services/db';
import { useAppStore, type ActiveTab } from '@/store/useAppStore';
import { LayoutDashboard, Wallet, ArrowLeftRight, Vault, TrendingUp, ShieldCheck, Sparkles, Trash2, Calendar } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab } = useAppStore();

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: 'dashboard', label: 'Dashboard Principal', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'accounts', label: 'Contas & Carteiras', icon: <Wallet className="w-5 h-5" /> },
    { id: 'transactions', label: 'Registros & Lançamentos', icon: <ArrowLeftRight className="w-5 h-5" /> },
    { id: 'goals', label: 'Caixinhas (Objetivos)', icon: <Vault className="w-5 h-5" /> },
    { id: 'investments', label: 'Investimentos & DeFi', icon: <TrendingUp className="w-5 h-5" />, badge: 'DeFi Pro' },
    { id: 'fixed_expenses', label: 'Gastos Fixos', icon: <Calendar className="w-5 h-5" /> },
    { id: 'settings', label: 'Segurança & Backup', icon: <ShieldCheck className="w-5 h-5" /> },
  ];

  return (
    <aside className="w-full md:w-64 flex-shrink-0 bg-white/70 dark:bg-dark-card/60 backdrop-blur-md border-r border-gray-200 dark:border-dark-border flex flex-col justify-between p-4">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Menu de Navegação
        </div>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600/15 to-indigo-600/15 dark:from-blue-500/20 dark:to-indigo-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 shadow-sm font-semibold'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Caixa de Informação do Projeto Simulado e Botão Reset */}
      <div className="mt-8 space-y-3">
        <button
          onClick={async () => {
            if (window.confirm("ALERTA CRÍTICO: Você está prestes a apagar TODOS os registros financeiros. Esta ação não pode ser desfeita. Tem certeza?")) {
              if (window.confirm("SEGUNDO ALERTA: Confirme novamente se deseja realmente apagar tudo e resetar o aplicativo.")) {
                await db.accounts.clear();
                await db.transactions.clear();
                await db.goals.clear();
                await db.investments.clear();
                await db.defiPools.clear();
                
                // Nós mantemos a flag 'midas_has_initialized_once' no localStorage 
                // para garantir que o autoInitIfEmpty não recarregue os dados demo da Seed!
                localStorage.setItem('midas_has_initialized_once', 'true');
                
                window.location.reload();
              }
            }
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Zerar Dados (Reset Factory)
        </button>

        <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-500/20">
          <div className="flex items-center gap-2 text-amber-500 font-semibold text-xs mb-1.5">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Simulado Acadêmico</span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
            Execução 100% <strong>Client-Side & Offline-First</strong> com IndexedDB, cotações ao vivo e criptografia AES-256.
          </p>
        </div>
      </div>
    </aside>
  );
};
