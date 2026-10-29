import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const GRUPO_CORES = {
  emerald: {
    name: 'Esmeralda',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-600 text-white',
    hex: '#10B981',
    ring: 'ring-emerald-500'
  },
  blue: {
    name: 'Azul',
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-500/30',
    badge: 'bg-blue-600 text-white',
    hex: '#3B82F6',
    ring: 'ring-blue-500'
  },
  purple: {
    name: 'Roxo',
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    text: 'text-purple-800 dark:text-purple-300',
    border: 'border-purple-500/30',
    badge: 'bg-purple-600 text-white',
    hex: '#8B5CF6',
    ring: 'ring-purple-500'
  },
  amber: {
    name: 'Âmbar',
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500 text-slate-950',
    hex: '#F59E0B',
    ring: 'ring-amber-500'
  },
  rose: {
    name: 'Rosa',
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    text: 'text-rose-800 dark:text-rose-300',
    border: 'border-rose-500/30',
    badge: 'bg-rose-600 text-white',
    hex: '#F43F5E',
    ring: 'ring-rose-500'
  },
  cyan: {
    name: 'Ciano',
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/20',
    text: 'text-cyan-800 dark:text-cyan-300',
    border: 'border-cyan-500/30',
    badge: 'bg-cyan-600 text-white',
    hex: '#06B6D4',
    ring: 'ring-cyan-500'
  },
  orange: {
    name: 'Laranja',
    bg: 'bg-orange-500/10 dark:bg-orange-500/20',
    text: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-500/30',
    badge: 'bg-orange-600 text-white',
    hex: '#F97316',
    ring: 'ring-orange-500'
  },
  indigo: {
    name: 'Índigo',
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    text: 'text-indigo-800 dark:text-indigo-300',
    border: 'border-indigo-500/30',
    badge: 'bg-indigo-600 text-white',
    hex: '#6366F1',
    ring: 'ring-indigo-500'
  }
};

/**
 * Unifica os nomes de RCAs (vendedores) conforme a regra de negócio da RJ:
 * - LARISSA GIOVANA SANTOS FREITAS - EXTRA => LARISSA GIOVANA SANTOS FREITAS
 * - QUITERIA COSTA PIMENTEL - EXTRA => QUITERIA COSTA PIMENTEL
 * - CARTEIRA COTACAO (ou variações) => RAQUEL GOMES DOS SANTOS
 */
export function normalizarRCA(rca) {
  if (!rca) return '';
  const rcaStr = String(rca).trim();
  if (!rcaStr) return '';

  const semAcento = rcaStr
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

  if (semAcento === 'CARTEIRA COTACAO' || semAcento.startsWith('CARTEIRA COTACAO') || semAcento.includes('CARTEIRA COTACAO')) {
    return 'RAQUEL GOMES DOS SANTOS';
  }

  if (semAcento.startsWith('LARISSA GIOVANA SANTOS FREITAS')) {
    return 'LARISSA GIOVANA SANTOS FREITAS';
  }

  if (semAcento.startsWith('QUITERIA COSTA PIMENTEL')) {
    return 'QUITERIA COSTA PIMENTEL';
  }

  return rcaStr;
}
