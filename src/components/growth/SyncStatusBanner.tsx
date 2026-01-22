import { AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SyncStatusBannerProps {
  lastSyncTime: Date | null;
  onSync: () => void;
  isSyncing: boolean;
  hasData: boolean;
}

export const SyncStatusBanner = ({
  lastSyncTime,
  onSync,
  isSyncing,
  hasData,
}: SyncStatusBannerProps) => {
  // Calcular se dados estão desatualizados (> 1 hora)
  const isOutdated = () => {
    if (!lastSyncTime) return true; // Nunca sincronizado
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return lastSyncTime < oneHourAgo;
  };

  // Se tem dados e não está desatualizado, não mostra o banner
  if (hasData && !isOutdated()) {
    return null;
  }

  // Formatar data/hora da última sincronização
  const formatLastSync = () => {
    if (!lastSyncTime) return null;
    
    const day = lastSyncTime.getDate().toString().padStart(2, '0');
    const month = (lastSyncTime.getMonth() + 1).toString().padStart(2, '0');
    const hours = lastSyncTime.getHours().toString().padStart(2, '0');
    const minutes = lastSyncTime.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month} às ${hours}:${minutes}`;
  };

  // Definir variante do banner
  const neverSynced = !lastSyncTime && !hasData;
  const outdated = lastSyncTime && isOutdated();

  return (
    <div
      className={cn(
        "rounded-lg border p-4 mb-6 animate-fade-in",
        neverSynced 
          ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800" 
          : "bg-amber-50/80 border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-800/60"
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-medium text-amber-800 dark:text-amber-200">
              {neverSynced 
                ? "Dados não sincronizados" 
                : "Seus dados estão desatualizados"
              }
            </h3>
            <p className="text-sm text-amber-700/80 dark:text-amber-300/70 mt-0.5">
              {neverSynced ? (
                "Clique em 'Sincronizar Agora' para carregar os dados do Google Sheets."
              ) : (
                <>Última sincronização: <span className="font-medium">{formatLastSync()}</span></>
              )}
            </p>
          </div>
        </div>
        
        <Button
          onClick={onSync}
          disabled={isSyncing}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex-shrink-0"
        >
          {isSyncing ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sincronizar Agora
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
