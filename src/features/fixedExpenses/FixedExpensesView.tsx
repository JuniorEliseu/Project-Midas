import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, processFixedExpenses } from '@/services/db';
import { useAppStore } from '@/store/useAppStore';
import { formatCurrency } from '@/utils/formatters';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Calendar, Plus, Trash2, Edit2, Repeat, CalendarX2 } from 'lucide-react';
import type { FixedExpense } from '@/types';

const fixedExpenseSchema = z.object({
  name: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  amount: z.string().min(1, 'Informe o valor da despesa'),
  accountId: z.string().min(1, 'Selecione uma conta de origem'),
  category: z.string().min(1, 'Informe a categoria'),
  isRecurring: z.boolean(),
  startDate: z.string().min(1, 'Data inicial obrigatória'),
  endDate: z.string().optional()
});

type FixedExpenseFormValues = z.infer<typeof fixedExpenseSchema>;

export const FixedExpensesView: React.FC = () => {
  const { privacyMode } = useAppStore();
  const fixedExpenses = useLiveQuery(() => db.fixedExpenses.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FixedExpenseFormValues>({
    resolver: zodResolver(fixedExpenseSchema),
    defaultValues: {
      isRecurring: true,
      startDate: new Date().toISOString().split('T')[0],
      category: 'Gastos Fixos'
    }
  });

  const isRecurringWatch = watch('isRecurring');

  const openNewModal = () => {
    setEditingId(null);
    reset({
      isRecurring: true,
      startDate: new Date().toISOString().split('T')[0],
      category: 'Gastos Fixos'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (expense: FixedExpense) => {
    setEditingId(expense.id!);
    reset({
      name: expense.name,
      amount: expense.amount.toString(),
      accountId: expense.accountId.toString(),
      category: expense.category,
      isRecurring: expense.isRecurring,
      startDate: expense.startDate,
      endDate: expense.endDate
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: FixedExpenseFormValues) => {
    const parsedAmount = parseFloat(data.amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Valor inválido");
      return;
    }

    const payload = {
      name: data.name,
      amount: parsedAmount,
      accountId: parseInt(data.accountId, 10),
      category: data.category,
      isRecurring: data.isRecurring,
      startDate: data.startDate,
      endDate: data.isRecurring ? undefined : data.endDate
    };

    if (editingId) {
      await db.fixedExpenses.update(editingId, { ...payload, lastProcessedMonth: undefined });
    } else {
      await db.fixedExpenses.add({
        ...payload,
      });
    }

    // Processa imediatamente para refletir na aba Transações e no Dashboard
    await processFixedExpenses();

    setIsModalOpen(false);
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (window.confirm('Tem certeza que deseja apagar esta despesa fixa?')) {
      await db.fixedExpenses.delete(id);
    }
  };

  const accountOptions = accounts.map(acc => ({
    value: acc.id!.toString(),
    label: `${acc.name} (${acc.currency})`
  }));

  const activeExpenses = fixedExpenses.filter(e => {
    if (e.isRecurring) return true;
    if (!e.endDate) return true;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const endMonth = e.endDate.slice(0, 7);
    return endMonth >= currentMonth;
  });

  const expiredExpenses = fixedExpenses.filter(e => {
    if (e.isRecurring || !e.endDate) return false;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const endMonth = e.endDate.slice(0, 7);
    return endMonth < currentMonth;
  });

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-7 h-7 text-rose-500" />
            Gastos Fixos & Recorrentes
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Gerencie suas contas mensais, assinaturas e dívidas recorrentes.
          </p>
        </div>
        <Button onClick={openNewModal} variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
          Nova Despesa Fixa
        </Button>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Despesas Ativas ({activeExpenses.length})
        </h3>
        {activeExpenses.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">Nenhuma despesa fixa ativa.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeExpenses.map(expense => {
              const acc = accounts.find(a => a.id === expense.accountId);
              return (
                <Card key={expense.id} hoverEffect className="p-4 border-t-4 border-t-rose-500 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-gray-900 dark:text-white line-clamp-1">{expense.name}</h4>
                      {expense.isRecurring ? (
                        <Badge variant="info" className="flex items-center gap-1"><Repeat className="w-3 h-3"/> Recorrente</Badge>
                      ) : (
                        <Badge variant="warning">Parcelada</Badge>
                      )}
                    </div>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 font-mono mb-2">
                      {formatCurrency(expense.amount, acc?.currency || 'BRL', privacyMode)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Conta: <strong className="text-gray-700 dark:text-gray-300">{acc?.name || 'Desconhecida'}</strong></p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Categoria: {expense.category}</p>
                    {!expense.isRecurring && expense.endDate && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Fim: {expense.endDate.split('-').reverse().join('/')}</p>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEditModal(expense)}>
                      <Edit2 className="w-4 h-4 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20" onClick={() => handleDelete(expense.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      {expiredExpenses.length > 0 && (
        <Card className="p-6 opacity-75">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CalendarX2 className="w-5 h-5" /> Despesas Concluídas / Expiradas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expiredExpenses.map(expense => {
              const acc = accounts.find(a => a.id === expense.accountId);
              return (
                <div key={expense.id} className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-gray-500 dark:text-gray-400 line-clamp-1 line-through">{expense.name}</h4>
                    <Button size="sm" variant="ghost" className="p-1 h-auto text-rose-500" onClick={() => handleDelete(expense.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-lg font-bold text-gray-500 dark:text-gray-400 font-mono line-through">
                    {formatCurrency(expense.amount, acc?.currency || 'BRL', privacyMode)}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-2">Data final: {expense.endDate?.split('-').reverse().join('/')}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Despesa" : "Nova Despesa Fixa"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Nome da Despesa" placeholder="Ex: Aluguel, Internet..." {...register('name')} error={errors.name?.message} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valor" type="number" step="any" placeholder="Ex: 1500.00" {...register('amount')} error={errors.amount?.message} />
            <Input label="Categoria" placeholder="Ex: Moradia" {...register('category')} error={errors.category?.message} />
          </div>
          <Select label="Conta para Débito Mensal" options={accountOptions} {...register('accountId')} error={errors.accountId?.message} />
          
          <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <input type="checkbox" id="isRecurring" {...register('isRecurring')} className="w-4 h-4 text-brand-primary rounded border-gray-300 focus:ring-brand-primary" />
            <label htmlFor="isRecurring" className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Despesa Recorrente (Sem prazo de término)
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Data Inicial (Mês Ref.)" type="date" {...register('startDate')} error={errors.startDate?.message} />
            {!isRecurringWatch && (
              <Input label="Data Final" type="date" {...register('endDate')} error={errors.endDate?.message} />
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>Salvar Despesa</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
