import { useMemo, useState } from "react";
import { z } from "zod";
import { Trash2, Pencil, Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type UnitSale = {
  id: string;
  month: string;
  valor: number;
  cliente: string;
  created_at: string;
  updated_at: string;
};

const moneySchema = z
  .number({ invalid_type_error: "Valor inválido" })
  .finite()
  .positive("Valor precisa ser maior que zero")
  .max(1_000_000, "Valor muito alto");

const parseCurrencyToNumber = (raw: string) => {
  // aceita "1.234,56" ou "1234"; internamente salva em reais com 2 casas
  const cleaned = raw
    .trim()
    .replace(/[^0-9,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "") // remove separador de milhar
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value
  );

interface UnitSalesEditorProps {
  monthLabel: string;
  sales: UnitSale[];
  canEdit: boolean;
  onAdd: (valor: number, cliente: string) => Promise<void> | void;
  onUpdate: (id: string, valor: number, cliente: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

export const UnitSalesEditor = ({
  monthLabel,
  sales,
  canEdit,
  onAdd,
  onUpdate,
  onDelete,
}: UnitSalesEditorProps) => {
  const [newValue, setNewValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const totals = useMemo(() => {
    const count = sales.length;
    const sum = sales.reduce((acc, s) => acc + Number(s.valor || 0), 0);
    const avg = count > 0 ? sum / count : 0;
    return { count, sum, avg };
  }, [sales]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const handleAdd = async () => {
    if (!canEdit) return;
    const valor = parseCurrencyToNumber(newValue);
    const parsed = moneySchema.safeParse(valor);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Valor inválido");
      return;
    }
    try {
      setIsAdding(true);
      setFormError(null);
      await onAdd(parsed.data);
      setNewValue("");
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (sale: UnitSale) => {
    if (!canEdit) return;
    setEditingId(sale.id);
    setEditingValue(String(sale.valor ?? ""));
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
    setEditError(null);
  };

  const confirmEdit = async (id: string) => {
    if (!canEdit) return;
    const valor = parseCurrencyToNumber(editingValue);
    const parsed = moneySchema.safeParse(valor);
    if (!parsed.success) {
      setEditError(parsed.error.issues[0]?.message ?? "Valor inválido");
      return;
    }

    try {
      setBusyId(id);
      setEditError(null);
      await onUpdate(id, parsed.data);
      cancelEdit();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    try {
      setBusyId(id);
      await onDelete(id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-card rounded-xl p-4 border border-primary/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-semibold text-foreground">Vendas unitárias</h4>
          <p className="text-xs text-muted-foreground">
            Lançamento por venda (valores diferentes) — {monthLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Qtd: {totals.count}</Badge>
          <Badge variant="secondary">Total: {formatCurrency(totals.sum)}</Badge>
          <Badge variant="outline">Ticket médio: {formatCurrency(totals.avg || 0)}</Badge>
        </div>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground block mb-1 font-medium">
            Valor da venda
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Ex: 2700 ou 2.700,00"
            disabled={!canEdit || isAdding}
            className={`input-field ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!canEdit || isAdding}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar
          </Button>
        </div>
      </div>

      {formError && (
        <p className="mt-2 text-sm text-destructive">{formError}</p>
      )}

      <div className="mt-4 space-y-2">
        {sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda lançada neste mês.</p>
        ) : (
          sales.map((sale, idx) => {
            const isEditing = editingId === sale.id;
            const isBusy = busyId === sale.id;
            return (
              <div key={sale.id} className="space-y-1">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      Venda #{idx + 1}: {formatCurrency(Number(sale.valor || 0))}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {sale.created_at ? `Criada em ${formatDate(sale.created_at)}` : ""}
                    </p>
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        disabled={!canEdit || isBusy}
                        className="input-field h-9 w-40"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => confirmEdit(sale.id)}
                        disabled={!canEdit || isBusy}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Salvar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={cancelEdit}
                        disabled={isBusy}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(sale)}
                        disabled={!canEdit || isBusy}
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(sale.id)}
                        disabled={!canEdit || isBusy}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Excluir
                      </Button>
                    </div>
                  )}
                </div>

                {isEditing && editError && (
                  <p className="text-sm text-destructive">{editError}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
