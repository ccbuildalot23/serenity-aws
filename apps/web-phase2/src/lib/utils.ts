import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function calculateRiskLevel(mood: number, anxiety: number, cravingIntensity: number): 'low' | 'moderate' | 'high' | 'critical' {
  let riskScore = 0;
  
  if (mood <= 3) riskScore += 3;
  if (anxiety >= 7) riskScore += 3;
  if (cravingIntensity >= 7) riskScore += 3;
  
  if (riskScore >= 8) return 'critical';
  if (riskScore >= 6) return 'high';
  if (riskScore >= 3) return 'moderate';
  return 'low';
}