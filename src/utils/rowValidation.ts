/**
 * Row validation utilities for generic Excel datasets.
 * Adds two computed columns to rows in-place:
 * - Row Number
 * - Status ("Valid" | "Error")
 *
 * It also returns a reordered headers array that prioritizes:
 * Row Number, Full Name, Email Address, Phone Number, Tax ID, Category, Status
 */

export type RecordStatus = 'Valid' | 'Error';

export interface ValidationOutcome {
  headers: string[];
  validCount: number;
  errorCount: number;
  statusHeader: string;
  rowNumberHeader: string;
}

/** Safe stringification for cell values. */
function cellStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Find a column by matching any of the provided keywords (case-insensitive, substring). */
function findCol(headers: string[], keywords: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  for (const kw of keywords) {
    const i = lower.findIndex((h) => h.includes(kw));
    if (i !== -1) return headers[i];
  }
  return null;
}

/** Basic validators */
function isNonEmptyName(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  // consider valid if contains space or length >= 2 and not purely numeric
  return /\s/.test(t) || (t.length >= 2 && !/^\d+$/.test(t));
}

function isValidEmail(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  // Simple pragmatic email validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(t);
}

function isValidPhone(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  // E.164-ish relaxed: allow +, digits, spaces, dashes, parentheses, dots; enforce length
  return /^\+?[0-9\s\-().]{7,20}$/.test(t);
}

function isValidTaxId(s: string): boolean {
  const t = s.replace(/\s+/g, '').toUpperCase();
  if (!t) return false;
  // Accept Greek AFM (9 digits) OR 8–15 alphanumeric (generic TIN/VAT)
  return /^(\d{9}|[A-Z0-9]{8,15})$/.test(t);
}

function isNonEmpty(s: string): boolean {
  return s.trim().length > 0;
}

/**
 * Apply validation to the given rows in-place, adding:
 * - "Row Number"
 * - "Status" ("Valid" | "Error")
 *
 * Returns headers reordered to surface the common business columns and the computed ones.
 */
export function applyValidation(
  headers: string[],
  rows: Record<string, unknown>[]
): ValidationOutcome {
  // Detect domain columns (case-insensitive)
  const nameCol = findCol(headers, ['full name', 'name']);
  const emailCol = findCol(headers, ['email', 'e-mail', 'mail']);
  const phoneCol = findCol(headers, ['phone', 'phone number', 'mobile', 'contact number', 'tel']);
  const taxIdCol = findCol(headers, ['tax id', 'tax identification', 'tin', 'vat', 'afm']);
  const categoryCol = findCol(headers, ['category', 'type', 'group', 'segment']);

  // Ensure computed column names don't collide
  let rowNumberHeader = 'Row Number';
  let statusHeader = 'Status';
  const lower = headers.map((h) => h.toLowerCase());
  if (lower.includes(rowNumberHeader.toLowerCase())) rowNumberHeader = 'Row No.';
  if (lower.includes(statusHeader.toLowerCase())) statusHeader = 'Status (Validation)';

  // Compute and annotate rows
  let validCount = 0;
  let errorCount = 0;

  rows.forEach((row, idx) => {
    (row as Record<string, unknown>)[rowNumberHeader] = idx + 1;

    const checks: boolean[] = [];

    if (nameCol) checks.push(isNonEmptyName(cellStr(row[nameCol])));
    if (emailCol) checks.push(isValidEmail(cellStr(row[emailCol])));
    if (phoneCol) checks.push(isValidPhone(cellStr(row[phoneCol])));
    if (taxIdCol) checks.push(isValidTaxId(cellStr(row[taxIdCol])));
    if (categoryCol) checks.push(isNonEmpty(cellStr(row[categoryCol])));

    // If no known columns detected, consider row valid (no constraints)
    const status: RecordStatus =
      checks.length === 0 ? 'Valid' : checks.every(Boolean) ? 'Valid' : 'Error';

    (row as Record<string, unknown>)[statusHeader] = status;

    if (status === 'Valid') validCount++;
    else errorCount++;
  });

  // Build preferred header order (only include detected columns if present)
  const preferred: string[] = [
    rowNumberHeader,
    ...(nameCol ? [nameCol] : []),
    ...(emailCol ? [emailCol] : []),
    ...(phoneCol ? [phoneCol] : []),
    ...(taxIdCol ? [taxIdCol] : []),
    ...(categoryCol ? [categoryCol] : []),
    statusHeader,
  ];

  // Ensure computed columns are represented in the headers set
  const withComputed = Array.from(
    new Set<string>([...headers, rowNumberHeader, statusHeader])
  );

  // Final reorder: preferred first (keeping only those present), then the rest
  const preferredSet = new Set(preferred);
  const ordered = [
    ...preferred.filter((h) => withComputed.includes(h)),
    ...withComputed.filter((h) => !preferredSet.has(h)),
  ];

  return { headers: ordered, validCount, errorCount, statusHeader, rowNumberHeader };
}