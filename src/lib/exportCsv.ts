import { MonthData } from '@/types/dashboard';

const safePercent = (realizado: number, meta: number): string => {
  if (!meta || meta === 0) return '0%';
  return `${((realizado / meta) * 100).toFixed(1)}%`;
};

export function exportDashboardCsv(rows: MonthData[], filename: string) {
  const header = [
    'Mês',
    'Meta Vendas', 'Realizado Vendas', '% Vendas',
    'Meta Faturamento', 'Realizado Faturamento', '% Faturamento',
    'Meta 1ª Reunião', 'Realizado 1ª Reunião',
    'Meta 2ª Reunião', 'Realizado 2ª Reunião',
  ];

  const csvRows = rows.map(r => [
    r.month,
    r.metaVendas, r.realizadoVendas, safePercent(r.realizadoVendas, r.metaVendas),
    r.metaFaturamento, r.realizadoFaturamento, safePercent(r.realizadoFaturamento, r.metaFaturamento),
    r.metaPrimeiraReuniao, r.realizadoPrimeiraReuniao,
    r.metaSegundaReuniao, r.realizadoSegundaReuniao,
  ].join(';'));

  const BOM = '\uFEFF';
  const csv = BOM + [header.join(';'), ...csvRows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
