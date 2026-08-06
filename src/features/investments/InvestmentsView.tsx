import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db';
import { useAppStore } from '@/store/useAppStore';
import type { InvestmentType, Currency } from '@/types';
import { convertCurrency } from '@/services/api';
import { formatCurrency, formatPercentage } from '@/utils/formatters';
import { calculateImpermanentLoss } from '@/utils/calculators';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { TrendingUp, Coins, Flame, Plus, Trash2, ArrowUpRight, ArrowDownRight, Award, Zap, Calculator, Edit2, RefreshCw } from 'lucide-react';

const investmentSchema = z.object({
  name: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  ticker: z.string().min(1, 'Informe o Ticker / Código (ex: PETR4, SOL)'),
  type: z.enum(['acao', 'renda_fixa', 'fundo', 'cripto_ativo']),
  quantity: z.string().min(1, 'Informe a quantidade de cotas/tokens'),
  purchasePrice: z.string().min(1, 'Informe o preço médio de compra'),
  currentPrice: z.string().min(1, 'Informe o preço atual'),
  currency: z.enum(['BRL', 'USD', 'USDC', 'EUR', 'BTC', 'ETH', 'SOL']),
  yieldPercentage: z.string().optional()
});

const defiPoolSchema = z.object({
  protocol: z.string().min(2, 'Informe o protocolo (ex: Uniswap, Aave)'),
  pair: z.string().min(2, 'Informe o par (ex: USDC-ETH)'),
  stakedTotalValueUSD: z.string().min(1, 'Informe o TVL em USD'),
  apr: z.string().min(1, 'Informe o APR estimado'),
  rewardToken: z.string().min(1, 'Informe o token de recompensa')
});

type InvFormValues = z.infer<typeof investmentSchema>;
type PoolFormValues = z.infer<typeof defiPoolSchema>;

