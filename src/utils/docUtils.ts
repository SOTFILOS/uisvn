/**
 * Documentation URL detection and augmentation utilities.
 * Centralizes keyword/domain heuristics and row annotation for the "Documentation URL" column.
 */
import { isUrlValue } from './fieldCategoriser';
import { DOC_COL_HEADER } from './constants';

/** Keywords commonly used in documentation columns or URLs */
export const DOC_KEYWORDS: string[] = [
  'doc', 'documentation', 'wiki', 'confluence', 'readme', 'guide', 'manual',
  'spec', 'specification', 'runbook', 'kb', 'knowledge base', 'docs',
];

/** Common domains and hosts serving docs */
export const DOC_DOMAINS: string[] = [
  'confluence', 'atlassian', 'notion', 'sharepoint', 'readthedocs',
  'github', 'gitlab', 'bitbucket', 'wiki', 'docs', 'mkdocs', 'docusaurus',
];

/**
 * Scan all cells in a row and return the first URL that looks like documentation.
 * Heuristic: header name or URL contains a keyword, or URL contains a known docs domain.
 */
export function findDocumentationUrl(
  headers: string[],
  row: Record<string, unknown>
): string | null {
  for (const h of headers) {
    const v = row[h];
    if (!isUrlValue(v)) continue;
    const hLo = h.toLowerCase();
    const url = String(v).toLowerCase();
    const hasKw = DOC_KEYWORDS.some((k) => hLo.includes(k) || url.includes(k));
    const hasDomain = DOC_DOMAINS.some((d) => url.includes(d));
    if (hasKw || hasDomain) return String(v);
  }
  return null;
}

/** Convenience predicate using findDocumentationUrl */
export function rowHasDocumentation(
  headers: string[],
  row: Record<string, unknown>
): boolean {
  return findDocumentationUrl(headers, row) !== null;
}

/**
 * Ensure the Documentation URL header exists; returns headers (new array if added).
 */
export function ensureDocHeader(
  headers: string[],
  headerName: string = DOC_COL_HEADER
): string[] {
  if (headers.includes(headerName)) return headers;
  return [...headers, headerName];
}

/**
 * Mutating helper: annotate each row with a Documentation URL column, in place.
 * This preserves object identity for selection (selectedRow === row).
 * Adds an empty string when no documentation is detected to keep the column consistent.
 */
export function annotateRowsWithDocUrlInPlace(
  headers: string[],
  rows: Record<string, unknown>[],
  headerName: string = DOC_COL_HEADER
): void {
  for (const row of rows) {
    const url = findDocumentationUrl(headers, row);
    (row as Record<string, unknown>)[headerName] = url ?? '';
  }
}