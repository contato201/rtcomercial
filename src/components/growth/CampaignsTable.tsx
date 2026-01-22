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
      <div className="bg-card rounded-xl p-6 border border-border text-center">
        <p className="text-muted-foreground">
          Nenhuma campanha carregada. Clique em "Sincronizar Sheets" para buscar os dados.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Campanhas de Captação</h3>
        <p className="text-sm text-muted-foreground">{campaigns.length} campanhas encontradas</p>
      </div>
      
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
  );
};
