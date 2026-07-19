import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Trash2, Pencil, Check, X, Plus, User, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  fetchSdrNamesFromDb,
  loadSdrNames,
  subscribeSdrNames,
  type SdrNames,
} from "@/lib/sdrNames";
import { ORIGENS_VENDA, labelDaOrigem, isTrafego } from "@/lib/origens";

export type UnitSale = {
  id: string;
  month: string;
  valor: number;
  cliente: string;
  pessoa: string;
  origem: string;
  created_at: string;
  updated_at: string;
};

const moneySchema = z
  .number({ invalid_type_error: "Valor inválido" })
  .finite()
  .positive("Valor precisa ser maior que zero")
  .max(1_000_000, "Valor muito alto");

const parseCurrencyToNumber = (raw: string) => {
  const cleaned = raw
    .trim()
    .replace(/[^0-9,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

interface UnitSalesEditorProps {
  monthLabel: string;
  sales: UnitSale[];
  canEdit: boolean;
  onAdd: (valor: number, cliente: string, pessoa: string, origem: string) => Promise<void> | void;
  onUpdate: (id: string, valor: number, cliente: string, pessoa: string, origem: string) => Promise<void> | void;
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
  const [sdrNames, setSdrNames] = useState<SdrNames>(loadSdrNames());
  const [newValue, setNewValue] = useState("");
  const [newCliente, setNewCliente] = useState("");
  const [newPessoa, setNewPessoa] = useState("");
  const [newOrigem, setNewOrigem] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingCliente, setEditingCliente] = useState("");
  const [editingPessoa, setEditingPessoa] = useState("");
  const [editingOrigem, setEditingOrigem] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchSdrNamesFromDb().then(setSdrNames).catch(() => {});
    const unsub = subscribeSdrNames(setSdrNames);
    return unsub;
  }, []);

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
      await onAdd(parsed.data, newCliente.trim(), newPessoa.trim(), newOrigem);
      setNewValue("");
      setNewCliente("");
      setNewPessoa("");
      setNewOrigem("");
    } catch (error) {
      console.error("Erro ao adicionar venda:", error);
      setFormError("Venda não salva. Faça login novamente com o email autorizado e tente de novo.");
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (sale: UnitSale) => {
    if (!canEdit) return;
    setEditingId(sale.id);
    setEditingValue(String(sale.valor ?? ""));
    setEditingCliente(sale.cliente ?? "");
    setEditingPessoa(sale.pessoa ?? "");
    setEditingOrigem(sale.origem ?? "");
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
    setEditingCliente("");
    setEditingPessoa("");
    setEditingOrigem("");
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
      await onUpdate(id, parsed.data, editingCliente.trim(), editingPessoa.trim(), editingOrigem);
      cancelEdit();
    } catch (error) {
      console.error("Erro ao atualizar venda:", error);
      setEditError("Venda não atualizada. Faça login novamente com o email autorizado.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    try {
      setBusyId(id);
      setEditError(null);
      await onDelete(id);
    } catch (error) {
      console.error("Erro ao excluir venda:", error);
      setEditError("Venda não excluída. Faça login novamente com o email autorizado.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--gold-dark))] text-primary-foreground shadow-[0_4px_14px_-4px_hsl(var(--gold)/0.5)]">
            <Receipt className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Faturamento</p>
            <h4 className="text-base font-bold text-foreground">Vendas unitárias · {monthLabel}</h4>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-semibold tabular-nums">Qtd: {totals.count}</Badge>
          <Badge variant="secondary" className="font-semibold tabular-nums">Total: {formatCurrency(totals.sum)}</Badge>
          <Badge variant="outline" className="border-[hsl(var(--gold)/0.4)] font-semibold tabular-nums text-primary">Ticket médio: {formatCurrency(totals.avg || 0)}</Badge>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1 font-medium">
            SDR responsável
          </label>
          <select
            value={newPessoa}
            onChange={(e) => setNewPessoa(e.target.value)}
            disabled={!canEdit || isAdding}
            className={`input-field ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <option value="">— Sem SDR —</option>
            {sdrNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1 font-medium">
            Origem da venda
          </label>
          <select
            value={newOrigem}
            onChange={(e) => setNewOrigem(e.target.value)}
            disabled={!canEdit || isAdding}
            className={`input-field ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <option value="">— Sem origem —</option>
            {ORIGENS_VENDA.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1 font-medium">
            Nome do cliente
          </label>
          <input
            type="text"
            value={newCliente}
            onChange={(e) => setNewCliente(e.target.value)}
            placeholder="Ex: João Silva"
            disabled={!canEdit || isAdding}
            className={`input-field ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
          />
        </div>
        <div>
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
            className="w-full"
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
          <EmptyState
            icon={Receipt}
            title="Nenhuma venda lançada"
            description={`Comece registrando a primeira venda de ${monthLabel} no formulário acima.`}
          />
        ) : (
          sales.map((sale, idx) => {
            const isEditing = editingId === sale.id;
            const isBusy = busyId === sale.id;
            return (
              <div key={sale.id} className="space-y-1">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      <span>Venda #{idx + 1}: {formatCurrency(Number(sale.valor || 0))}</span>
                      {sale.cliente && (
                        <span className="inline-flex min-w-0 items-center text-muted-foreground font-normal">
                          <User className="w-3 h-3 mr-1 shrink-0" />
                          <span className="truncate">{sale.cliente}</span>
                        </span>
                      )}
                      {sale.pessoa ? (
                        <Badge variant="outline" className="text-xs">
                          SDR: {sale.pessoa}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs opacity-70">
                          Sem SDR
                        </Badge>
                      )}
                      {sale.origem ? (
                        <Badge
                          variant="outline"
                          className={`text-xs ${isTrafego(sale.origem) ? "border-primary/50 text-primary" : ""}`}
                        >
                          {isTrafego(sale.origem) ? "🚀 " : ""}{labelDaOrigem(sale.origem) || sale.origem}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs opacity-70">
                          Sem origem
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {sale.created_at ? `Criada em ${formatDate(sale.created_at)}` : ""}
                    </p>
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={editingPessoa}
                        onChange={(e) => setEditingPessoa(e.target.value)}
                        disabled={!canEdit || isBusy}
                        className="input-field h-9 w-32"
                      >
                        <option value="">— Sem SDR —</option>
                        {sdrNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                      <select
                        value={editingOrigem}
                        onChange={(e) => setEditingOrigem(e.target.value)}
                        disabled={!canEdit || isBusy}
                        className="input-field h-9 w-40"
                      >
                        <option value="">— Sem origem —</option>
                        {ORIGENS_VENDA.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editingCliente}
                        onChange={(e) => setEditingCliente(e.target.value)}
                        placeholder="Cliente"
                        disabled={!canEdit || isBusy}
                        className="input-field h-9 w-32"
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        disabled={!canEdit || isBusy}
                        className="input-field h-9 w-32"
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
