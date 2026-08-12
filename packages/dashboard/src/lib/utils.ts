import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en').format(value);
}

export function formatRelativeAge(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.max(0, Math.round(diffMs / 3_600_000));

  if (diffHours < 1) {
    return 'just now';
  }

  if (diffHours === 1) {
    return '1 hour ago';
  }

  if (diffHours < 24) {
    return `${diffHours} hours ago`;
  }

  const diffDays = Math.round(diffHours / 24);

  return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
}
