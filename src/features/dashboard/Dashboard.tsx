import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/db';
import { useAppStore } from '@/store/useAppStore';
import { convertCurrency } from '@/services/api';
import { formatCurrency, formatPercentage, formatDate } from '@/utils/formatters';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, TrendingDown, Wallet, Coins, Vault, ArrowUpRight, ArrowDownRight, Sparkles, PieChart, BarChart3, Plus, ArrowRight, Activity } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { baseCurrency, quotes, quotesChange24h, privacyMode, theme, setActiveTab } = useAppStore();

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const investments = useLiveQuery(() => db.investments.toArray()) || [];
  const defiPools = useLiveQuery(() => db.defiPools.toArray()) || [];
  const recentTransactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().limit(5).toArray()) || [];
  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const goals = useLiveQuery(() => db.goals.toArray()) || [];

  // 1. Cálculos Patrimoniais Consolidados
  const { totalNetWorth, accountsTotal, investmentsTotal, defiTotal, goalsTotal, changeEst24h } = useMemo(() => {
    let accTotal = 0;
    accounts.forEach(acc => {
      accTotal += convertCurrency(acc.initialBalance, acc.currency, baseCurrency, quotes);
    });

    let invTotal = 0;
    investments.forEach(inv => {
      const val = inv.quantity * inv.currentPrice;
      invTotal += convertCurrency(val, inv.currency, baseCurrency, quotes);
    });

    let defiTot = 0;
    defiPools.forEach(pool => {
      // DeFi pools são valorizados primariamente em USD
      defiTot += convertCurrency(pool.stakedTotalValueUSD + pool.pendingRewardsUSD, 'USD', baseCurrency, quotes);
    });

    let goalsTot = 0;
    goals.forEach(goal => {
      goalsTot += convertCurrency(goal.currentAmount, goal.currency, baseCurrency, quotes);
    });

    const total = accTotal + invTotal + defiTot;

    // Estimativa de variação em 24h baseada nas cotações monitoradas
    const cryptoWeight = (defiTot + accTotal * 0.3) / (total || 1);
    const avgChange = (quotesChange24h.BTC || 0) * cryptoWeight + (quotesChange24h.USD || 0) * (1 - cryptoWeight);

    return {
      totalNetWorth: total,
      accountsTotal: accTotal,
      investmentsTotal: invTotal,
      defiTotal: defiTot,
      goalsTotal: goalsTot,
      changeEst24h: avgChange || 1.85,
    };
  }, [accounts, investments, defiPools, goals, baseCurrency, quotes, quotesChange24h]);

  // 2. Opções dos Gráficos Interativos ECharts (Alocação Patrimonial)
  const allocationChartOption = useMemo(() => {
    const isDark = theme === 'dark';
    const textColor = isDark ? '#E5E7EB' : '#1F2937';

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          return `${params.name}: <b>${formatCurrency(params.value, baseCurrency, false)}</b> (${params.percent}%)`;
        },
        backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
        borderColor: isDark ? '#374151' : '#E5E7EB',
        textStyle: { color: textColor }
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: { color: textColor, fontSize: 12 },
        icon: 'circle'
      },
      series: [
        {
          name: 'Patrimônio',
          type: 'pie',
          radius: ['55%', '82%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 8,
            borderColor: isDark ? '#121824' : '#FFFFFF',
            borderWidth: 2
          },
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              fill: textColor
            }
          },
          data: [
            { value: Number(Math.max(0, accountsTotal - goalsTotal).toFixed(2)), name: 'Contas & Liquida', itemStyle: { color: '#3B82F6' } },
            { value: Number(investmentsTotal.toFixed(2)), name: 'Ações & Renda Fixa', itemStyle: { color: '#10B981' } },
            { value: Number(defiTotal.toFixed(2)), name: 'DeFi & Pools Cripto', itemStyle: { color: '#8B5CF6' } },
            { value: Number(goalsTotal.toFixed(2)), name: 'Caixinhas (Reserva)', itemStyle: { color: '#F59E0B' } },
          ]
        }
      ]
    };
  }, [accountsTotal, investmentsTotal, defiTotal, goalsTotal, baseCurrency, theme]);

  // 3. Evolução Temporal e Fluxo de Caixa Simulado (Gráfico de Barras e Linha)
  const evolutionChartOption = useMemo(() => {
    const isDark = theme === 'dark';
    const textColor = isDark ? '#9CA3AF' : '#4B5563';
    const splitLineColor = isDark ? '#1F2937' : '#E5E7EB';

    const months: string[] = [];
    const monthlyNetFlow: number[] = [0, 0, 0, 0, 0, 0];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(monthNames[d.getMonth()]);
    }

    allTransactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const diffMonths = (now.getFullYear() - txDate.getFullYear()) * 12 + now.getMonth() - txDate.getMonth();
      if (diffMonths >= 0 && diffMonths <= 5) {
        const index = 5 - diffMonths;
        const acc = accounts.find(a => a.id === tx.accountId);
        const curr = acc ? acc.currency : 'BRL';
        const baseAmount = convertCurrency(tx.amount, curr, baseCurrency, quotes);
        
        if (tx.type === 'income') {
          monthlyNetFlow[index] += baseAmount;
        } else if (tx.type === 'expense') {
          monthlyNetFlow[index] -= baseAmount;
        }
      }
    });

    const growthData: number[] = new Array(6).fill(0);
    let currentWorthForCalc = totalNetWorth;
    
    for (let i = 5; i >= 0; i--) {
      growthData[i] = currentWorthForCalc;
      currentWorthForCalc -= monthlyNetFlow[i];
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
        borderColor: isDark ? '#374151' : '#E5E7EB',
        textStyle: { color: isDark ? '#F9FAFB' : '#111827' }
      },
      grid: {
        top: 20,
        right: 20,
        bottom: 25,
        left: 45,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLine: { lineStyle: { color: splitLineColor } },
        axisLabel: { color: textColor }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } },
        axisLabel: { 
          color: textColor,
          formatter: (val: number) => `${(val / 1000).toFixed(0)}k` 
        }
      },
      series: [
        {
          name: 'Evolução Patrimonial',
          type: 'line',
          smooth: true,
          symbolSize: 8,
          itemStyle: { color: '#3B82F6' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.4)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.0)' }
              ]
            }
          },
          data: growthData.map(v => Number(Math.max(0, v).toFixed(2)))
        },
        {
          name: 'Aporte Mensal (Fluxo)',
          type: 'bar',
          barWidth: 16,
          itemStyle: { color: '#10B981', borderRadius: [4, 4, 0, 0] },
          data: monthlyNetFlow.map(v => Number(v.toFixed(2)))
        }
      ]
    };
  }, [totalNetWorth, allTransactions, accounts, baseCurrency, quotes, theme]);

  // 4. Fluxo de Caixa (Ganhos vs Gastos) e Médias
  const cashFlowChartOption = useMemo(() => {
    const isDark = theme === 'dark';
    const textColor = isDark ? '#9CA3AF' : '#4B5563';
    const splitLineColor = isDark ? '#1F2937' : '#E5E7EB';

    const months: string[] = [];
    const monthlyIncome: number[] = [0, 0, 0, 0, 0, 0];
    const monthlyExpense: number[] = [0, 0, 0, 0, 0, 0];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(monthNames[d.getMonth()]);
    }

    allTransactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const diffMonths = (now.getFullYear() - txDate.getFullYear()) * 12 + now.getMonth() - txDate.getMonth();
      if (diffMonths >= 0 && diffMonths <= 5) {
        const index = 5 - diffMonths;
        const acc = accounts.find(a => a.id === tx.accountId);
        const curr = acc ? acc.currency : 'BRL';
        const baseAmount = convertCurrency(tx.amount, curr, baseCurrency, quotes);
        
        if (tx.type === 'income') {
          monthlyIncome[index] += baseAmount;
        } else if (tx.type === 'expense') {
          monthlyExpense[index] += baseAmount;
        }
      }
    });

    const avgIncome = monthlyIncome.reduce((a, b) => a + b, 0) / 6;
    const avgExpense = monthlyExpense.reduce((a, b) => a + b, 0) / 6;

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['Receitas', 'Despesas', 'Média Receitas', 'Média Despesas'], textStyle: { color: textColor }, bottom: 0 },
      grid: { top: 20, right: 20, bottom: 45, left: 45, containLabel: true },
      xAxis: { type: 'category', data: months, axisLine: { lineStyle: { color: splitLineColor } }, axisLabel: { color: textColor } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } }, axisLabel: { color: textColor, formatter: (val: number) => `${(val / 1000).toFixed(0)}k` } },
      series: [
        { name: 'Receitas', type: 'bar', itemStyle: { color: '#10B981', borderRadius: [4, 4, 0, 0] }, data: monthlyIncome.map(v => Number(v.toFixed(2))) },
        { name: 'Despesas', type: 'bar', itemStyle: { color: '#F43F5E', borderRadius: [4, 4, 0, 0] }, data: monthlyExpense.map(v => Number(v.toFixed(2))) },
        { name: 'Média Receitas', type: 'line', smooth: true, symbol: 'none', lineStyle: { type: 'dashed', width: 2 }, itemStyle: { color: '#059669' }, data: new Array(6).fill(avgIncome).map(v => Number(v.toFixed(2))) },
        { name: 'Média Despesas', type: 'line', smooth: true, symbol: 'none', lineStyle: { type: 'dashed', width: 2 }, itemStyle: { color: '#E11D48' }, data: new Array(6).fill(avgExpense).map(v => Number(v.toFixed(2))) }
      ]
    };
  }, [allTransactions, accounts, baseCurrency, quotes, theme]);

  // 5. Gráficos de Categorias (Pizza)
  const categoryChartsOption = useMemo(() => {
    const isDark = theme === 'dark';
    const textColor = isDark ? '#E5E7EB' : '#1F2937';

    const incomeByCategory: Record<string, number> = {};
    const expenseByCategory: Record<string, number> = {};

    const now = new Date();
    allTransactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const diffMonths = (now.getFullYear() - txDate.getFullYear()) * 12 + now.getMonth() - txDate.getMonth();
      if (diffMonths >= 0 && diffMonths <= 5) { // Últimos 6 meses
        const acc = accounts.find(a => a.id === tx.accountId);
        const curr = acc ? acc.currency : 'BRL';
        const baseAmount = convertCurrency(tx.amount, curr, baseCurrency, quotes);
        
        if (tx.type === 'income') {
          incomeByCategory[tx.category] = (incomeByCategory[tx.category] || 0) + baseAmount;
        } else if (tx.type === 'expense') {
          expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + baseAmount;
        }
      }
    });

    const incomeData = Object.entries(incomeByCategory).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })).sort((a,b)=>b.value-a.value);
    const expenseData = Object.entries(expenseByCategory).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })).sort((a,b)=>b.value-a.value);

    const basePieConfig = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}: <b>{c}</b> ({d}%)' },
      legend: { show: false }
    };

    return {
      income: {
        ...basePieConfig,
        series: [{ type: 'pie', radius: ['45%', '75%'], center: ['50%', '50%'], itemStyle: { borderRadius: 4, borderColor: isDark ? '#1F2937' : '#FFF', borderWidth: 2 }, label: { show: false }, data: incomeData.length ? incomeData : [{name: 'Sem Dados', value: 0}] }]
      },
      expense: {
        ...basePieConfig,
        series: [{ type: 'pie', radius: ['45%', '75%'], center: ['50%', '50%'], itemStyle: { borderRadius: 4, borderColor: isDark ? '#1F2937' : '#FFF', borderWidth: 2 }, label: { show: false }, data: expenseData.length ? expenseData : [{name: 'Sem Dados', value: 0}] }]
      }
    };
  }, [allTransactions, accounts, baseCurrency, quotes, theme]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Banner: Saldo Patrimonial Consolidação */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card glow className="lg:col-span-2 flex flex-col justify-between overflow-hidden relative border-amber-500/20 dark:border-blue-500/30">
          <div className="absolute -right-10 -top-10 w-60 h-60 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Patrimônio Consolidado ({baseCurrency})
                </span>
              </div>
              <Badge variant="purple" className="flex items-center gap-1 font-semibold">
                <span>Multi-Chain & Tradicional</span>
              </Badge>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                {formatCurrency(totalNetWorth, baseCurrency, privacyMode)}
              </h2>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                  changeEst24h >= 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'
                }`}>
                  {changeEst24h >= 0 ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                  {formatPercentage(changeEst24h)} (24h Est.)
                </span>
                <span className="text-xs text-gray-400 font-medium">vs. ontem</span>
              </div>
            </div>
          </div>

          {/* Mini Breakdown Grid in Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-gray-200/60 dark:border-gray-800/80">
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-blue-500" /> Contas & Caixas
              </p>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1">
                {formatCurrency(accountsTotal, baseCurrency, privacyMode)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Ativos Tradicionais
              </p>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1">
                {formatCurrency(investmentsTotal, baseCurrency, privacyMode)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-purple-500" /> DeFi Liquidity
              </p>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1">
                {formatCurrency(defiTotal, baseCurrency, privacyMode)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                <Vault className="w-3.5 h-3.5 text-amber-500" /> Caixinhas (Metas)
              </p>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1">
                {formatCurrency(goalsTotal, baseCurrency, privacyMode)}
              </p>
            </div>
          </div>
        </Card>

        {/* Card de Resumo DeFi & Ações Rápidas */}
        <Card hoverEffect className="flex flex-col justify-between bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-transparent border-purple-500/30">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-purple-400" /> Módulo DeFi & Pools
              </h3>
              <Badge variant="gold" className="text-[10px]">APR até 88%</Badge>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Gerencie posições de liquidez em <strong>Uniswap V3</strong> e <strong>Raydium</strong>. Nosso motor calcula o <em>Impermanent Loss</em> e projeta retornos de staking em tempo real.
            </p>

            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 mb-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Total em Pools (USD):</span>
                <span className="font-bold text-purple-300">{privacyMode ? '$ •••••' : '$ 11,072.50'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Recompensas Acumuladas:</span>
                <span className="font-bold text-emerald-400">+ {privacyMode ? '$ •••' : '$ 453.10'}</span>
              </div>
            </div>
          </div>

          <Button 
            variant="primary" 
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/30 font-bold"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={() => setActiveTab('investments')}
          >
            Abrir Simulador de Impermanent Loss
          </Button>
        </Card>
      </div>

      {/* Gráficos Interativos ECharts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Alocação Patrimonial */}
        <Card title={
          <span className="flex items-center gap-2 text-base font-bold">
            <PieChart className="w-5 h-5 text-blue-500" /> Alocação de Patrimônio ({baseCurrency})
          </span>
        } subtitle="Distribuição por classe de ativos e liquidez ao vivo">
          <div className="w-full h-[300px] mt-2">
            <ReactECharts option={allocationChartOption} style={{ height: '300px', width: '100%' }} />
          </div>
        </Card>

        {/* Gráfico 2: Evolução Patrimonial */}
        <Card title={
          <span className="flex items-center gap-2 text-base font-bold">
            <TrendingUp className="w-5 h-5 text-purple-500" /> Evolução Patrimonial
          </span>
        } subtitle="Crescimento patrimonial e fluxo de aportes dos últimos 6 meses (Simulado)">
          <div className="w-full h-[300px] mt-2">
            <ReactECharts option={evolutionChartOption} style={{ height: '300px', width: '100%' }} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 3: Análise de Fluxo de Caixa (Ganhos vs Gastos) */}
        <Card title={
          <span className="flex items-center gap-2 text-base font-bold">
            <BarChart3 className="w-5 h-5 text-emerald-500" /> Fluxo de Caixa vs Médias
          </span>
        } subtitle="Ganhos e Gastos comparados com a média móvel semestral">
          <div className="w-full h-[300px] mt-2">
            <ReactECharts option={cashFlowChartOption} style={{ height: '300px', width: '100%' }} />
          </div>
        </Card>

        {/* Gráfico 4: Divisão por Categorias */}
        <Card title={
          <span className="flex items-center gap-2 text-base font-bold">
            <Activity className="w-5 h-5 text-amber-500" /> Receitas e Despesas por Categoria
          </span>
        } subtitle="Análise de fontes de entrada e saída (Últimos 6 meses)">
          <div className="grid grid-cols-2 gap-4 h-[300px] mt-2">
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-emerald-500 mb-2">Entradas (Ganhos)</span>
              <div className="w-full h-[250px]">
                <ReactECharts option={categoryChartsOption.income} style={{ height: '100%', width: '100%' }} />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-rose-500 mb-2">Saídas (Gastos)</span>
              <div className="w-full h-[250px]">
                <ReactECharts option={categoryChartsOption.expense} style={{ height: '100%', width: '100%' }} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabela de Lançamentos Recentes */}
      <Card 
        title="Lançamentos & Transações Recentes" 
        subtitle="Movimentações geradas nas contas e carteiras"
        action={
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => setActiveTab('transactions')}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Ver todas
          </Button>
        }
      >
        {recentTransactions.length === 0 ? (
          <p className="text-center py-8 text-sm text-gray-500">Nenhum lançamento registrado no momento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200/60 dark:border-gray-800/80 text-gray-400 font-semibold text-xs">
                  <th className="pb-3">Tipo / Data</th>
                  <th className="pb-3">Descrição</th>
                  <th className="pb-3">Categoria</th>
                  <th className="pb-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/50">
                {recentTransactions.map((tx) => {
                  const isIncome = tx.type === 'income';
                  const isTransfer = tx.type === 'transfer';
                  const account = accounts.find(a => a.id === tx.accountId);
                  const curr = account ? account.currency : 'BRL';
                  
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="py-3.5 pr-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl ${
                            isIncome 
                              ? 'bg-emerald-500/10 text-emerald-500' 
                              : isTransfer 
                              ? 'bg-blue-500/10 text-blue-500' 
                              : 'bg-rose-500/10 text-rose-500'
                          }`}>
                            {isIncome ? <ArrowUpRight className="w-4 h-4" /> : isTransfer ? <Plus className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200 text-xs uppercase">
                              {isIncome ? 'Entrada' : isTransfer ? 'Transferência' : 'Saída'}
                            </p>
                            <p className="text-[11px] text-gray-400">{formatDate(tx.date)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <p className="font-medium text-gray-800 dark:text-gray-200">{tx.description}</p>
                        <p className="text-xs text-gray-400">{account ? account.name : 'Conta Geral'}</p>
                      </td>
                      <td className="py-3.5 pr-4">
                        <Badge variant={isIncome ? 'success' : isTransfer ? 'info' : 'default'}>
                          {tx.category}
                        </Badge>
                      </td>
                      <td className="py-3.5 text-right font-bold whitespace-nowrap">
                        <span className={isIncome ? 'text-emerald-500' : isTransfer ? 'text-blue-500' : 'text-gray-800 dark:text-gray-200'}>
                          {isIncome ? '+ ' : isTransfer ? '' : '- '}{formatCurrency(tx.amount, curr, privacyMode)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
