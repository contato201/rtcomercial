import { LucideIcon, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  action?: React.ReactNode;
}

export const EmptyState = ({ icon: Icon = Inbox, title, description, className, action }: EmptyStateProps) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center',
      className,
    )}
  >
    <div className="relative">
      <div className="absolute inset-0 -m-2 rounded-full bg-[hsl(var(--gold)/0.15)] blur-xl" />
      <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
    </div>
    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
    </div>
    {action && <div className="mt-2">{action}</div>}
  </div>
);
