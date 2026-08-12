import type * as React from 'react';
import { cn } from '@/lib/utils';

export function Separator({ className }: { className?: string }): React.JSX.Element {
  return <div className={cn('h-px w-full bg-white/10', className)} />;
}
