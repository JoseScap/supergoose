import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, type = 'text', ...props }: InputProps): React.JSX.Element {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-2xl border border-border/70 bg-white px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-sm outline-none transition-colors focus:border-primary/40 focus:ring-2 focus:ring-primary/20',
        className
      )}
      {...props}
    />
  );
}
