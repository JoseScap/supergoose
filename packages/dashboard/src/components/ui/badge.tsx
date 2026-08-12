import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors', {
  variants: {
    variant: {
      default: 'border-border/70 bg-slate-50 text-foreground',
      success: 'border-emerald-400/20 bg-emerald-400/12 text-emerald-200',
      warning: 'border-amber-400/20 bg-amber-400/12 text-amber-200',
      muted: 'border-border/70 bg-slate-50 text-muted-foreground'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps): React.JSX.Element {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { badgeVariants };
