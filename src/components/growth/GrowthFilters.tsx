import { GrowthFilters as FilterOptions, ActiveFilters } from '@/types/growth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GrowthFiltersProps {
  availableFilters: FilterOptions;
  activeFilters: ActiveFilters;
  onFilterChange: (filters: ActiveFilters) => void;
  onClearFilters: () => void;
  campaignCount: number;
  filteredCount: number;
}

export const GrowthFiltersComponent = ({
  availableFilters,
  activeFilters,
  onFilterChange,
  onClearFilters,
  campaignCount,
  filteredCount,
}: GrowthFiltersProps) => {
  const hasActiveFilters = activeFilters.campaign || activeFilters.adset || activeFilters.status;

  return (
    <div className="bg-card rounded-xl p-4 border border-border space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Filtros</span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs">
              {filteredCount} de {campaignCount} campanhas
            </Badge>
          )}
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <X className="w-4 h-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Filtro por Campanha */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Campanha</label>
          <Select
            value={activeFilters.campaign || 'all'}
            onValueChange={(value) => 
              onFilterChange({ ...activeFilters, campaign: value === 'all' ? null : value })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todas as campanhas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as campanhas</SelectItem>
              {(availableFilters?.campaigns ?? []).map((campaign) => (
                <SelectItem key={campaign} value={campaign}>
                  {campaign.length > 40 ? campaign.slice(0, 40) + '...' : campaign}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por Conjunto de Anúncios */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Conjunto de Anúncios</label>
          <Select
            value={activeFilters.adset || 'all'}
            onValueChange={(value) => 
              onFilterChange({ ...activeFilters, adset: value === 'all' ? null : value })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos os conjuntos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os conjuntos</SelectItem>
              {(availableFilters?.adsets ?? []).map((adset) => (
                <SelectItem key={adset} value={adset}>
                  {adset.length > 40 ? adset.slice(0, 40) + '...' : adset}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por Status */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select
            value={activeFilters.status || 'all'}
            onValueChange={(value) => 
              onFilterChange({ ...activeFilters, status: value === 'all' ? null : value })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(availableFilters?.statuses ?? []).map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
