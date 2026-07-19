import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Período selecionado, sempre como strings "YYYY-MM-DD" (fáceis de comparar
// com a coluna `data` das tabelas da Meta).
export interface Periodo {
  from: string;
  to: string;
}

export const ymd = (d: Date) => format(d, "yyyy-MM-dd");

// Período padrão: do dia 1º do mês atual até hoje.
export const periodoPadrao = (): Periodo => {
  const hoje = startOfDay(new Date());
  return { from: ymd(startOfMonth(hoje)), to: ymd(hoje) };
};

const parse = (s: string) => new Date(s + "T12:00:00");

interface Props {
  value: Periodo;
  onChange: (p: Periodo) => void;
}

export const GrowthDateRange = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false);

  const range: DateRange = { from: parse(value.from), to: parse(value.to) };

  const aplicarPreset = (from: Date, to: Date) => {
    onChange({ from: ymd(from), to: ymd(to) });
    setOpen(false);
  };

  const hoje = startOfDay(new Date());
  const presets = [
    { label: "Hoje", from: hoje, to: hoje },
    { label: "Últimos 7 dias", from: subDays(hoje, 6), to: hoje },
    { label: "Últimos 14 dias", from: subDays(hoje, 13), to: hoje },
    { label: "Últimos 30 dias", from: subDays(hoje, 29), to: hoje },
    { label: "Este mês", from: startOfMonth(hoje), to: hoje },
    {
      label: "Mês passado",
      from: startOfMonth(subMonths(hoje, 1)),
      to: endOfMonth(subMonths(hoje, 1)),
    },
  ];

  const label = `${format(parse(value.from), "dd/MM/yyyy", { locale: ptBR })} – ${format(
    parse(value.to),
    "dd/MM/yyyy",
    { locale: ptBR },
  )}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full sm:w-[280px] justify-start text-left font-normal min-h-[44px] sm:min-h-0")}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-row flex-wrap sm:flex-col gap-1 border-b sm:border-b-0 sm:border-r border-border p-2">
            {presets.map((p) => (
              <Button
                key={p.label}
                variant="ghost"
                size="sm"
                className="justify-start text-xs font-normal"
                onClick={() => aplicarPreset(p.from, p.to)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            locale={ptBR}
            defaultMonth={parse(value.from)}
            selected={range}
            numberOfMonths={1}
            onSelect={(r) => {
              if (r?.from && r?.to) {
                onChange({ from: ymd(r.from), to: ymd(r.to) });
              } else if (r?.from) {
                // seleção parcial: usa o mesmo dia como início e fim
                onChange({ from: ymd(r.from), to: ymd(r.from) });
              }
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};
