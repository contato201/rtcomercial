import { CampaignData } from '@/types/growth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CampaignsTableProps {
  campaigns: CampaignData[];
}

export const CampaignsTable = ({ campaigns }: CampaignsTableProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (campaigns.length === 0) {
    return (
      <div className="bg-card rounded-xl p-4 sm:p-6 border border-border text-center">
        <p className="text-sm sm:text-base text-muted-foreground">
          Nenhuma campanha carregada. Clique em "Sincronizar Sheets" para buscar os dados.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-border">
        <h3 className="font-semibold text-sm sm:text-base text-foreground">Campanhas de Captação</h3>
        <p className="text-xs sm:text-sm text-muted-foreground">{campaigns.length} campanhas encontradas</p>
      </div>
      
      {/* Mobile: Cards view */}
      <div className="block sm:hidden">
        <ScrollArea className="h-[400px]">
          <div className="divide-y divide-border">
            {campaigns.map((campaign, index) => {
              const cpl = campaign.leads > 0 ? campaign.amountSpent / campaign.leads : 0;
              
              return (
                <div key={index} className="p-3 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-medium text-xs leading-tight flex-1">
                      {campaign.campaignName.length > 40 
                        ? campaign.campaignName.slice(0, 40) + '...' 
                        : campaign.campaignName}
                    </p>
                    <Badge 
                      variant={campaign.status.toLowerCase() === 'active' ? 'default' : 'secondary'}
                      className="text-[10px] flex-shrink-0"
                    >
                      {campaign.status || 'N/A'}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {campaign.adsetName}
                  </p>
                  <div className="grid grid-cols-4 gap-2 text-center pt-1">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Investido</p>
                      <p className="text-xs font-medium">{formatCurrency(campaign.amountSpent)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Cliques</p>
                      <p className="text-xs font-medium">{campaign.clicks.toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Leads</p>
                      <p className="text-xs font-medium">{campaign.leads}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">CPL</p>
                      <p className="text-xs font-medium">{formatCurrency(cpl)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Desktop: Table view */}
      <div className="hidden sm:block">
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Campanha</TableHead>
                <TableHead className="min-w-[150px]">Conjunto</TableHead>
                <TableHead className="text-right">Investido</TableHead>
                <TableHead className="text-right">Impressões</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">CPL</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign, index) => {
                const cpl = campaign.leads > 0 ? campaign.amountSpent / campaign.leads : 0;
                
                return (
                  <TableRow key={index}>
                    <TableCell className="font-medium text-xs">
                      {campaign.campaignName.length > 30 
                        ? campaign.campaignName.slice(0, 30) + '...' 
                        : campaign.campaignName}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {campaign.adsetName.length > 25 
                        ? campaign.adsetName.slice(0, 25) + '...' 
                        : campaign.adsetName}
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {formatCurrency(campaign.amountSpent)}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {campaign.impressions.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {campaign.clicks.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {campaign.leads}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {formatCurrency(cpl)}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={campaign.status.toLowerCase() === 'active' ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {campaign.status || 'N/A'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
};
