export function formatCurrency(
  amount: number,
  currency: string = 'BRL',
  privacyMode: boolean = false
): string {
  if (privacyMode) {
    const symbols: Record<string, string> = {
      BRL: 'R$',
      USD: '$',
      USDC: 'USDC',
      EUR: '€',
      BTC: '₿',
      ETH: 'Ξ',
      SOL: '◎'
    };
    return `${symbols[currency] || '$'} •••••••`;
  }

  if (currency === 'BTC' || currency === 'ETH' || currency === 'SOL') {
    const symbolMap: Record<string, string> = {
      BTC: '₿',
      ETH: 'Ξ',
      SOL: '◎'
    };
    // 6 casas decimais para criptomoedas
    const decimals = currency === 'BTC' ? 6 : 4;
    return `${symbolMap[currency] || ''} ${amount.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency}`;
  }

  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency === 'USDC' ? 'USD' : currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount).replace('US$', '$').replace('USD', 'USDC');
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatPercentage(val: number): string {
  if (isNaN(val)) return '0,00%';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return 'Data não informada';
  try {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    if (!year || !month || !day) return dateStr;
    
    const months = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    const monthIndex = parseInt(month, 10) - 1;
    return `${day} ${months[monthIndex]} ${year}`;
  } catch {
    return dateStr;
  }
}

export function getCurrencySymbol(currency: string): string {
  const map: Record<string, string> = {
    BRL: 'R$',
    USD: '$',
    USDC: 'USDC',
    EUR: '€',
    BTC: '₿',
    ETH: 'Ξ',
    SOL: '◎'
  };
  return map[currency] || '$';
}

export function formatCompactNumber(value: number, privacyMode: boolean = false): string {
  if (privacyMode) return '••••';
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 10_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}
