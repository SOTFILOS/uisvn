import * as XLSX from 'xlsx';
import { cellStr } from './fieldCategoriser';

export type ProjectStatus = 'Completed' | 'In Progress' | 'Delayed';

export interface EnrichedRow {
  row: Record<string, unknown>;
  progress: number;   // 0–100
  status: ProjectStatus;
  pm: string;
  name: string;
}

// ── Column detection ─────────────────────────────────────────────────────────

function findCol(headers: string[], keywords: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase());
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h.includes(kw));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

export function findPMColumn(headers: string[]): string | null {
  return findCol(headers, ['project manager', 'pm', 'owner', 'responsible', 'assigned to']);
}

export function findEndDateColumn(headers: string[]): string | null {
  return findCol(headers, ['end date', 'due date', 'deadline', 'finish date', 'planned end', 'target date', 'completion date']);
}

export function findProgressColumn(headers: string[]): string | null {
  return findCol(headers, ['progress', 'completion %', '% done', '% complete', 'percent done']);
}

export function findNameColumn(headers: string[]): string | null {
  return findCol(headers, ['project name', 'initiative', 'project title', 'name', 'title']);
}

// ── Date parsing ─────────────────────────────────────────────────────────────

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const n = Number(value);
  if (!isNaN(n) && n > 10000) {
    // Excel serial date (days since 1899-12-30)
    return new Date((n - 25569) * 86400 * 1000);
  }
  const str = cellStr(value).trim();
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

// ── Progress computation ─────────────────────────────────────────────────────

function computeYNProgress(headers: string[], row: Record<string, unknown>): number | null {
  let yes = 0, no = 0;
  headers.forEach((h) => {
    const v = String(row[h] ?? '').trim().toUpperCase();
    if (v === 'Y' || v === 'YES') yes++;
    else if (v === 'N' || v === 'NO') no++;
  });
  const total = yes + no;
  return total > 0 ? Math.round((yes / total) * 100) : null;
}

function getProjectName(
  headers: string[],
  row: Record<string, unknown>,
  nameCol: string | null
): string {
  if (nameCol) {
    const v = cellStr(row[nameCol]).trim();
    if (v) return v;
  }
  for (const h of headers) {
    const v = cellStr(row[h]).trim();
    if (v && isNaN(Number(v)) && !v.includes('@') && v.length > 1 && v.length <= 80) {
      return v;
    }
  }
  return 'Project';
}

// ── Main enrichment ──────────────────────────────────────────────────────────

export function enrichRows(
  headers: string[],
  rows: Record<string, unknown>[]
): EnrichedRow[] {
  const progressCol = findProgressColumn(headers);
  const endDateCol  = findEndDateColumn(headers);
  const pmCol       = findPMColumn(headers);
  const nameCol     = findNameColumn(headers);
  const today       = new Date();

  return rows.map((row) => {
    // ── Progress ──
    let progress: number;
    if (progressCol) {
      const raw = cellStr(row[progressCol]).trim().replace('%', '');
      const n = parseFloat(raw);
      if (!isNaN(n)) {
        progress = n > 1 ? Math.round(n) : Math.round(n * 100);
      } else {
        progress = computeYNProgress(headers, row) ?? 0;
      }
    } else {
      progress = computeYNProgress(headers, row) ?? 0;
    }
    progress = Math.min(100, Math.max(0, progress));

    // ── Status ──
    const endDate = endDateCol ? parseDate(row[endDateCol]) : null;
    let status: ProjectStatus;
    if (progress >= 100) {
      status = 'Completed';
    } else if (endDate && endDate < today) {
      status = 'Delayed';
    } else {
      status = 'In Progress';
    }

    const pm   = pmCol ? cellStr(row[pmCol]).trim() : '';
    const name = getProjectName(headers, row, nameCol);

    return { row, progress, status, pm, name };
  });
}

// ── Aggregate helpers ────────────────────────────────────────────────────────

export function getUniquePMs(enrichedRows: EnrichedRow[]): string[] {
  const pms = new Set<string>();
  enrichedRows.forEach((r) => { if (r.pm) pms.add(r.pm); });
  return Array.from(pms).sort();
}

export function getStatusCounts(
  enrichedRows: EnrichedRow[]
): Record<ProjectStatus, number> {
  return enrichedRows.reduce(
    (acc, r) => { acc[r.status]++; return acc; },
    { Completed: 0, 'In Progress': 0, Delayed: 0 } as Record<ProjectStatus, number>
  );
}

// ── Radar / Spider data ──────────────────────────────────────────────────────

/**
 * Returns up to 8 Y/N column names ordered by how many rows contain
 * a Y or N value in that column (most populated first).
 */
export function getRadarAxes(
  headers: string[],
  rows: Record<string, unknown>[]
): string[] {
  const freq: Record<string, number> = {};
  rows.forEach((row) =>
    headers.forEach((h) => {
      const v = String(row[h] ?? '').trim().toUpperCase();
      if (v === 'Y' || v === 'YES' || v === 'N' || v === 'NO') {
        freq[h] = (freq[h] ?? 0) + 1;
      }
    })
  );
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([h]) => h);
}

export function getRadarData(
  axes: string[],
  rows: Record<string, unknown>[]
): Array<{ axis: string; fullAxis: string; value: number }> {
  return axes.map((h) => {
    let yes = 0, total = 0;
    rows.forEach((row) => {
      const v = String(row[h] ?? '').trim().toUpperCase();
      if (v === 'Y' || v === 'YES') { yes++; total++; }
      else if (v === 'N' || v === 'NO') total++;
    });
    const label = h
      .replace(/\s*\([Yy]\/[Nn]\)/g, '')
      .replace(/\?$/, '')
      .trim()
      .slice(0, 18)
      .trim();
    return { axis: label, fullAxis: h, value: total > 0 ? Math.round((yes / total) * 100) : 0 };
  });
}

// ── Excel export ─────────────────────────────────────────────────────────────

export function exportUpdatedExcel(
  headers: string[],
  enrichedRows: EnrichedRow[],
  baseName: string,
  sheetName: string
): void {
  const exportHeaders = [...headers, 'Progress (%)', 'Status'];

  const sheetData = enrichedRows.map(({ row, progress, status }) => {
    const record: Record<string, unknown> = {};
    headers.forEach((h) => { record[h] = row[h] ?? ''; });
    record['Progress (%)'] = progress;
    record['Status'] = status;
    return record;
  });

  const ws = XLSX.utils.json_to_sheet(sheetData, { header: exportHeaders });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  const fileName = `${baseName}_updated.xlsx`.replace(/[^\w._-]/g, '_');
  XLSX.writeFile(wb, fileName);
}
