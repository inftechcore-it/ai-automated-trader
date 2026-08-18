/**
 * Bot utility functions
 */

/**
 * Safely convert any value to a number
 * Returns 0 for NaN, null, undefined, or non-numeric strings
 */
export const toNum = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

/**
 * Safely parse a trading symbol into base and quote assets
 */
export const parseSymbol = (symbol: string | undefined): { base: string; quote: string } => {
  if (!symbol) return { base: '', quote: '' };
  const parts = symbol.split('/');
  return {
    base: parts[0] || '',
    quote: parts[1] || '',
  };
};

/**
 * Format price with appropriate decimal places
 */
export const formatPrice = (price: number, decimals = 6): string => {
  return price.toFixed(decimals);
};

/**
 * Calculate percentage change
 */
export const percentChange = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};
