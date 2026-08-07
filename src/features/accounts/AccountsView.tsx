import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db';
import { useAppStore } from '@/store/useAppStore';
import type { AccountType, Currency } from '@/types';
import { convertCurrency } from '@/services/api';
import { formatCurrency } from '@/utils/formatters';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Wallet, Plus, Trash2, Landmark, TrendingUp, Coins, Vault, DollarSign, ArrowRightLeft } from 'lucide-react';

const accountSchema = z.object({
  name: z.string().min(3, 'O nome da conta deve ter pelo menos 3 caracteres'),
  type: z.enum(['banco', 'corretora', 'cripto', 'caixinha', 'dinheiro']),
  currency: z.enum(['BRL', 'USD', 'USDC', 'EUR', 'BTC', 'ETH', 'SOL']),
  initialBalance: z.string().min(1, 'Informe o saldo atual ou inicial'),
  color: z.string()
});

type AccountFormValues = z.infer<typeof accountSchema>;

export const AccountsView: React.FC = () => {
  const { baseCurrency, quotes, privacyMode } = useAppStore();
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const goals = useLiveQuery(() => db.goals.toArray()) || [];

  const [filterType, setFilterType] = useState<string>('todos');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados para Delegação para Caixinha
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
  const [delegateAccountId, setDelegateAccountId] = useState<number | null>(null);
  const [delegateGoalId, setDelegateGoalId] = useState<string>('');
  const [delegateAmount, setDelegateAmount] = useState<string>('');

  // Conversor Multimodal Rápido
  const [calcAmount, setCalcAmount] = useState<string>('100');
  const [calcFrom, setCalcFrom] = useState<Currency>('USD');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: '',
      type: 'banco',
      currency: 'BRL',
      initialBalance: '0',
      color: '#3B82F6'
    }
  });

  const onSubmit = async (data: AccountFormValues) => {
    const balance = parseFloat(data.initialBalance.replace(',', '.'));
    const parsedBalance = isNaN(balance) ? 0 : balance;

    const newAccountId = await db.accounts.add({
      name: data.name,
      type: data.type as AccountType,
      currency: data.currency as Currency,
      initialBalance: parsedBalance,
      color: data.color,
      icon: data.type === 'banco' ? 'landmark' : data.type === 'corretora' ? 'trending-up' : data.type === 'cripto' ? 'coins' : 'vault',
      updatedAt: new Date().toISOString()
    });

    if (parsedBalance > 0) {
      await db.transactions.add({
        type: 'income',
        accountId: newAccountId,
        amount: parsedBalance,
        category: 'Saldo Inicial',
        description: 'Abertura de Conta',
        date: new Date().toISOString().split('T')[0]
      });
    }

    reset();
    setIsModalOpen(false);
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (window.confirm('Tem certeza que deseja remover esta conta do seu portfólio no IndexedDB?')) {
      await db.accounts.delete(id);
    }
  };

  const handleOpenDelegate = (accountId: number) => {
    setDelegateAccountId(accountId);
    setDelegateGoalId('');
    setDelegateAmount('');
    setIsDelegateModalOpen(true);
  };

  const handleDelegateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateAccountId || !delegateGoalId || !delegateAmount) return;

    const amountNum = parseFloat(delegateAmount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Valor inválido");
      return;
    }

    const account = await db.accounts.get(delegateAccountId);
    if (!account) return;

    // A validação do limite não pode exceder o saldo atual (initialBalance) - o que a conta JÁ DELEGOU nas outras caixinhas
    // Calculando quanto esta conta já delegou globalmente:
    const allGoals = await db.goals.toArray();
    const totalDelegated = allGoals.reduce((sum, g) => {
      if (g.allocations) {
        const alloc = g.allocations.find(a => a.accountId === delegateAccountId);
        return sum + (alloc ? alloc.amount : 0);
      }
      // legacy fallback
      if (g.accountId === delegateAccountId) {
         return sum + g.currentAmount;
      }
      return sum;
    }, 0);

    const availableBalance = account.initialBalance - totalDelegated;
    if (amountNum > availableBalance) {
      alert(`Você não pode delegar mais do que o saldo livre da conta.\nSaldo livre: ${formatCurrency(availableBalance, account.currency, false)}`);
      return;
    }

    const goalId = parseInt(delegateGoalId, 10);
    const goal = await db.goals.get(goalId);
    if (!goal) return;

    // Atualizar alocações da caixinha
    let updatedAllocations = goal.allocations ? [...goal.allocations] : [];
    if (!goal.allocations && goal.accountId && goal.currentAmount > 0) {
      // Migrate se não estiver migrado
      updatedAllocations = [{ accountId: goal.accountId, amount: goal.currentAmount }];
    }

    const allocIndex = updatedAllocations.findIndex(a => a.accountId === delegateAccountId);
    if (allocIndex !== -1) {
      updatedAllocations[allocIndex].amount += amountNum;
    } else {
      updatedAllocations.push({ accountId: delegateAccountId, amount: amountNum });
    }

    await db.goals.update(goalId, {
      allocations: updatedAllocations,
      currentAmount: goal.currentAmount + amountNum
    });

    setIsDelegateModalOpen(false);
  };

  const filteredAccounts = accounts.filter(a => filterType === 'todos' ? true : a.type === filterType);

  const getTypeIcon = (type: AccountType) => {
    switch (type) {
      case 'banco': return <Landmark className="w-5 h-5 text-blue-500" />;
      case 'corretora': return <TrendingUp className="w-5 h-5 text-emerald-500" />;
      case 'cripto': return <Coins className="w-5 h-5 text-purple-500" />;
      case 'caixinha': return <Vault className="w-5 h-5 text-amber-500" />;
      default: return <DollarSign className="w-5 h-5 text-gray-400" />;
    }
  };

  const getTypeLabel = (type: AccountType) => {
    switch (type) {
      case 'banco': return 'Conta Bancária';
      case 'corretora': return 'Corretora de Investimentos';
      case 'cripto': return 'Carteira / Exchange Cripto';
      case 'caixinha': return 'Caixinha (Objetivos)';
      default: return 'Dinheiro / Em Pé';
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      {/* Cabeçalho do Módulo & Controles */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-7 h-7 text-blue-500" />
            Contas & Carteiras Multimodal
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Gerencie saldos em bancos tradicionais, corretoras e cripto com conversão cambial contínua.
          </p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Nova Conta ou Carteira
        </Button>
      </div>

      {/* Seletor de Filtros de Tipos de Conta */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-200 dark:border-dark-border">
        {['todos', 'banco', 'corretora', 'cripto', 'caixinha'].map((type) => {
          const isActive = filterType === type;
          const label = type === 'todos' ? 'Todas' : type === 'banco' ? 'Bancos' : type === 'corretora' ? 'Corretoras' : type === 'cripto' ? 'Cripto Wallets' : 'Caixinhas';
          return (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'bg-white dark:bg-dark-card text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-dark-border hover:border-blue-500/30'
                }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Grade de Contas do Portfólio */}
      {filteredAccounts.length === 0 ? (
        <Card className="text-center py-12 text-gray-500">
          Nenhuma conta correspondente ao filtro foi encontrada. Clique em "Nova Conta" para cadastrar.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAccounts.map((account) => {
            const convertedVal = convertCurrency(account.initialBalance, account.currency, baseCurrency, quotes);
            const isDifferentCurr = account.currency !== baseCurrency;

            return (
              <Card
                key={account.id}
                hoverEffect
                className="flex flex-col justify-between relative overflow-hidden group border-l-4"
                style={{ borderLeftColor: account.color || '#3B82F6' }}
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800/80">
                        {getTypeIcon(account.type)}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                          {account.name}
                        </h4>
                        <span className="text-xs text-gray-400 font-medium">
                          {getTypeLabel(account.type)}
                        </span>
                      </div>
                    </div>
                    <Badge variant={account.type === 'cripto' ? 'purple' : account.type === 'corretora' ? 'success' : 'info'}>
                      {account.currency}
                    </Badge>
                  </div>

                  {/* Exibição de Saldo */}
                  <div className="mt-4 p-4 rounded-xl bg-gray-50/70 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-800/70">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 mb-1">
                      Saldo Atual (Nativo)
                    </p>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 font-mono">
                      {formatCurrency(account.initialBalance, account.currency, privacyMode)}
                    </p>
                    {isDifferentCurr && (
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">
                        ≈ {formatCurrency(convertedVal, baseCurrency, privacyMode)} (em {baseCurrency})
                      </p>
                    )}
                  </div>
                </div>

                {/* Ações da Conta */}
                <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-gray-200/40 dark:border-gray-800/50 opacity-90 sm:opacity-70 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpenDelegate(account.id!)}
                    className="p-1.5 text-blue-500 hover:text-white rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-1 text-xs font-semibold px-2"
                    title="Delegar Saldo para uma Caixinha"
                  >
                    <Vault className="w-3.5 h-3.5" /> Delegar
                  </button>
                  <button
                    onClick={() => handleDelete(account.id)}
                    className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
                    title="Remover Conta do IndexedDB"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Ferramenta Interativa: Conversor Cambial Multimodal */}
      <Card
        title={
          <span className="flex items-center gap-2 font-bold text-base text-amber-500">
            <ArrowRightLeft className="w-5 h-5 text-amber-500" />
            Conversor Cambial e Cripto (Taxas em Tempo Real)
          </span>
        }
        subtitle="Simule conversões instantâneas entre moedas fiduciárias e criptoativos monitorados"
        className="bg-gradient-to-r from-gray-900/40 via-gray-800/20 to-transparent border-amber-500/20"
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-2 items-center">
          <div className="lg:col-span-1 space-y-3">
            <Input
              label="Valor a Converter"
              value={calcAmount}
              onChange={(e) => setCalcAmount(e.target.value)}
              placeholder="Ex: 100"
              type="number"
            />
            <Select
              label="Moeda de Origem"
              value={calcFrom}
              onChange={(e) => setCalcFrom(e.target.value as Currency)}
              options={[
                { value: 'BRL', label: 'BRL - Real Brasileiro' },
                { value: 'USD', label: 'USD - Dólar Americano' },
                { value: 'USDC', label: 'USDC - USD Coin Stablecoin' },
                { value: 'EUR', label: 'EUR - Euro Europeu' },
                { value: 'BTC', label: 'BTC - Bitcoin' },
                { value: 'ETH', label: 'ETH - Ethereum' },
                { value: 'SOL', label: 'SOL - Solana' },
              ]}
            />
          </div>

          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {['BRL', 'USD', 'EUR', 'BTC', 'ETH', 'SOL', 'USDC'].filter(c => c !== calcFrom).map((targetCurr) => {
              const valNum = parseFloat(calcAmount || '0');
              const res = convertCurrency(valNum, calcFrom, targetCurr, quotes);
              return (
                <div key={targetCurr} className="p-3.5 rounded-xl bg-white/70 dark:bg-dark-card border border-gray-200 dark:border-dark-border shadow-sm flex flex-col justify-between">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Em {targetCurr}:</span>
                  <span className="text-base font-extrabold text-gray-900 dark:text-white font-mono mt-1">
                    {targetCurr === 'BTC' || targetCurr === 'ETH' || targetCurr === 'SOL'
                      ? res.toFixed(6)
                      : res.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-emerald-500 font-semibold mt-1">Taxa ao vivo</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Modal de Criação de Conta */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Cadastrar Nova Conta ou Carteira"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Nome da Conta / Carteira"
            placeholder="Ex: Nubank, Carteira Metamask, XP Corretora"
            {...register('name')}
            error={errors.name?.message}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tipo de Conta"
              {...register('type')}
              error={errors.type?.message}
              options={[
                { value: 'banco', label: 'Conta Bancária' },
                { value: 'corretora', label: 'Corretora / Investimentos' },
                { value: 'cripto', label: 'Carteira / Exchange Cripto' },
                { value: 'caixinha', label: 'Caixinha (Objetivo)' },
                { value: 'dinheiro', label: 'Dinheiro Físico' },
              ]}
            />
            <Select
              label="Moeda Nativa"
              {...register('currency')}
              error={errors.currency?.message}
              options={[
                { value: 'BRL', label: 'BRL - Real (R$)' },
                { value: 'USD', label: 'USD - Dólar ($)' },
                { value: 'USDC', label: 'USDC - Stablecoin' },
                { value: 'EUR', label: 'EUR - Euro (€)' },
                { value: 'BTC', label: 'BTC - Bitcoin (₿)' },
                { value: 'ETH', label: 'ETH - Ethereum (Ξ)' },
                { value: 'SOL', label: 'SOL - Solana (◎)' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Saldo Atual ou Inicial"
              placeholder="Ex: 5000.00 ou 0.25 (cripto)"
              type="number"
              step="any"
              {...register('initialBalance')}
              error={errors.initialBalance?.message}
            />
            <Select
              label="Cor do Tema da Conta"
              {...register('color')}
              options={[
                { value: '#3B82F6', label: '🔵 Azul Midas' },
                { value: '#8B5CF6', label: '🟣 Roxo FinTech' },
                { value: '#F59E0B', label: '🟡 Dourado Corretora' },
                { value: '#10B981', label: '🟢 Verde Lucro' },
                { value: '#F43F5E', label: '🔴 Rosa Moderno' },
                { value: '#06B6D4', label: 'Ciano Cripto' },
              ]}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-gray-200 dark:border-gray-800">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Salvar no IndexedDB
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Delegação para Caixinha */}
      <Modal
        isOpen={isDelegateModalOpen}
        onClose={() => setIsDelegateModalOpen(false)}
        title="Delegar Valor para Caixinha"
      >
        <form onSubmit={handleDelegateSubmit} className="space-y-4">
          <Select
            label="Escolha a Caixinha (Objetivo)"
            value={delegateGoalId}
            onChange={(e) => setDelegateGoalId(e.target.value)}
            options={[
              { value: '', label: 'Selecione uma caixinha...' },
              ...goals.map(g => ({ value: g.id!.toString(), label: g.title }))
            ]}
          />
          <Input
            label="Valor a Delegar"
            placeholder="Ex: 500.00"
            type="number"
            step="any"
            value={delegateAmount}
            onChange={(e) => setDelegateAmount(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-gray-200 dark:border-gray-800">
            <Button type="button" variant="outline" onClick={() => setIsDelegateModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Confirmar Delegação
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
