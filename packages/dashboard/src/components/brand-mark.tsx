import { Database } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BrandMark({ compact = false }: { compact?: boolean }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-primary shadow-glow">
        <Database className="h-5 w-5" />
      </div>
      <div className={cn('leading-tight', compact && 'hidden sm:block')}>
        <div className="font-semibold tracking-tight text-foreground">SuperGoose</div>
        <div className="text-xs text-muted-foreground">Readonly dashboard</div>
      </div>
    </div>
  );
}
