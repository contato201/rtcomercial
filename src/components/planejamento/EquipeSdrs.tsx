import { useEffect, useState } from 'react';
import {
  fetchSdrNamesFromDb,
  persistSdrNamesToDb,
  subscribeSdrNames,
  type SdrNames,
} from '@/lib/sdrNames';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Trash2, Plus, Save, Loader2 } from 'lucide-react';

export const EquipeSdrs = () => {
  const [names, setNames] = useState<SdrNames>([]);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    fetchSdrNamesFromDb().then((n) => {
      setNames(n);
      setDrafts(n);
    });
    const unsub = subscribeSdrNames((n) => {
      setNames(n);
      setDrafts(n);
    });
    return unsub;
  }, []);

  const updateDraft = (i: number, val: string) => {
    setDrafts((prev) => prev.map((n, idx) => (idx === i ? val : n)));
  };

  const handleRename = async (i: number) => {
    const oldName = names[i];
    const newN = drafts[i].trim();
    if (!newN || newN === oldName) return;
    if (drafts.some((n, idx) => idx !== i && n.trim() === newN)) {
      toast.error('Nome duplicado', { description: 'Os SDRs precisam ter nomes diferentes.' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('rename_sdr' as any, { old_name: oldName, new_name: newN });
      if (error) throw error;
      const next = [...names];
      next[i] = newN;
      await persistSdrNamesToDb(next);
      toast.success(`"${oldName}" renomeado para "${newN}".`);
    } catch (e: any) {
      toast.error('Erro ao renomear', { description: e?.message ?? 'Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (i: number) => {
    if (names.length <= 1) {
      toast.error('Precisa haver pelo menos 1 SDR.');
      return;
    }
    const removed = names[i];
    if (!confirm(`Remover "${removed}" da equipe? Os lançamentos existentes dele permanecem no histórico.`)) return;
    setSaving(true);
    try {
      const next = names.filter((_, idx) => idx !== i);
      await persistSdrNamesToDb(next);
      toast.success(`"${removed}" removido da equipe.`);
    } catch (e: any) {
      toast.error('Erro ao remover', { description: e?.message ?? 'Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    const val = newName.trim();
    if (!val) return;
    if (names.some((n) => n === val)) {
      toast.error('Já existe um SDR com esse nome.');
      return;
    }
    setSaving(true);
    try {
      await persistSdrNamesToDb([...names, val]);
      setNewName('');
      toast.success(`"${val}" adicionado à equipe.`);
    } catch (e: any) {
      toast.error('Erro ao adicionar', { description: e?.message ?? 'Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {drafts.map((name, i) => {
          const dirty = name.trim() !== names[i];
          return (
            <div key={`${names[i]}-${i}`} className="flex gap-2 items-center">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                {i + 1}
              </div>
              <Input
                value={name}
                onChange={(e) => updateDraft(i, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename(i)}
                disabled={saving}
              />
              <Button
                size="sm"
                variant={dirty ? 'default' : 'ghost'}
                disabled={!dirty || saving}
                onClick={() => handleRename(i)}
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={saving || names.length <= 1}
                onClick={() => handleRemove(i)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border/60 pt-4 flex gap-2 items-center">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Nome do novo SDR"
          disabled={saving}
        />
        <Button onClick={handleAdd} disabled={saving || !newName.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Adicionar</>}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Ao adicionar ou remover, a meta por SDR recalcula automaticamente em todo o dashboard.
      </p>
    </div>
  );
};