export const InvestmentsView: React.FC = () => {
  const { baseCurrency, quotes, privacyMode } = useAppStore();
  const investments = useLiveQuery(() => db.investments.toArray()) || [];
  const defiPools = useLiveQuery(() => db.defiPools.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

  const [subTab, setSubTab] = useState<'tradicional' | 'defi' | 'simulator'>('defi');
  const [isModalInvOpen, setIsModalInvOpen] = useState(false);
  const [isModalPoolOpen, setIsModalPoolOpen] = useState(false);

  // Modal de Aporte Rápido
  const [fastActionModalOpen, setFastActionModalOpen] = useState(false);
  const [fastActionTarget, setFastActionTarget] = useState<'tradicional' | 'defi'>('tradicional');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [fastActionAmount, setFastActionAmount] = useState('');
  const [fastActionPrice, setFastActionPrice] = useState('');

  // Modal de Atualização de Preço (Ativos Tradicionais)
  const [updatePriceModalOpen, setUpdatePriceModalOpen] = useState(false);
  const [newPriceAmount, setNewPriceAmount] = useState('');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);

  // Modal de Colheita (Harvest)
  const [harvestModalOpen, setHarvestModalOpen] = useState(false);
  const [harvestAmount, setHarvestAmount] = useState('');
  const [harvestAccountId, setHarvestAccountId] = useState<number | ''>('');
  // Modal de Proventos/Dividendos (Ativos Tradicionais)
  const [dividendModalOpen, setDividendModalOpen] = useState(false);
  const [dividendAmount, setDividendAmount] = useState('');
  const [dividendAccountId, setDividendAccountId] = useState<number | ''>('');

  // Estados do Simulador Interativo de Impermanent Loss (AMM x*y=k)
  const [simQtyA, setSimQtyA] = useState<number>(1.0); // 1 ETH
  const [simQtyB, setSimQtyB] = useState<number>(3000); // 3000 USDC
  const [simPriceInitialA, setSimPriceInitialA] = useState<number>(3000);
  const [simPriceInitialB, setSimPriceInitialB] = useState<number>(1.0);
  const [simPriceNewA, setSimPriceNewA] = useState<number>(4500); // +50% no ETH
  const [simPriceNewB, setSimPriceNewB] = useState<number>(1.0);

  const ilResult = calculateImpermanentLoss(
    simQtyA, simQtyB,
    simPriceInitialA, simPriceInitialB,
    simPriceNewA, simPriceNewB
  );

  const { register: regInv, handleSubmit: handleSubInv, reset: resetInv, formState: { errors: errInv, isSubmitting: subInv } } = useForm<InvFormValues>({
    resolver: zodResolver(investmentSchema),
    defaultValues: {
      name: '',
      ticker: '',
      type: 'acao',
      quantity: '1',
      purchasePrice: '',
      currentPrice: '',
      currency: 'BRL',
      yieldPercentage: '10.5'
    }
  });

  const { register: regPool, handleSubmit: handleSubPool, reset: resetPool, formState: { errors: errPool, isSubmitting: subPool } } = useForm<PoolFormValues>({
    resolver: zodResolver(defiPoolSchema),
    defaultValues: { protocol: '', pair: '', stakedTotalValueUSD: '', apr: '', rewardToken: '' }
  });

  const onSubmitInv = async (data: InvFormValues) => {
    const qty = parseFloat(data.quantity.replace(',', '.'));
    const purch = parseFloat(data.purchasePrice.replace(',', '.'));
    const curr = parseFloat(data.currentPrice.replace(',', '.'));
    const yld = data.yieldPercentage ? parseFloat(data.yieldPercentage.replace(',', '.')) : 0;

    await db.investments.add({
      name: data.name,
      ticker: data.ticker.toUpperCase(),
      type: data.type as InvestmentType,
      quantity: isNaN(qty) ? 1 : qty,
      purchasePrice: isNaN(purch) ? 0 : purch,
      currentPrice: isNaN(curr) ? 0 : curr,
      currency: data.currency as Currency,
      yieldPercentage: isNaN(yld) ? 0 : yld,
    });

    const totalValue = (isNaN(qty) ? 1 : qty) * (isNaN(purch) ? 0 : purch);
    const totalValueBRL = convertCurrency(totalValue, data.currency as Currency, 'BRL', quotes);
    if (totalValueBRL > 0) {
      await db.transactions.add({
        type: 'income',
        accountId: 0,
        amount: totalValueBRL,
        category: 'Investimentos',
        description: `Aporte em ${data.name}`,
        date: new Date().toISOString().split('T')[0]
      });
    }

    resetInv();
    setIsModalInvOpen(false);
  };

  const onSubmitPool = async (data: PoolFormValues) => {
    const tvl = parseFloat(data.stakedTotalValueUSD.replace(',', '.'));
    const apr = parseFloat(data.apr.replace(',', '.'));
    
    await db.defiPools.add({
      protocol: data.protocol,
      pair: data.pair,
      tokenA: 'TKN-A',
      tokenB: 'TKN-B',
      tokenAQuantity: 0,
      tokenBQuantity: 0,
      tokenAPriceUSD: 1,
      tokenBPriceUSD: 1,
      apr: isNaN(apr) ? 0 : apr,
      stakedTotalValueUSD: isNaN(tvl) ? 0 : tvl,
      pendingRewardsUSD: 0,
      rewardToken: data.rewardToken,
      totalHarvestedUSD: 0
    });

    const tvlBRL = convertCurrency(isNaN(tvl) ? 0 : tvl, 'USD', 'BRL', quotes);
    if (tvlBRL > 0) {
      await db.transactions.add({
        type: 'income',
        accountId: 0,
        amount: tvlBRL,
        category: 'Investimentos',
        description: `Posição DeFi em ${data.protocol}`,
        date: new Date().toISOString().split('T')[0]
      });
    }

    resetPool();
    setIsModalPoolOpen(false);
  };

  const handleConfirmHarvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || harvestAccountId === '') {
      alert("Por favor, selecione uma conta de destino.");
      return;
    }
    
    const amount = parseFloat(harvestAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return;

    const pool = await db.defiPools.get(selectedItemId);
    const acc = await db.accounts.get(Number(harvestAccountId));
    if (!pool || !acc) return;

    // Convertendo o valor colhido de USD para a moeda da conta de destino
    const amountInAccCurrency = convertCurrency(amount, 'USD', acc.currency, quotes);

    // Atualiza a pool
    await db.defiPools.update(selectedItemId, { 
      pendingRewardsUSD: 0, // Zera as recompensas pendentes
      harvestCount: (pool.harvestCount || 0) + 1,
      totalHarvestedUSD: (pool.totalHarvestedUSD || 0) + amount
    });

    // Atualiza a conta de destino
    await db.accounts.update(acc.id!, { initialBalance: acc.initialBalance + amountInAccCurrency });

    // Registra a transação de fluxo de caixa
    await db.transactions.add({
      type: 'income',
      accountId: acc.id!,
      amount: amountInAccCurrency,
      category: 'Rendimentos DeFi',
      description: `Harvest de ${pool.protocol}`,
      date: new Date().toISOString().split('T')[0]
    });

    setHarvestModalOpen(false);
  };

  const handleConfirmDividend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || dividendAccountId === '') {
      alert("Por favor, selecione uma conta de destino.");
      return;
    }
    
    const amount = parseFloat(dividendAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return;

    const inv = await db.investments.get(selectedItemId);
    const acc = await db.accounts.get(Number(dividendAccountId));
    if (!inv || !acc) return;

    // Convertendo o valor colhido da moeda do ativo para a moeda da conta de destino
    const amountInAccCurrency = convertCurrency(amount, inv.currency, acc.currency, quotes);

    // Atualiza a conta de destino
    await db.accounts.update(acc.id!, { initialBalance: acc.initialBalance + amountInAccCurrency });

    // Registra a transação de fluxo de caixa
    await db.transactions.add({
      type: 'income',
      accountId: acc.id!,
      amount: amountInAccCurrency,
      category: 'Saque de Investimento',
      description: `Proventos/Dividendos de ${inv.ticker}`,
      date: new Date().toISOString().split('T')[0]
    });

    setDividendModalOpen(false);
  };

  const handleDeleteInv = async (id?: number) => {
    if (!id) return;
    if (window.confirm('Deseja excluir este ativo da sua carteira no IndexedDB?')) {
      await db.investments.delete(id);
    }
  };

  const handleDeletePool = async (id?: number) => {
    if (!id) return;
    if (window.confirm('Deseja encerrar esta posição DeFi e removê-la do IndexedDB?')) {
      await db.defiPools.delete(id);
    }
  };

  const handleFastAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) return;

    if (fastActionTarget === 'tradicional') {
      const addedQty = parseFloat(fastActionAmount.replace(',', '.'));
      const addedPrice = parseFloat(fastActionPrice.replace(',', '.'));
      if (isNaN(addedQty) || addedQty <= 0) return;

      const inv = await db.investments.get(selectedItemId);
      if (!inv) return;

      const purchasePrice = isNaN(addedPrice) ? inv.currentPrice : addedPrice;
      const newQty = inv.quantity + addedQty;
      const newAvgPrice = ((inv.quantity * inv.purchasePrice) + (addedQty * purchasePrice)) / newQty;

      await db.investments.update(selectedItemId, { 
        quantity: newQty,
        purchasePrice: newAvgPrice
      });
    } else {
      const addedUsd = parseFloat(fastActionAmount.replace(',', '.'));
      if (isNaN(addedUsd) || addedUsd <= 0) return;

      const pool = await db.defiPools.get(selectedItemId);
      if (!pool) return;

      await db.defiPools.update(selectedItemId, {
        stakedTotalValueUSD: pool.stakedTotalValueUSD + addedUsd
      });
    }

    setFastActionModalOpen(false);
  };

  const handleUpdatePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) return;
    
    const newPrice = parseFloat(newPriceAmount.replace(',', '.'));
    if (isNaN(newPrice) || newPrice < 0) return;

    await db.investments.update(selectedItemId, {
      currentPrice: newPrice
    });

    setUpdatePriceModalOpen(false);
  };

  const handleFetchOnlinePrice = async () => {
    if (!selectedItemId) return;
    const inv = await db.investments.get(selectedItemId);
    if (!inv || !inv.ticker) return;

    setIsFetchingPrice(true);
    try {
      // Tentativa de buscar na API pública Brapi.dev (B3)
      const res = await fetch(`https://brapi.dev/api/quote/${inv.ticker}`);
      if (!res.ok) throw new Error('API não retornou sucesso.');
      const data = await res.json();
      
      if (data.results && data.results.length > 0) {
        const price = data.results[0].regularMarketPrice;
        if (price) {
          setNewPriceAmount(price.toString());
          alert(`Preço atualizado online com sucesso para R$ ${price}! Clique em Confirmar para salvar.`);
        } else {
          throw new Error('Preço não encontrado no payload.');
        }
      } else {
        throw new Error('Ticker não encontrado na API.');
      }
    } catch (err) {
      alert(`Falha ao buscar cotação online para ${inv.ticker}. A API gratuita pode estar fora do ar ou o ticker não existe na bolsa brasileira (B3). Por favor, informe o valor manualmente.`);
    } finally {
      setIsFetchingPrice(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-purple-500" />
            Investimentos Tradicionais & DeFi Pro
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Gestão patrimonial unificada para Renda Fixa, Bolsa de Valores e Pools de Liquidez Algorítmicos.
          </p>
        </div>
        
        <div className="flex gap-2">
          {subTab === 'tradicional' && (
            <Button onClick={() => setIsModalInvOpen(true)} variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
              Novo Ativo Tradicional
            </Button>
          )}
          {subTab === 'defi' && (
            <Button onClick={() => setIsModalPoolOpen(true)} variant="gold" leftIcon={<Plus className="w-4 h-4" />}>
              Nova Posição DeFi Pool
            </Button>
          )}
        </div>
      </div>

      {/* Navegação entre Abas do Módulo */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-200 dark:border-dark-border">
        <button
          onClick={() => setSubTab('defi')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            subTab === 'defi'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
              : 'bg-white dark:bg-dark-card text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-dark-border'
          }`}
        >
          <Coins className="w-4 h-4 text-amber-400" />
          Pools DeFi & Liquidity ({defiPools.length})
        </button>

        <button
          onClick={() => setSubTab('tradicional')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            subTab === 'tradicional'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'bg-white dark:bg-dark-card text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-dark-border'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Ativos Tradicionais ({investments.length})
        </button>

        <button
          onClick={() => setSubTab('simulator')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
            subTab === 'simulator'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-gray-950 shadow-lg shadow-amber-500/30 font-extrabold'
              : 'bg-white dark:bg-dark-card text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-dark-border'
          }`}
        >
          <Calculator className="w-4 h-4 text-gray-950" />
          Laboratório: Simulador de Impermanent Loss
        </button>
      </div>

      {/* ABA 1: POOLS DEFI & LIQUIDITY */}
      {subTab === 'defi' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <Card className="bg-gradient-to-r from-purple-950/20 via-indigo-900/10 to-transparent border-purple-500/30 p-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-purple-400" /> Staking & Farming Pro
                </span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                  Posições Ativas em Automated Market Makers (AMM)
                </h3>
              </div>
              <Badge variant="gold" className="px-3 py-1 text-xs">APR Médio: 46.3%</Badge>
            </div>
          </Card>

          {defiPools.length === 0 ? (
            <Card className="text-center py-12 text-gray-500">Nenhuma posição DeFi no banco IndexedDB.</Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {defiPools.map((pool) => {
                const totalBase = convertCurrency(pool.stakedTotalValueUSD, 'USD', baseCurrency, quotes);
                const rewBase = convertCurrency(pool.pendingRewardsUSD, 'USD', baseCurrency, quotes);

                return (
                  <Card key={pool.id} hoverEffect className="relative overflow-hidden border-t-4 border-t-purple-500">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/30 font-bold text-purple-400 text-lg">
                          ⚖️
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-gray-900 dark:text-white">{pool.protocol}</h4>
                          <span className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                            Par: <strong className="text-purple-400">{pool.pair}</strong>
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-400">Taxa APR</span>
                        <p className="text-lg font-extrabold text-emerald-500 font-mono">{pool.apr.toFixed(1)}%</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 my-4 p-4 rounded-xl bg-gray-50/70 dark:bg-gray-900/60 border border-gray-200/50 dark:border-gray-800/60">
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-semibold">Valor em Staking</p>
                        <p className="text-xl font-extrabold text-gray-900 dark:text-white font-mono mt-0.5">
                          {formatCurrency(pool.stakedTotalValueUSD, 'USD', privacyMode)}
                        </p>
                        <p className="text-[11px] text-purple-400 font-medium mt-0.5">
                          ≈ {formatCurrency(totalBase, baseCurrency, privacyMode)}
                        </p>
                      </div>

                      <div className="border-l border-gray-200 dark:border-gray-800 pl-3">
                        <p className="text-[11px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                          <Award className="w-3 h-3 text-amber-400" /> Recompensas
                        </p>
                        <p className="text-xl font-extrabold text-emerald-500 font-mono mt-0.5">
                          + {formatCurrency(pool.pendingRewardsUSD, 'USD', privacyMode)}
                        </p>
                        <span className="text-[10px] text-gray-400">Token: {pool.rewardToken}</span>
                        {(pool.harvestCount || 0) > 0 && (
                          <p className="text-[10px] text-amber-500 font-bold mt-1">
                            Coletas: {pool.harvestCount} (Total: {formatCurrency(pool.totalHarvestedUSD || 0, 'USD', privacyMode)})
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-3 mt-3 border-t border-gray-200/40 dark:border-gray-800/50">
                      <button
                        onClick={() => handleDeletePool(pool.id)}
                        className="p-2 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
                        title="Encerrar Posição e Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs font-bold border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                        onClick={() => {
                          setSelectedItemId(pool.id!);
                          setFastActionTarget('defi');
                          setFastActionAmount('');
                          setFastActionModalOpen(true);
                        }}
                        leftIcon={<Plus className="w-4 h-4" />}
                      >
                        Aportar
                      </Button>
                      <Button
                        size="sm"
                        variant="gold"
                        className="w-full text-xs font-bold"
                        onClick={() => {
                          setSelectedItemId(pool.id!);
                          setHarvestAmount('');
                          setHarvestAccountId('');
                          setHarvestModalOpen(true);
                        }}
                        leftIcon={<Zap className="w-4 h-4 text-gray-950" />}
                      >
                        Colher Recompensas
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ABA 2: ATIVOS TRADICIONAIS */}
      {subTab === 'tradicional' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Carteira de Ativos (Bolsa & Renda Fixa)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200/80 dark:border-gray-800 text-gray-400 font-semibold text-xs uppercase">
                    <th className="pb-3">Ticker / Ativo</th>
                    <th className="pb-3">Tipo</th>
                    <th className="pb-3 text-right">Qtd</th>
                    <th className="pb-3 text-right">Preço Médio</th>
                    <th className="pb-3 text-right">Preço Atual</th>
                    <th className="pb-3 text-right">Yield (Est.)</th>
                    <th className="pb-3 text-right">Valor Total</th>
                    <th className="pb-3 text-right">Lucro/Perda</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/50">
                  {investments.map((inv) => {
                    const totalVal = inv.quantity * inv.currentPrice;
                    const totalPurch = inv.quantity * inv.purchasePrice;
                    const gainDollar = totalVal - totalPurch;
                    const gainPct = totalPurch > 0 ? (gainDollar / totalPurch) * 100 : 0;
                    const isPositive = gainPct >= 0;

                    return (
                      <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="py-3.5 pr-4 font-bold text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 font-mono text-xs text-blue-500">
                              {inv.ticker}
                            </span>
                            <span>{inv.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 pr-4">
                          <Badge variant={inv.type === 'acao' ? 'info' : inv.type === 'renda_fixa' ? 'success' : inv.type === 'fundo' ? 'warning' : 'purple'}>
                            {inv.type === 'acao' ? 'Ações' : inv.type === 'renda_fixa' ? 'Renda Fixa' : inv.type === 'fundo' ? 'Fundo/ETF' : 'Cripto Hold'}
                          </Badge>
                        </td>
                        <td className="py-3.5 text-right font-mono text-gray-700 dark:text-gray-300">{inv.quantity}</td>
                        <td className="py-3.5 text-right font-mono text-gray-400">{formatCurrency(inv.purchasePrice, inv.currency, privacyMode)}</td>
                        <td className="py-3.5 text-right font-mono font-bold text-gray-900 dark:text-gray-100">{formatCurrency(inv.currentPrice, inv.currency, privacyMode)}</td>
                        <td className="py-3.5 text-right text-xs font-semibold text-emerald-500">{inv.yieldPercentage ? `${inv.yieldPercentage}% a.a.` : '-'}</td>
                        <td className="py-3.5 text-right font-extrabold font-mono text-blue-600 dark:text-blue-400">{formatCurrency(totalVal, inv.currency, privacyMode)}</td>
                        <td className="py-3.5 text-right font-bold text-xs">
                          <span className={`inline-flex items-center ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                            {formatPercentage(gainPct)}
                          </span>
                        </td>
                        <td className="py-3.5 text-right whitespace-nowrap">
                          <button 
                            onClick={() => {
                              setSelectedItemId(inv.id!);
                              setNewPriceAmount(inv.currentPrice.toString());
                              setUpdatePriceModalOpen(true);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-500 mr-1"
                            title="Atualizar Preço Atual da Cota"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedItemId(inv.id!);
                              setFastActionTarget('tradicional');
                              setFastActionAmount('');
                              setFastActionPrice(inv.currentPrice.toString());
                              setFastActionModalOpen(true);
                            }}
                            className="p-1 text-gray-400 hover:text-emerald-500 mr-1"
                            title="Aportar mais saldo"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedItemId(inv.id!);
                              setDividendAmount('');
                              setDividendAccountId('');
                              setDividendModalOpen(true);
                            }}
                            className="p-1 text-gray-400 hover:text-amber-500 mr-1"
                            title="Receber Proventos / Dividendos"
                          >
                            <Award className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteInv(inv.id)} className="p-1 text-gray-400 hover:text-rose-500" title="Excluir Ativo">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ABA 3: SIMULADOR DE IMPERMANENT LOSS (LABORATÓRIO MATEMÁTICO) */}
      {subTab === 'simulator' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna 1: Controles de Simulação */}
            <Card className="lg:col-span-1 space-y-4 border-amber-500/30">
              <h3 className="text-base font-extrabold text-amber-500 flex items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-800">
                <Calculator className="w-5 h-5 text-amber-500" /> Parâmetros do Pool (AMM)
              </h3>
              
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase">1. Posição Inicial no Depósito</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Qtd Token A (ex: ETH)"
                    type="number"
                    step="any"
                    value={simQtyA}
                    onChange={(e) => setSimQtyA(parseFloat(e.target.value) || 0)}
                  />
                  <Input
                    label="Preço Inicial A ($)"
                    type="number"
                    step="any"
                    value={simPriceInitialA}
                    onChange={(e) => setSimPriceInitialA(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Qtd Token B (USDC/Stable)"
                    type="number"
                    step="any"
                    value={simQtyB}
                    onChange={(e) => setSimQtyB(parseFloat(e.target.value) || 0)}
                  />
                  <Input
                    label="Preço Inicial B ($)"
                    type="number"
                    step="any"
                    value={simPriceInitialB}
                    onChange={(e) => setSimPriceInitialB(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-200/60 dark:border-gray-800">
                <p className="text-xs font-semibold text-amber-500 uppercase">2. Projeção de Preço Futuro</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Novo Preço A ($)"
                    type="number"
                    step="any"
                    value={simPriceNewA}
                    onChange={(e) => setSimPriceNewA(parseFloat(e.target.value) || 0)}
                  />
                  <Input
                    label="Novo Preço B ($)"
                    type="number"
                    step="any"
                    value={simPriceNewB}
                    onChange={(e) => setSimPriceNewB(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Botões de Predefinições */}
              <div className="space-y-2 pt-3">
                <span className="text-[11px] text-gray-500 font-semibold">Cenários de Demonstração Rápida:</span>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setSimQtyA(1); setSimQtyB(3000);
                      setSimPriceInitialA(3000); setSimPriceInitialB(1);
                      setSimPriceNewA(4500); setSimPriceNewB(1); // +50% no Token A
                    }}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800/70 hover:bg-amber-500/10 text-xs font-medium text-left border border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    📈 <strong>Token A sobe +50%</strong> (IL ≈ 2.02%)
                  </button>
                  <button
                    onClick={() => {
                      setSimQtyA(10); setSimQtyB(1500);
                      setSimPriceInitialA(150); setSimPriceInitialB(1);
                      setSimPriceNewA(75); setSimPriceNewB(1); // -50% no Token A
                    }}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800/70 hover:bg-amber-500/10 text-xs font-medium text-left border border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    📉 <strong>Token A cai -50%</strong> (IL ≈ 5.72%)
                  </button>
                  <button
                    onClick={() => {
                      setSimQtyA(5000); setSimQtyB(5000);
                      setSimPriceInitialA(1); setSimPriceInitialB(1);
                      setSimPriceNewA(1); setSimPriceNewB(1); // Stable pool
                    }}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800/70 hover:bg-amber-500/10 text-xs font-medium text-left border border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    ⚖️ <strong>Pool de Stablecoins</strong> (IL = 0.00%)
                  </button>
                </div>
              </div>
            </Card>

            {/* Coluna 2 e 3: Resultados e Teoria Acadêmica */}
            <div className="lg:col-span-2 space-y-6">
              <Card glow className="bg-gradient-to-br from-indigo-950/30 via-gray-900/50 to-transparent border-blue-500/40 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200/60 dark:border-gray-800">
                  <div>
                    <span className="text-xs font-extrabold text-blue-400 uppercase tracking-wider">
                      Análise Comparativa de Desempenho
                    </span>
                    <h3 className="text-2xl font-extrabold text-white mt-1">
                      HODL Na Carteira vs. Liquidity Pool (AMM)
                    </h3>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-right">
                    <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Impermanent Loss</span>
                    <p className="text-3xl font-black text-rose-500 font-mono">
                      -{ilResult.impermanentLossPercentage.toFixed(2)}%
                    </p>
                    <span className="text-xs text-rose-300">(- ${ilResult.lossInUSD} USD)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
                  <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800">
                    <span className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5">
                      🪙 Valor HODL (Apenas Segurar)
                    </span>
                    <p className="text-3xl font-extrabold text-white font-mono mt-2">
                      $ {ilResult.hodlValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Se você guardasse {simQtyA} Token A + {simQtyB} Token B na carteira física ao novo preço do mercado.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30">
                    <span className="text-xs font-bold text-blue-400 uppercase flex items-center gap-1.5">
                      ⚖️ Valor Real no Pool (AMM X • Y = K)
                    </span>
                    <p className="text-3xl font-extrabold text-blue-300 font-mono mt-2">
                      $ {ilResult.poolValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-blue-300/80 mt-2">
                      Valor do pool após o rebalanceamento algorítmico do Automated Market Maker, <em>excluindo</em> rendimentos de taxas/APR.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Box de Rigor Acadêmico e Explicação da Fórmula */}
              <Card className="bg-gray-50 dark:bg-dark-card/90 border-gray-200 dark:border-dark-border p-6">
                <h4 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                  🎓 Fundamentação Matemática (Simulado Acadêmico)
                </h4>
                <div className="text-xs text-gray-600 dark:text-gray-300 space-y-2.5 leading-relaxed">
                  <p>
                    Em protocolos de finanças descentralizadas (DeFi) baseados em <strong>Automated Market Makers (AMMs)</strong> como Uniswap e Raydium, a liquidez é governada pela equação de produto constante:
                  </p>
                  <div className="p-3 rounded-lg bg-gray-200/60 dark:bg-gray-950 font-mono text-center text-sm font-bold text-purple-400 border border-gray-300 dark:border-gray-800">
                    {'X × Y = K   ➔   Impermanent Loss (IL) = [ 2 • √(P) / (1 + P) ] - 1'}
                  </div>
                  <p>
                    Onde <strong>P</strong> é a razão de preço relativa futura em relação à inicial ({'P = PreçoNovo / PreçoInicial'}). 
                    No cenário simulado acima, a razão P calculada é de <strong>{ilResult.priceRatioP}</strong>.
                  </p>
                  <p>
                    <strong>Por que a Perda é &quot;Impermanente&quot;?</strong> Se os preços retornarem exatamente à mesma razão de quando os tokens foram depositados ({'P = 1'}), a perda impermanente se torna 0%. Além disso, em pools com altas taxas e recompensas em staking (ex: APR de 40% a 80%), o lucro ganho em taxas frequentemente supera a perda impermanente em longos períodos.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro de Ativo Tradicional */}
      <Modal isOpen={isModalInvOpen} onClose={() => setIsModalInvOpen(false)} title="Cadastrar Ativo Tradicional (Bolsa / Renda Fixa)">
        <form onSubmit={handleSubInv(onSubmitInv)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Ticker (ex: PETR4, WEGE3)" placeholder="PETR4" {...regInv('ticker')} error={errInv.ticker?.message} />
            <Input label="Nome do Ativo" placeholder="Petrobras PN" {...regInv('name')} error={errInv.name?.message} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo do Ativo" {...regInv('type')} options={[
              { value: 'acao', label: 'Ações (Bolsa)' },
              { value: 'renda_fixa', label: 'Renda Fixa / Tesouro' },
              { value: 'fundo', label: 'Fundo Imobiliário / ETF' },
              { value: 'cripto_ativo', label: 'Cripto na Carteira (Hold)' },
            ]} />
            <Select label="Moeda" {...regInv('currency')} options={[
              { value: 'BRL', label: 'BRL - Real' },
              { value: 'USD', label: 'USD - Dólar' },
              { value: 'EUR', label: 'EUR - Euro' },
            ]} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Quantidade" type="number" step="any" placeholder="100" {...regInv('quantity')} error={errInv.quantity?.message} />
            <Input label="Preço Compra ($/R$)" type="number" step="any" placeholder="32.50" {...regInv('purchasePrice')} error={errInv.purchasePrice?.message} />
            <Input label="Preço Atual ($/R$)" type="number" step="any" placeholder="39.80" {...regInv('currentPrice')} error={errInv.currentPrice?.message} />
          </div>
          <Input label="Yield / Dividend Yield Estimado (%)" type="number" step="any" placeholder="Ex: 12.5" {...regInv('yieldPercentage')} />
          
          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-gray-200 dark:border-gray-800">
            <Button type="button" variant="outline" onClick={() => setIsModalInvOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" isLoading={subInv}>Salvar no IndexedDB</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Cadastro de DeFi Pool */}
      <Modal isOpen={isModalPoolOpen} onClose={() => setIsModalPoolOpen(false)} title="Registrar Nova Posição DeFi (Pool de Liquidez)">
        <form onSubmit={handleSubPool(onSubmitPool)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Protocolo (ex: Uniswap V3)" placeholder="Uniswap V3" {...regPool('protocol')} error={errPool.protocol?.message} />
            <Input label="Par (ex: USDC-ETH)" placeholder="USDC-ETH" {...regPool('pair')} error={errPool.pair?.message} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valor em Staking (USD)" type="number" step="any" placeholder="Ex: 5000.00" {...regPool('stakedTotalValueUSD')} error={errPool.stakedTotalValueUSD?.message} />
            <Input label="APR Estimado (%)" type="number" step="any" placeholder="Ex: 12.5" {...regPool('apr')} error={errPool.apr?.message} />
          </div>
          <Input label="Token de Recompensa (ex: AAVE, UNI)" placeholder="AAVE" {...regPool('rewardToken')} error={errPool.rewardToken?.message} />
          
          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-gray-200 dark:border-gray-800">
            <Button type="button" variant="outline" onClick={() => setIsModalPoolOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" isLoading={subPool}>Criar Posição</Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Colheita (Harvest) */}
      <Modal
        isOpen={harvestModalOpen}
        onClose={() => setHarvestModalOpen(false)}
        title="Colher Recompensas (Harvest)"
      >
        <form onSubmit={handleConfirmHarvest} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Valor Colhido (em USD)"
              placeholder="Ex: 50.00"
              type="number"
              step="any"
              value={harvestAmount}
              onChange={(e) => setHarvestAmount(e.target.value)}
              required
              autoFocus
            />
            <Select
              label="Conta de Destino"
              value={harvestAccountId}
              onChange={(e) => setHarvestAccountId(e.target.value ? Number(e.target.value) : '')}
              options={[
                { value: '', label: 'Selecione uma conta...' },
                ...accounts.map(a => ({ value: a.id!.toString(), label: `${a.name} (${a.currency})` }))
              ]}
              required
            />
          </div>
          <p className="text-xs text-gray-500">
            O valor será depositado na conta escolhida e registrado no fluxo de aportes do mês atual.
          </p>
          
          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-gray-200 dark:border-gray-800">
            <Button type="button" variant="outline" onClick={() => setHarvestModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="gold">
              Confirmar e Registrar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Aporte Rápido */}
      <Modal
        isOpen={fastActionModalOpen}
        onClose={() => setFastActionModalOpen(false)}
        title={fastActionTarget === 'tradicional' ? 'Novo Aporte no Ativo' : 'Aportar no Pool DeFi'}
      >
        <form onSubmit={handleFastAction} className="space-y-4">
          {fastActionTarget === 'tradicional' ? (
            <>
              <Input
                label="Quantidade de Cotas/Tokens a Adicionar"
                placeholder="Ex: 50"
                type="number"
                step="any"
                value={fastActionAmount}
                onChange={(e) => setFastActionAmount(e.target.value)}
                required
                autoFocus
              />
              <Input
                label="Preço de Compra ($/R$)"
                placeholder="Ex: 35.00"
                type="number"
                step="any"
                value={fastActionPrice}
                onChange={(e) => setFastActionPrice(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500">O preço médio do seu ativo será recalculado automaticamente com base neste novo aporte.</p>
            </>
          ) : (
            <>
              <Input
                label="Valor a Aportar (em USD)"
                placeholder="Ex: 1000.00"
                type="number"
                step="any"
                value={fastActionAmount}
                onChange={(e) => setFastActionAmount(e.target.value)}
                required
                autoFocus
              />
              <p className="text-xs text-gray-500">O valor em staking (TVL) deste Pool aumentará, resultando em maiores recompensas.</p>
            </>
          )}
          
          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-gray-200 dark:border-gray-800">
            <Button type="button" variant="outline" onClick={() => setFastActionModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Confirmar Aporte
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Atualização de Preço Manual / Automático */}
      <Modal
        isOpen={updatePriceModalOpen}
        onClose={() => setUpdatePriceModalOpen(false)}
        title="Atualizar Cotação Atual do Ativo"
      >
        <form onSubmit={handleUpdatePriceSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <Input
                label="Novo Preço Atual ($/R$)"
                placeholder="Ex: 42.50"
                type="number"
                step="any"
                value={newPriceAmount}
                onChange={(e) => setNewPriceAmount(e.target.value)}
                required
                autoFocus
              />
            </div>
            <Button 
              type="button" 
              variant="outline" 
              className="mb-1"
              leftIcon={<RefreshCw className={`w-4 h-4 ${isFetchingPrice ? 'animate-spin text-blue-500' : 'text-gray-500'}`} />}
              onClick={handleFetchOnlinePrice}
              disabled={isFetchingPrice}
            >
              {isFetchingPrice ? 'Buscando...' : 'Buscar Online'}
            </Button>
          </div>
          
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong>Dica:</strong> O botão "Buscar Online" tenta puxar o valor oficial da bolsa brasileira usando a API gratuita <em>Brapi.dev</em>. Caso a API falhe por limitação de acessos, digite o valor de fechamento manualmente.
          </p>
          
          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-gray-200 dark:border-gray-800">
            <Button type="button" variant="outline" onClick={() => setUpdatePriceModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              Confirmar Novo Preço
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Proventos / Dividendos */}
      <Modal isOpen={dividendModalOpen} onClose={() => setDividendModalOpen(false)} title="Receber Proventos ou Dividendos">
        <form onSubmit={handleConfirmDividend} className="space-y-4">
          <Input 
            label="Valor Recebido (Na moeda do Ativo)" 
            type="number" 
            step="any" 
            placeholder="Ex: 45.50"
            value={dividendAmount}
            onChange={(e) => setDividendAmount(e.target.value)}
            required
            autoFocus
          />
          <Select
            label="Conta de Destino"
            value={dividendAccountId}
            onChange={(e) => setDividendAccountId(e.target.value ? Number(e.target.value) : '')}
            required
            options={[
              { value: '', label: '-- Selecione onde depositar --' },
              ...accounts.map(a => ({ value: a.id!.toString(), label: `${a.name} (${a.currency})` }))
            ]}
          />
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong>Dica:</strong> O valor será convertido automaticamente para a moeda da conta de destino (se necessário) e será gerada uma transação de "Saque de Investimento" em sua aba de Registros.
          </p>
          <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-gray-200 dark:border-gray-800">
            <Button type="button" variant="outline" onClick={() => setDividendModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">Confirmar Recebimento</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
