import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...cls: ClassValue[]) {
  return twMerge(clsx(cls));
}
