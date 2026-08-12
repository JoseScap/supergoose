import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-glow hover:brightness-110',
        secondary: 'bg-slate-50 text-foreground border border-border/70 hover:bg-white',
        outline: 'border border-border/70 bg-transparent text-foreground hover:bg-slate-50',
        ghost: 'text-foreground hover:bg-slate-50',
        destructive: 'bg-red-500 text-white hover:bg-red-600'
      },
      size: {
        default: 'h-11 px-4 py-2',
        sm: 'h-9 rounded-xl px-3',
        lg: 'h-12 rounded-2xl px-5',
        icon: 'h-11 w-11'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps): React.JSX.Element {
  return <button type={type} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
