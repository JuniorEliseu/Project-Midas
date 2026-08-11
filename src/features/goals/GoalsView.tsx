import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db';
import { useAppStore } from '@/store/useAppStore';
import type { Currency, Goal } from '@/types';
import { convertCurrency } from '@/services/api';
import { formatCurrency, formatDate, formatPercentage } from '@/utils/formatters';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Vault, Plus, Trophy, Trash2, Calendar, Target, ArrowUpRight, ShieldCheck, Plane, Coins } from 'lucide-react';

const goalSchema = z.object({
  title: z.string().min(3, 'O título deve ter pelo menos 3 caracteres'),
  targetAmount: z.string().min(1, 'Informe a meta financeira do objetivo'),
  currentAmount: z.string().min(1, 'Informe quanto já existe reservado na caixinha'),
  currency: z.enum(['BRL', 'USD', 'USDC', 'EUR', 'BTC', 'ETH', 'SOL']),
  accountId: z.string().optional(),
  deadline: z.string().min(1, 'Informe a data limite estimada'),
  color: z.string(),
  category: z.string().min(2, 'Informe a categoria da caixinha')
});

type GoalFormValues = z.infer<typeof goalSchema>;

export const GoalsView: React.FC = () => {
  const { baseCurrency, quotes, privacyMode } = useAppStore();
  const goals = useLiveQuery(() => db.goals.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedGoalForAction, setSelectedGoalForAction] = useState<Goal | null>(null);
  const [actionType, setActionType] = useState<'aporte' | 'resgate' | null>(null);
  const [actionAccountId, setActionAccountId] = useState<string>('');
  const [actionAmount, setActionAmount] = useState('');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      title: '',
      targetAmount: '',
      currentAmount: '0',
      currency: 'BRL',
      accountId: '',
      deadline: '2027-12-31',
      color: '#10B981',
      category: 'Segurança Financeira'
    }
  });

  const onSubmitNew = async (data: GoalFormValues) => {
    const target = parseFloat(data.targetAmount.replace(',', '.'));
    const current = parseFloat(data.currentAmount.replace(',', '.'));
    const accId = data.accountId ? parseInt(data.accountId, 10) : undefined;

    await db.goals.add({
      title: data.title,
      targetAmount: isNaN(target) ? 1000 : target,
      currentAmount: isNaN(current) ? 0 : current,
      currency: data.currency as Currency,
      accountId: accId,
      deadline: data.deadline,
      color: data.color,
      icon: data.category.includes('Lazer') ? 'plane' : data.currency === 'BTC' ? 'coins' : 'shield',
      category: data.category
    });
    reset();
    setIsNewModalOpen(false);
  };

  const handleGoalAction = async () => {
    if (!selectedGoalForAction || !selectedGoalForAction.id || !actionAccountId) return;
    const val = parseFloat(actionAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      alert('Digite um valor numérico válido!');
      return;
    }
    const accId = parseInt(actionAccountId, 10);
    const account = accounts.find(a => a.id === accId);
    if (!account) return;

    let updatedAllocations = selectedGoalForAction.allocations ? [...selectedGoalForAction.allocations] : [];
    // Legado
    if (!selectedGoalForAction.allocations && selectedGoalForAction.accountId && selectedGoalForAction.currentAmount > 0) {
      updatedAllocations = [{ accountId: selectedGoalForAction.accountId, amount: selectedGoalForAction.currentAmount }];
    }

    const allocIndex = updatedAllocations.findIndex(a => a.accountId === accId);
    const currentAllocAmount = allocIndex !== -1 ? updatedAllocations[allocIndex].amount : 0;

    if (actionType === 'resgate') {
      if (val > currentAllocAmount) {
        alert(`Você não pode resgatar mais do que esta conta possui guardado nesta caixinha.\nSaldo disponível da conta aqui: ${formatCurrency(currentAllocAmount, selectedGoalForAction.currency, false)}`);
        return;
      }
      updatedAllocations[allocIndex].amount -= val;
      await db.goals.update(selectedGoalForAction.id, {
        allocations: updatedAllocations,
        currentAmount: selectedGoalForAction.currentAmount - val
      });
    } else {
      // Aporte
      const totalDelegated = goals.reduce((sum, g) => {
        if (g.allocations) {
          const alloc = g.allocations.find(a => a.accountId === accId);
          if (alloc) {
            return sum + convertCurrency(alloc.amount, g.currency, account.currency, quotes);
          }
        } else if (g.accountId === accId) {
          return sum + convertCurrency(g.currentAmount, g.currency, account.currency, quotes);
        }
        return sum;
      }, 0);
      
      const availableBalance = account.initialBalance - totalDelegated;
      if (val > availableBalance) {
        alert(`A conta selecionada não possui saldo livre suficiente.\nSaldo livre: ${formatCurrency(availableBalance, account.currency, false)}`);
        return;
      }
      if (allocIndex !== -1) {
        updatedAllocations[allocIndex].amount += val;
      } else {
        updatedAllocations.push({ accountId: accId, amount: val });
      }
      await db.goals.update(selectedGoalForAction.id, {
        allocations: updatedAllocations,
        currentAmount: selectedGoalForAction.currentAmount + val
      });
    }

    setSelectedGoalForAction(null);
    setActionType(null);
    setActionAmount('');
    setActionAccountId('');
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (window.confirm('Tem certeza que deseja apagar este objetivo (caixinha) do seu planejamento no IndexedDB?')) {
      await db.goals.delete(id);
    }
  };

  // Cálculo Geral Consolidado de Caixinhas
  let totalReservedBase = 0;
  let totalTargetBase = 0;
  goals.forEach(g => {
    totalReservedBase += convertCurrency(g.currentAmount, g.currency, baseCurrency, quotes);
    totalTargetBase += convertCurrency(g.targetAmount, g.currency, baseCurrency, quotes);
  });
  const overallPct = totalTargetBase > 0 ? (totalReservedBase / totalTargetBase) * 100 : 0;

  const getIcon = (icon?: string) => {
    if (icon === 'plane') return <Plane className="w-5 h-5 text-rose-500" />;
    if (icon === 'coins') return <Coins className="w-5 h-5 text-amber-500" />;
    return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
  };

  const accountOptions = accounts.map(a => ({
    value: a.id ? a.id.toString() : '',
    label: `${a.name} (${a.currency})`
  }));

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Vault className="w-7 h-7 text-amber-500" />
            Caixinhas & Objetivos Patrimoniais
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Alocação virtual de saldos reservados dentro de contas bancárias ou carteiras de cripto sem bloquear liquidez.
          </p>
        </div>
        <Button 
          onClick={() => setIsNewModalOpen(true)}
          variant="gold" 
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Nova Caixinha / Objetivo
        </Button>
      </div>

      {/* Barra de Resumo das Caixinhas */}
      <Card glow className="bg-gradient-to-r from-gray-900/50 via-amber-950/15 to-transparent border-amber-500/30">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">
              Total Reservado Nas Caixinhas ({baseCurrency})
            </span>
            <p className="text-3xl font-extrabold text-gray-900 dark:text-white font-mono">
              {formatCurrency(totalReservedBase, baseCurrency, privacyMode)}
            </p>
            <p className="text-xs text-gray-400">
              Meta somada do portfólio de objetivos: <strong>{formatCurrency(totalTargetBase, baseCurrency, privacyMode)}</strong>
            </p>
          </div>
          <div className="w-full md:w-64 space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-gray-400">Progresso Geral do Planejamento</span>
              <span className="text-amber-400 font-bold">{formatPercentage(overallPct)}</span>
            </div>
            <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.min(100, overallPct)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </Card>

      {/* Grade de Objetivos (Caixinhas) */}
      {goals.length === 0 ? (
        <Card className="text-center py-12 text-gray-500">
          Nenhuma caixinha criada no momento. Clique no botão dourado para planejar sua reserva ou viagem!
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal) => {
            const acc = accounts.find(a => a.id === goal.accountId);
            const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
            const isCompleted = progress >= 100;

            return (
              <Card 
                key={goal.id} 
                hoverEffect 
                className="flex flex-col justify-between relative overflow-hidden border-t-4"
                style={{ borderTopColor: goal.color || '#10B981' }}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800/80">
                        {getIcon(goal.icon)}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-gray-900 dark:text-white leading-snug">
                          {goal.title}
                        </h4>
                        <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1 mt-0.5">
                          {goal.category || 'Objetivo Geral'}
                        </span>
                      </div>
                    </div>
                    {isCompleted ? (
                      <Badge variant="gold" className="flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-yellow-400" /> Concluída!
                      </Badge>
                    ) : (
                      <Badge variant="default">{goal.currency}</Badge>
                    )}
                  </div>

                  {/* Informações da Conta Reservada & Prazos */}
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 py-2 border-t border-b border-gray-200/50 dark:border-gray-800/60 my-3">
                    <span className="flex items-center gap-1">
                      <Target className="w-3.5 h-3.5 text-blue-500" />
                      Conta: <strong className="text-gray-700 dark:text-gray-300">{acc ? acc.name : 'Virtual Livre'}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-rose-500" />
                      Prazo: {formatDate(goal.deadline)}
                    </span>
                  </div>

                  {/* Saldo da Caixinha */}
                  <div className="mt-3 p-4 rounded-xl bg-gray-50/70 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-800/70 space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-gray-400 font-semibold">Acumulado:</span>
                      <span className="text-xl font-extrabold text-gray-900 dark:text-white font-mono">
                        {formatCurrency(goal.currentAmount, goal.currency, privacyMode)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline text-xs text-gray-500">
                      <span>Meta Alvo:</span>
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        {formatCurrency(goal.targetAmount, goal.currency, privacyMode)}
                      </span>
                    </div>

                    {/* Barra de Progresso Individual */}
                    <div className="pt-2">
                      <div className="flex justify-between text-[11px] font-bold mb-1">
                        <span className="text-gray-400">Progresso da Meta</span>
                        <span className="text-emerald-500">{progress.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, progress)}%`, backgroundColor: goal.color || '#10B981' }}
                        ></div>
                      </div>
                    </div>

                    {/* Origem dos Fundos (Alocações) */}
                    <div className="pt-3 border-t border-gray-200/50 dark:border-gray-800/60 mt-2">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Origem dos Fundos</p>
                      {goal.allocations && goal.allocations.length > 0 ? goal.allocations.filter(a => a.amount > 0).map(alloc => {
                        const allocAcc = accounts.find(a => a.id === alloc.accountId);
                        return (
                          <div key={alloc.accountId} className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400 py-0.5">
                            <span className="truncate">{allocAcc?.name || 'Conta Removida'}</span>
                            <span className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(alloc.amount, goal.currency, privacyMode)}</span>
                          </div>
                        );
                      }) : (
                        <p className="text-[11px] text-gray-400">Nenhum fundo alocado</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Controles do Cartão */}
                <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-gray-200/40 dark:border-gray-800/50">
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
                    title="Excluir Objetivo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] px-2.5 py-1 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700"
                      onClick={() => {
                        setSelectedGoalForAction(goal);
                        setActionType('resgate');
                        setActionAmount('');
                      }}
                    >
                      Resgatar
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="text-[11px] px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 border-none text-white shadow-emerald-500/20"
                      onClick={() => {
                        setSelectedGoalForAction(goal);
                        setActionType('aporte');
                        setActionAmount('');
                      }}
                    >
                      + Aportar
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal para Adicionar Aporte/Resgate na Caixinha */}
      <Modal
        isOpen={!!selectedGoalForAction}
        onClose={() => { setSelectedGoalForAction(null); setActionType(null); }}
        title={selectedGoalForAction ? `${actionType === 'aporte' ? 'Aportar em' : 'Resgatar de'}: ${selectedGoalForAction.title}` : 'Ação'}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {actionType === 'aporte' 
              ? `De qual conta você quer alocar fundos para esta caixinha (${selectedGoalForAction?.currency})?`
              : `Para qual conta você quer devolver fundos resgatados desta caixinha?`}
          </p>

          <Select
            label="Conta"
            value={actionAccountId}
            onChange={(e) => setActionAccountId(e.target.value)}
            options={[
              { value: '', label: 'Selecione uma conta...' },
              ...accounts.map(a => ({ value: a.id!.toString(), label: a.name }))
            ]}
          />

          <Input
            label={`Valor do ${actionType === 'aporte' ? 'Aporte' : 'Resgate'}`}
            placeholder="Ex: 500.00"
            type="number"
            step="any"
            value={actionAmount}
            onChange={(e) => setActionAmount(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
            <Button variant="outline" onClick={() => { setSelectedGoalForAction(null); setActionType(null); }}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleGoalAction}>
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Criação de Nova Caixinha */}
      <Modal 
        isOpen={isNewModalOpen} 
        onClose={() => setIsNewModalOpen(false)} 
        title="Planejar Novo Objetivo Patrimonial (Caixinha)"
      >
        <form onSubmit={handleSubmit(onSubmitNew)} className="space-y-4">
          <Input
            label="Título do Objetivo / Meta"
            placeholder="Ex: Reserva de Emergência ou Viagem Japão"
            {...register('title')}
            error={errors.title?.message}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Meta Alvo (Target)"
              placeholder="Ex: 30000 ou 1.0 (BTC)"
              type="number"
              step="any"
              {...register('targetAmount')}
              error={errors.targetAmount?.message}
            />
            <Input
              label="Saldo Já Reservado (Inicial)"
              placeholder="Ex: 5000"
              type="number"
              step="any"
              {...register('currentAmount')}
              error={errors.currentAmount?.message}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Moeda da Caixinha"
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
            <Select
              label="Vincular à Conta Existente"
              {...register('accountId')}
              options={[
                { value: '', label: '-- Sem vínculo específico (Livre) --' },
                ...accountOptions
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Prazo Estimado de Realização"
              type="date"
              {...register('deadline')}
              error={errors.deadline?.message}
            />
            <Select
              label="Cor e Categoria"
              {...register('color')}
              options={[
                { value: '#10B981', label: '🟢 Verde - Segurança' },
                { value: '#F43F5E', label: '🔴 Rosa - Lazer & Viagem' },
                { value: '#F59E0B', label: '🟡 Dourado - Cripto Meta' },
                { value: '#3B82F6', label: '🔵 Azul - Bem-Estar & Veículo' },
                { value: '#8B5CF6', label: '🟣 Roxo - Liberdade Financeira' },
              ]}
            />
          </div>
          <Input
            label="Categoria Descritiva"
            placeholder="Ex: Segurança Financeira, Viagem, Cripto Acúmulo"
            {...register('category')}
            error={errors.category?.message}
          />

          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-gray-200 dark:border-gray-800">
            <Button type="button" variant="outline" onClick={() => setIsNewModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="gold" isLoading={isSubmitting}>
              Cadastrar Caixinha no IndexedDB
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
