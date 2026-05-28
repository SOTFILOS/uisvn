import type { ExcelFile } from '../types/excel';
import type { EnrichedRow } from '../utils/projectAnalytics';
import { exportUpdatedExcel } from '../utils/projectAnalytics';

interface ExportSummaryProps {
  excelFile: ExcelFile;
  activeSheet: string;
  totalRows: number;
  totalColumns: number;
  headers: string[];
  rows: Record<string, unknown>[];
  enrichedRows: EnrichedRow[];
  onReset: () => void;

  // New optional validation/meta props
  validCount?: number;
  errorCount?: number;
  importDate?: Date | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(d: Date | null | undefined): string {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function exportCSV(
  headers: string[],
  rows: Record<string, unknown>[],
  baseName: string,
  sheetName: string
): void {
  const escape = (v: unknown): string => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csvRows = [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ];
  const content = '\uFEFF' + csvRows.join('\r\n'); // BOM for Excel compatibility
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${baseName}_${sheetName}.csv`.replace(/[^\w._-]/g, '_');
  link.click();
  URL.revokeObjectURL(url);
}

function MetaChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: '#94A3B8',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: '#0F172A',
          backgroundColor: '#F3F1EE',
          border: '1px solid #E2E0D8',
          borderRadius: 6,
          padding: '2px 9px',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Separator() {
  return (
    <div
      aria-hidden="true"
      style={{ width: 1, height: 16, backgroundColor: '#E2E0D8', flexShrink: 0 }}
    />
  );
}

export default function ExportSummary({
  excelFile,
  activeSheet,
  totalRows,
  totalColumns,
  headers,
  rows,
  enrichedRows,
  onReset,
  validCount,
  errorCount,
  importDate,
}: ExportSummaryProps) {
  const baseName = excelFile.fileName.replace(/\.[^.]+$/, '');

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E0D8',
        borderRadius: 14,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        boxShadow: '0 1px 6px rgba(79,70,229,0.05)',
      }}
    >
      {/* File icon */}
      <div
        style={{
          width: 32,
          height: 32,
          backgroundColor: '#EEF0F8',
          border: '1px solid #C7D2FE',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2" y="1" width="9" height="13" rx="1.5" stroke="#4F46E5" strokeWidth="1.2" />
          <path d="M11 1l3 3v10a1.5 1.5 0 01-1.5 1.5H4" stroke="#4F46E5" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M5 6h5M5 9h4" stroke="#4F46E5" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>

      {/* Meta chips */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          flex: '1 1 auto',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <MetaChip label="File" value={excelFile.fileName} />
        <Separator />
        <MetaChip label="Size" value={formatBytes(excelFile.fileSize)} />
        <Separator />
        <MetaChip label="Sheet" value={activeSheet} />
        <Separator />
        <MetaChip label="Projects" value={totalRows.toLocaleString()} />
        <Separator />
        <MetaChip label="Columns" value={totalColumns} />
        {typeof validCount === 'number' && typeof errorCount === 'number' && (
          <>
            <Separator />
            <MetaChip label="Valid Records" value={validCount.toLocaleString()} />
            <Separator />
            <MetaChip label="Records with Errors" value={errorCount.toLocaleString()} />
          </>
        )}
        {importDate !== undefined && (
          <>
            <Separator />
            <MetaChip label="Import Date" value={formatDateTime(importDate)} />
          </>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Export Excel */}
        <button
          onClick={() => exportUpdatedExcel(headers, enrichedRows, baseName, activeSheet)}
          disabled={enrichedRows.length === 0}
          title={`Export ${enrichedRows.length} rows as Excel with Progress & Status`}
          style={{
            fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
            fontWeight: 600,
            fontSize: '0.8125rem',
            color: enrichedRows.length === 0 ? '#94A3B8' : '#059669',
            background: 'transparent',
            border: `1.5px solid ${enrichedRows.length === 0 ? '#E2E0D8' : '#6EE7B7'}`,
            borderRadius: 9,
            padding: '7px 14px',
            cursor: enrichedRows.length === 0 ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s',
            opacity: enrichedRows.length === 0 ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (enrichedRows.length > 0) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F0FDF4';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#059669';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.borderColor =
              enrichedRows.length === 0 ? '#E2E0D8' : '#6EE7B7';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M4.5 5h5M4.5 7.5h5M4.5 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Export Excel
        </button>

        {/* Export CSV */}
        <button
          onClick={() => exportCSV(headers, rows, baseName, activeSheet)}
          disabled={rows.length === 0}
          title={`Export ${rows.length} rows as CSV`}
          style={{
            fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
            fontWeight: 600,
            fontSize: '0.8125rem',
            color: rows.length === 0 ? '#94A3B8' : '#0D9488',
            background: 'transparent',
            border: `1.5px solid ${rows.length === 0 ? '#E2E0D8' : '#A7D8D4'}`,
            borderRadius: 9,
            padding: '7px 14px',
            cursor: rows.length === 0 ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s',
            opacity: rows.length === 0 ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (rows.length > 0) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#EBF5F5';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#0D9488';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.borderColor = rows.length === 0 ? '#E2E0D8' : '#A7D8D4';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Export CSV
        </button>

        {/* Upload new */}
        <button
          onClick={onReset}
          aria-label="Clear and upload a new file"
          style={{
            fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
            fontWeight: 600,
            fontSize: '0.8125rem',
            color: '#FFFFFF',
            background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
            border: 'none',
            borderRadius: 9,
            padding: '8px 16px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'opacity 0.15s, transform 0.15s',
            boxShadow: '0 2px 10px rgba(79,70,229,0.30)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '0.88';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '1';
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M1 7C1 3.68629 3.68629 1 7 1C9.12 1 10.99 2.11 12.07 3.79M13 7C13 10.3137 10.3137 13 7 13C4.88 13 3.01 11.89 1.93 10.21"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path d="M12 1L12 4H9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 13L2 10H5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Upload New
        </button>
      </div>
    </div>
  );
}
