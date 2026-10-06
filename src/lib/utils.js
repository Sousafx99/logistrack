import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

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

  // 1. CARTEIRA COTACAO => RAQUEL GOMES DOS SANTOS
  if (semAcento === 'CARTEIRA COTACAO' || semAcento.startsWith('CARTEIRA COTACAO') || semAcento.includes('CARTEIRA COTACAO')) {
    return 'RAQUEL GOMES DOS SANTOS';
  }

  // 2. LARISSA GIOVANA SANTOS FREITAS - EXTRA => LARISSA GIOVANA SANTOS FREITAS
  if (semAcento.startsWith('LARISSA GIOVANA SANTOS FREITAS')) {
    return 'LARISSA GIOVANA SANTOS FREITAS';
  }

  // 3. QUITERIA COSTA PIMENTEL - EXTRA => QUITERIA COSTA PIMENTEL
  if (semAcento.startsWith('QUITERIA COSTA PIMENTEL')) {
    return 'QUITERIA COSTA PIMENTEL';
  }

  return rcaStr;
}
