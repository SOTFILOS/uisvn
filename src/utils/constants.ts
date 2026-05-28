/**
 * Shared constants and helpers for the Excel importer app.
 * Centralizes the Documentation URL header name and readiness computations.
 */
import { cellStr } from './fieldCategoriser';

export const DOC_COL_HEADER = 'Documentation URL';

export type ReadinessBucket = 'on-track' | 'good' | 'attention' | 'at-risk' | 'no-data';

/**
 * Compute readiness percentage based on Y/N flags across the provided headers.
 * Returns an integer 0-100 or null when no Y/N flags are present.
 */
export function readinessPct(headers: string[], row: Record<string, unknown>): number | null {
  let yes = 0, no = 0;
  for (const h of headers) {
    const v = cellStr(row[h]).trim().toUpperCase();
    if (v === 'Y' || v === 'YES') yes++;
    else if (v === 'N' || v === 'NO') no++;
  }
  const total = yes + no;
  return total > 0 ? Math.round((yes / total) * 100) : null;
}

/**
 * Map a readiness percentage to a bucket used by dashboards/kanban.
 */
export function readinessBucket(pct: number | null): ReadinessBucket {
  if (pct === null) return 'no-data';
  if (pct >= 70) return 'on-track';
  if (pct >= 50) return 'good';
  if (pct >= 30) return 'attention';
  return 'at-risk';
}