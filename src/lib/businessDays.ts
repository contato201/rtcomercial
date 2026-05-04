// Utilitários para cálculo de dias úteis (segunda a sexta) por mês.
// Não considera feriados nacionais.

export const businessDaysInMonth = (year: number, monthIndex: number): number => {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= last; day++) {
    const dow = new Date(year, monthIndex, day).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
};

export const DASHBOARD_YEAR = 2026;
