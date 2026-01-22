import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getTooltip } from '@/lib/metric-tooltips';

interface MetricTooltipProps {
  label: string;
  children?: React.ReactNode;
  showIcon?: boolean;
  className?: string;
}

export const MetricTooltip = ({ 
  label, 
  children, 
  showIcon = true,
  className = '' 
}: MetricTooltipProps) => {
  const tooltip = getTooltip(label);
  
  if (!tooltip) {
    return <>{children || label}</>;
  }

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 cursor-help ${className}`}>
          {children || label}
          {showIcon && (
            <HelpCircle className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        className="max-w-xs bg-popover text-popover-foreground border-border p-3 shadow-lg"
        sideOffset={5}
      >
        <div className="space-y-1.5">
          <p className="font-semibold text-sm text-primary">
            {label} = {tooltip.title}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {tooltip.description}
          </p>
          {tooltip.formula && (
            <p className="text-[10px] text-muted-foreground/70 pt-1 border-t border-border">
              <span className="opacity-70">Fórmula:</span>{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-foreground/80">
                {tooltip.formula}
              </code>
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
