import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db';
import { useAppStore } from '@/store/useAppStore';
import type { Transaction, TransactionType } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatters';
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
  category: z.string().min(2, 'Informe ou selecione a categoria'),
  description: z.string().min(3, 'A descrição deve ter ao menos 3 letras'),
  date: z.string().min(1, 'Informe a data')
});

type TxFormValues = z.infer<typeof transactionSchema>;

export const TransactionsView: React.FC = () => {
  const { privacyMode } = useAppStore();
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray()) || [];

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<TxFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'expense',
      accountId: '',
      destinationAccountId: '',
      amount: '',
      category: 'Mercado',
      description: '',
      date: new Date().toISOString().split('T')[0]
    }
  });

  const selectedType = useWatch({ control, name: 'type' });

  const onSubmit = async (data: TxFormValues) => {
    const accId = parseInt(data.accountId, 10);
    const amountNum = parseFloat(data.amount.replace(',', '.'));
    if (isNaN(amountNum) || isNaN(accId)) return;

    const destAccId = data.destinationAccountId ? parseInt(data.destinationAccountId, 10) : undefined;

    // 1. Criar transação
    await db.transactions.add({
      type: data.type as TransactionType,
      accountId: accId,
      destinationAccountId: destAccId,
      amount: amountNum,
      destinationAmount: destAccId ? amountNum : undefined, // Simplificado 1:1 na transferência nativa ou manual
      category: data.category,
      description: data.description,
      date: data.date
    });

    // 2. Atualizar saldo da conta origem e destino para simular contabilidade real
    await db.transaction('rw', db.accounts, async () => {
      const orig = await db.accounts.get(accId);
      if (orig) {
        if (data.type === 'income') {
          await db.accounts.update(accId, { initialBalance: orig.initialBalance + amountNum });
        } else if (data.type === 'expense' || data.type === 'transfer') {
          await db.accounts.update(accId, { initialBalance: Math.max(0, orig.initialBalance - amountNum) });
        }
      }
      if (data.type === 'transfer' && destAccId) {
        const dest = await db.accounts.get(destAccId);
        if (dest) {
          await db.accounts.update(destAccId, { initialBalance: dest.initialBalance + amountNum });
        }
      }
    });

    reset();
    setIsModalOpen(false);
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (window.confirm('Tem certeza que deseja apagar esta transação do histórico no IndexedDB?')) {
      await db.transactions.delete(id);
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
              label="Valor"
              placeholder="Ex: 150.00"
              type="number"
              step="any"
              {...register('amount')}
              error={errors.amount?.message}
            />
            <Input
              label="Data"
              type="date"
              {...register('date')}
              error={errors.date?.message}
            />
          </div>

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
