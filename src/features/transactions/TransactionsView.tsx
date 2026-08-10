import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db';
import { useAppStore } from '@/store/useAppStore';
import type { Transaction, TransactionType } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { convertCurrency } from '@/services/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  flexRender,
  type SortingState
} from '@tanstack/react-table';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeftRight, Plus, Search, Trash2, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, ArrowUpDown, Download } from 'lucide-react';

const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  accountId: z.string().min(1, 'Selecione uma conta de origem'),
  destinationAccountId: z.string().optional(),
  amount: z.string().min(1, 'Informe um valor'),
  destinationAmount: z.string().optional(),
  category: z.string().min(2, 'Informe ou selecione a categoria'),
  description: z.string().min(3, 'A descrição deve ter ao menos 3 letras'),
  date: z.string().min(1, 'Informe a data')
});

type TxFormValues = z.infer<typeof transactionSchema>;

export const TransactionsView: React.FC = () => {
  const { privacyMode, quotes } = useAppStore();
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray()) || [];

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { register, handleSubmit, reset, control, setValue, formState: { errors, isSubmitting } } = useForm<TxFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'expense',
      accountId: '',
      destinationAccountId: '',
      amount: '',
      destinationAmount: '',
      category: 'Mercado',
      description: '',
      date: new Date().toISOString().split('T')[0]
    }
  });

  const selectedType = useWatch({ control, name: 'type' });
  const selectedAccountId = useWatch({ control, name: 'accountId' });
  const selectedDestId = useWatch({ control, name: 'destinationAccountId' });
  const enteredAmount = useWatch({ control, name: 'amount' });

  const sourceAccount = accounts.find(a => a.id === parseInt(selectedAccountId || '0'));
  const destAccount = accounts.find(a => a.id === parseInt(selectedDestId || '0'));

  const needsConversion = selectedType === 'transfer' && sourceAccount && destAccount && sourceAccount.currency !== destAccount.currency;

  const onSubmit = async (data: TxFormValues) => {
    const accId = parseInt(data.accountId, 10);
    const amountNum = parseFloat(data.amount.replace(',', '.'));
    if (isNaN(amountNum) || isNaN(accId)) return;

    const destAccId = data.destinationAccountId ? parseInt(data.destinationAccountId, 10) : undefined;

    // Checagem prévia de impacto nas caixinhas (Goals)
    const orig = await db.accounts.get(accId);
    if (!orig) return;

    let shortfall = 0;
    const allGoals = await db.goals.toArray();
    const accountGoals = allGoals.filter(g => 
      (g.allocations && g.allocations.some(a => a.accountId === accId)) || 
      (!g.allocations && g.accountId === accId)
    );

    if (data.type === 'expense' || data.type === 'transfer') {
      const totalGoalsAmount = accountGoals.reduce((sum, g) => {
        if (g.allocations) {
           const alloc = g.allocations.find(a => a.accountId === accId);
           return sum + (alloc ? alloc.amount : 0);
        }
        return sum + g.currentAmount;
      }, 0);

      // 2. Simulador de impacto no saldo origem (permitir saldo negativo)
      const newBalance = orig.initialBalance - amountNum;

      if (newBalance < totalGoalsAmount) {
        shortfall = totalGoalsAmount - newBalance;
        const msg = `ATENÇÃO: O saldo final da conta (${formatCurrency(newBalance, orig.currency, false)}) ficará menor que o total reservado em suas caixinhas vinculadas (${formatCurrency(totalGoalsAmount, orig.currency, false)}).\n\nIsso deduzirá automaticamente ${formatCurrency(shortfall, orig.currency, false)} das suas caixinhas para cobrir o déficit.\n\nDeseja continuar?`;
        if (!window.confirm(msg)) {
          return;
        }
      }
    }

    // Processamento atômico das tabelas envolvidas
    await db.transaction('rw', [db.accounts, db.transactions, db.goals], async () => {
      // 1. Criar transação no histórico
      const destAmountParsed = data.destinationAmount ? parseFloat(data.destinationAmount.replace(',', '.')) : amountNum;
      
      await db.transactions.add({
        type: data.type as TransactionType,
        accountId: accId,
        destinationAccountId: destAccId,
        amount: amountNum,
        destinationAmount: destAccId ? destAmountParsed : undefined,
        category: data.category,
        description: data.description,
        date: data.date
      });

      // 2. Atualizar saldo da conta origem
      if (data.type === 'income') {
        await db.accounts.update(accId, { initialBalance: orig.initialBalance + amountNum });
      } else if (data.type === 'expense' || data.type === 'transfer') {
        await db.accounts.update(accId, { initialBalance: orig.initialBalance - amountNum });
        
        // 3. Deduzir o déficit das caixinhas de forma sequencial (focado na alocação da conta)
        if (shortfall > 0) {
          let remainingShortfall = shortfall;
          for (const goal of accountGoals) {
            if (remainingShortfall <= 0) break;
            
            if (goal.allocations) {
              const allocIndex = goal.allocations.findIndex(a => a.accountId === accId);
              if (allocIndex !== -1) {
                const alloc = goal.allocations[allocIndex];
                if (alloc.amount > 0) {
                  const deduction = Math.min(alloc.amount, remainingShortfall);
                  goal.allocations[allocIndex].amount -= deduction;
                  goal.currentAmount -= deduction;
                  await db.goals.update(goal.id!, { 
                    allocations: goal.allocations, 
                    currentAmount: goal.currentAmount 
                  });
                  remainingShortfall -= deduction;
                }
              }
            } else if (goal.currentAmount > 0) {
              // Legado
              const deduction = Math.min(goal.currentAmount, remainingShortfall);
              await db.goals.update(goal.id!, { currentAmount: goal.currentAmount - deduction });
              remainingShortfall -= deduction;
            }
          }
        }
      }

      // 4. Atualizar saldo da conta de destino (se houver)
      if (data.type === 'transfer' && destAccId) {
        const dest = await db.accounts.get(destAccId);
        if (dest) {
          const destAmountParsed = data.destinationAmount ? parseFloat(data.destinationAmount.replace(',', '.')) : amountNum;
          await db.accounts.update(destAccId, { initialBalance: dest.initialBalance + destAmountParsed });
        }
      }
    });

    reset();
    setIsModalOpen(false);
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (window.confirm('Tem certeza que deseja apagar esta transação do histórico no IndexedDB?')) {
      const tx = await db.transactions.get(id);
      if (tx) {
        await db.transaction('rw', [db.accounts, db.transactions], async () => {
          await db.transactions.delete(id);
          
          // Estorno do saldo na conta de origem
          const acc = await db.accounts.get(tx.accountId);
          if (acc) {
            let newBalance = acc.initialBalance;
            if (tx.type === 'income') {
              newBalance = acc.initialBalance - tx.amount;
            } else if (tx.type === 'expense' || tx.type === 'transfer') {
              newBalance = acc.initialBalance + tx.amount;
            }
            await db.accounts.update(tx.accountId, { initialBalance: newBalance });
          }

          // Estorno do saldo na conta de destino (se for transferência)
          if (tx.type === 'transfer' && tx.destinationAccountId) {
            const destAcc = await db.accounts.get(tx.destinationAccountId);
            if (destAcc) {
              const amountToRevert = tx.destinationAmount || tx.amount;
              await db.accounts.update(tx.destinationAccountId, { 
                initialBalance: destAcc.initialBalance - amountToRevert 
              });
            }
          }
        });
      }
    }
  };

  const exportToCSV = () => {
    if (transactions.length === 0) {
      alert('Não há registros para exportar.');
      return;
    }
    
    const headers = ['Data', 'Tipo', 'Categoria', 'Conta_Origem', 'Conta_Destino', 'Descricao', 'Valor'];
    
    const rows = transactions.map(tx => {
      const acc = accounts.find(a => a.id === tx.accountId);
      const destAcc = tx.destinationAccountId ? accounts.find(a => a.id === tx.destinationAccountId) : null;
      
      const tipoStr = tx.type === 'income' ? 'Entrada' : tx.type === 'expense' ? 'Saida' : 'Transferencia';
      const valorStr = tx.amount.toFixed(2);
      
      return [
        tx.date,
        tipoStr,
        `"${tx.category}"`,
        `"${acc ? acc.name : ''}"`,
        `"${destAcc ? destAcc.name : ''}"`,
        `"${tx.description}"`,
        valorStr
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `midas_relatorio_transacoes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = useMemo<ColumnDef<Transaction, any>[]>(() => [
    {
      accessorKey: 'date',
      header: ({ column }: any) => (
        <button
          className="flex items-center gap-1 font-semibold text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Data <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ getValue }: any) => <span className="text-xs text-gray-400 font-medium">{formatDate(getValue() as string)}</span>,
    },
    {
      accessorKey: 'type',
      header: 'Tipo',
      cell: ({ getValue }: any) => {
        const t = getValue() as TransactionType;
        if (t === 'income') return <Badge variant="success" className="flex gap-1 items-center"><ArrowUpRight className="w-3 h-3" /> Entrada</Badge>;
        if (t === 'transfer') return <Badge variant="info">Transferência</Badge>;
        return <Badge variant="danger" className="flex gap-1 items-center"><ArrowDownRight className="w-3 h-3" /> Saída</Badge>;
      }
    },
    {
      accessorKey: 'description',
      header: 'Descrição & Conta',
      cell: ({ row }: any) => {
        const tx = row.original;
        const acc = accounts.find(a => a.id === tx.accountId);
        const destAcc = tx.destinationAccountId ? accounts.find(a => a.id === tx.destinationAccountId) : undefined;
        return (
          <div>
            <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">{tx.description}</p>
            <p className="text-xs text-gray-400">
              {acc ? acc.name : 'Conta excluída'}
              {destAcc && <span className="text-blue-500 font-semibold"> ➔ {destAcc.name}</span>}
            </p>
          </div>
        );
      }
    },
    {
      accessorKey: 'category',
      header: 'Categoria',
      cell: ({ getValue }: any) => <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-gray-700">{getValue() as string}</span>,
    },
    {
      accessorKey: 'amount',
      header: ({ column }: any) => (
        <div className="text-right">
          <button
            className="inline-flex items-center gap-1 font-semibold text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Valor <ArrowUpDown className="w-3 h-3" />
          </button>
        </div>
      ),
      cell: ({ row }: any) => {
        const tx = row.original;
        const acc = accounts.find(a => a.id === tx.accountId);
        const curr = acc ? acc.currency : 'BRL';
        const isInc = tx.type === 'income';
        const isTrans = tx.type === 'transfer';

        return (
          <div className="text-right font-extrabold font-mono text-sm">
            <span className={isInc ? 'text-emerald-500' : isTrans ? 'text-blue-500' : 'text-gray-900 dark:text-gray-100'}>
              {isInc ? '+ ' : isTrans ? '≈ ' : '- '}{formatCurrency(tx.amount, curr, privacyMode)}
            </span>
          </div>
        );
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => (
        <div className="text-right">
          <button
            onClick={() => handleDelete(row.original.id)}
            className="p-1 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
            title="Excluir Lançamento"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ], [accounts, privacyMode]);

  const table = useReactTable({
    data: transactions,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize: 8 }
    }
  });

  const accountOptions = accounts.map(a => ({
    value: a.id ? a.id.toString() : '',
    label: `${a.name} (${a.currency})`
  }));

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="w-7 h-7 text-blue-500" />
            Registros, Entradas & Lançamentos
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Histórico completo de fluxo de caixa operado com paginação e filtros dinâmicos via TanStack Table.
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={exportToCSV} 
            variant="outline" 
            leftIcon={<Download className="w-4 h-4" />}
          >
            Relatório CSV
          </Button>
          <Button 
            onClick={() => {
              if (accounts.length === 0) {
                alert('Cadastre pelo menos uma conta ou carteira para realizar transações!');
                return;
              }
              setIsModalOpen(true);
            }} 
            variant="primary" 
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Novo Lançamento
          </Button>
        </div>
      </div>

      {/* TanStack Table Container */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Buscar por descrição ou categoria..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="text-xs text-gray-500 font-medium">
            Mostrando <strong>{table.getRowModel().rows.length}</strong> de <strong>{transactions.length}</strong> registros
          </div>
        </div>

        <div className="overflow-x-auto min-h-[360px]">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup: any) => (
                <tr key={headerGroup.id} className="border-b border-gray-200/80 dark:border-gray-800 text-gray-500 text-xs">
                  {headerGroup.headers.map((header: any) => (
                    <th key={header.id} className="pb-3 pr-4 font-semibold uppercase tracking-wider">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/50">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center text-gray-500">
                    Nenhum registro encontrado correspondente ao filtro.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row: any) => (
                  <tr key={row.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors">
                    {row.getVisibleCells().map((cell: any) => (
                      <td key={cell.id} className="py-3.5 pr-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Controles de Paginação TanStack Table */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-200/60 dark:border-gray-800 text-xs">
          <div className="text-gray-500">
            Página <span className="font-bold text-gray-900 dark:text-white">{table.getState().pagination.pageIndex + 1}</span> de{' '}
            <span className="font-bold text-gray-900 dark:text-white">{table.getPageCount() || 1}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Próxima
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal de Cadastro de Lançamento */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Registrar Novo Lançamento Contábil"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tipo de Lançamento"
              {...register('type')}
              error={errors.type?.message}
              options={[
                { value: 'expense', label: '🔴 Saída (Despesa)' },
                { value: 'income', label: '🟢 Entrada (Receita)' },
                { value: 'transfer', label: '🔵 Transferência Entre Contas' },
              ]}
            />
            <Select
              label="Conta de Origem"
              {...register('accountId')}
              error={errors.accountId?.message}
              options={[
                { value: '', label: '-- Selecione a conta --' },
                ...accountOptions
              ]}
            />
          </div>

          {selectedType === 'transfer' && (
            <Select
              label="Conta de Destino (Transferência)"
              {...register('destinationAccountId')}
              error={errors.destinationAccountId?.message}
              options={[
                { value: '', label: '-- Selecione a conta de destino --' },
                ...accountOptions
              ]}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={needsConversion ? `Valor (em ${sourceAccount?.currency})` : "Valor"}
              placeholder="Ex: 150.00"
              type="number"
              step="any"
              {...register('amount')}
              error={errors.amount?.message}
            />
            {needsConversion ? (
              <Input
                label={`Valor Recebido (em ${destAccount?.currency})`}
                placeholder="Valor após conversão/taxas"
                type="number"
                step="any"
                {...register('destinationAmount')}
                error={errors.destinationAmount?.message}
                rightIcon={
                  <button 
                    type="button"
                    title="Calcular cotação atual"
                    className="p-1 hover:bg-gray-100 rounded text-brand-primary"
                    onClick={() => {
                      if (!enteredAmount || isNaN(Number(enteredAmount))) return;
                      const converted = convertCurrency(Number(enteredAmount), sourceAccount.currency, destAccount.currency, quotes);
                      setValue('destinationAmount', converted.toFixed(6).replace(/\.?0+$/, ''));
                    }}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                }
              />
            ) : (
              <Input
                label="Data"
                type="date"
                {...register('date')}
                error={errors.date?.message}
              />
            )}
          </div>
          
          {needsConversion && (
            <div className="grid grid-cols-1">
              <Input
                label="Data"
                type="date"
                {...register('date')}
                error={errors.date?.message}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Descrição do Lançamento"
              placeholder="Ex: Pagamento de Energia ou Depósito Cripto"
              {...register('description')}
              error={errors.description?.message}
            />
            <Select
              label="Categoria"
              {...register('category')}
              error={errors.category?.message}
              options={[
                { value: 'Salário', label: 'Salário' },
                { value: 'Freelances', label: 'Freelances' },
                { value: 'Vendas', label: 'Vendas' },
                { value: 'Mercado', label: 'Mercado' },
                { value: 'Delivery', label: 'Delivery' },
                { value: 'Casa & Reforma', label: 'Casa & Reforma' },
                { value: 'Aluguéis', label: 'Aluguéis' },
                { value: 'Transporte e Veículos', label: 'Transporte e Veículos' },
                { value: 'Saúde e Bem estar', label: 'Saúde e Bem estar' },
                { value: 'Pet', label: 'Pet' },
                { value: 'Tecnologia', label: 'Tecnologia' },
                { value: 'Lazer', label: 'Lazer' },
                { value: 'Impostos & Multas', label: 'Impostos & Multas' },
                { value: 'Investimentos', label: 'Investimentos' },
                { value: 'Saque de Investimento', label: 'Saque de Investimento' },
                { value: 'Rendimentos DeFi', label: 'Rendimentos DeFi' },
                { value: 'Saque DeFi', label: 'Saque DeFi' },
              ]}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-gray-200 dark:border-gray-800">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Registrar no IndexedDB
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
