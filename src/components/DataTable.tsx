import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';

interface DataTableProps {
  headers: string[];
  rows: Record<string, unknown>[];
  selectedRow?: Record<string, unknown> | null;
  onRowClick?: (row: Record<string, unknown>) => void;
}

type SortDir = 'asc' | 'desc';

interface SortState {
  column: string;
  dir: SortDir;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function cellString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** Render a cell value: URLs become links, X/- flags get styled chips. */
function CellContent({ value }: { value: unknown }) {
  const str = cellString(value);
  if (str === '') return <span style={{ color: '#CBD5E1' }}>—</span>;

  if (isUrl(str)) {
    return (
      <a
        href={str}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: '#0D9488',
          textDecoration: 'underline',
          textDecorationStyle: 'dotted',
          textUnderlineOffset: 3,
          whiteSpace: 'nowrap',
        }}
        onClick={(e) => e.stopPropagation()}
        title={str}
      >
        Link ↗
      </a>
    );
  }

  if (str === 'X') {
    return (
      <span
        style={{
          display: 'inline-block',
          backgroundColor: '#EBF5F5',
          color: '#0D9488',
          fontWeight: 700,
          fontSize: '0.75rem',
          borderRadius: 4,
          padding: '1px 6px',
          border: '1px solid #C6E4E4',
        }}
      >
        X
      </span>
    );
  }

  if (str === '-' || str === '_') {
    return <span style={{ color: '#CBD5E1' }}>–</span>;
  }

  if (str === 'Y' || str.toUpperCase() === 'YES') {
    return (
      <span
        style={{
          display: 'inline-block',
          backgroundColor: '#F0FDF4',
          color: '#16A34A',
          fontWeight: 600,
          fontSize: '0.75rem',
          borderRadius: 4,
          padding: '1px 6px',
          border: '1px solid #BBF7D0',
        }}
      >
        Y
      </span>
    );
  }

  if (str === 'N' || str.toUpperCase() === 'NO') {
    return (
      <span
        style={{
          display: 'inline-block',
          backgroundColor: '#FFF7ED',
          color: '#C2410C',
          fontWeight: 600,
          fontSize: '0.75rem',
          borderRadius: 4,
          padding: '1px 6px',
          border: '1px solid #FED7AA',
        }}
      >
        N
      </span>
    );
  }

  return <>{str}</>;
}

function compareValues(a: unknown, b: unknown, dir: SortDir): number {
  const aStr = cellString(a).toLowerCase();
  const bStr = cellString(b).toLowerCase();
  const aNum = Number(a);
  const bNum = Number(b);

  let cmp: number;
  if (!isNaN(aNum) && !isNaN(bNum)) {
    cmp = aNum - bNum;
  } else {
    cmp = aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
  }
  return dir === 'asc' ? cmp : -cmp;
}

// Empty state illustration
function EmptyState() {
  return (
    <div
      style={{
        padding: '64px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        color: '#94A3B8',
      }}
    >
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
        <rect width="56" height="56" rx="16" fill="#EEF0F8" />
        <path
          d="M16 20h24M16 28h16M16 36h10"
          stroke="#C7D2FE"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontWeight: 600, color: '#64748B', margin: 0 }}>
        No data to display
      </p>
      <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.875rem', margin: 0 }}>
        This sheet appears to be empty.
      </p>
    </div>
  );
}

export default function DataTable({ headers, rows, selectedRow, onRowClick }: DataTableProps) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [colPanelOpen, setColPanelOpen] = useState(false);
  const colBtnRef = useRef<HTMLButtonElement>(null);
  const colPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHiddenCols(new Set()); }, [headers]);

  useEffect(() => {
    if (!colPanelOpen) return;
    const handle = (e: MouseEvent) => {
      if (
        colBtnRef.current && !colBtnRef.current.contains(e.target as Node) &&
        colPanelRef.current && !colPanelRef.current.contains(e.target as Node)
      ) setColPanelOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [colPanelOpen]);

  const toggleCol = useCallback((col: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      return next;
    });
  }, []);

  const visibleHeaders = useMemo(() => headers.filter((h) => !hiddenCols.has(h)), [headers, hiddenCols]);

  const handleSearch = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setPage(1);
    },
    []
  );

  const handleSort = useCallback(
    (col: string) => {
      setSort((prev) => {
        if (prev?.column === col) {
          return { column: col, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
        }
        return { column: col, dir: 'asc' };
      });
      setPage(1);
    },
    []
  );

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const lower = search.toLowerCase();
    return rows.filter((row) =>
      headers.some((h) => cellString(row[h]).toLowerCase().includes(lower))
    );
  }, [rows, headers, search]);

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    return [...filteredRows].sort((a, b) =>
      compareValues(a[sort.column], b[sort.column], sort.dir)
    );
  }, [filteredRows, sort]);

  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalRows);
  const visibleRows = sortedRows.slice(startIdx, endIdx);

  if (headers.length === 0) return <EmptyState />;

  return (
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 200 }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            aria-hidden="true"
          >
            <circle cx="6.5" cy="6.5" r="5" stroke="#9CA3AF" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={handleSearch}
            placeholder="Search all columns…"
            aria-label="Search rows"
            style={{
              width: '100%',
              paddingLeft: 34,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              border: '1.5px solid #E2E0D8',
              borderRadius: 8,
              fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
              fontSize: '0.875rem',
              color: '#0F172A',
              backgroundColor: '#FFFFFF',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#0D9488')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#E2E0D8')}
          />
        </div>

        {/* Rows per page */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <label
            htmlFor="page-size"
            style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.8125rem', color: '#64748B', whiteSpace: 'nowrap' }}
          >
            Rows per page
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value) as PageSize);
              setPage(1);
            }}
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.8125rem',
              border: '1.5px solid #E2E0D8',
              borderRadius: 8,
              padding: '6px 10px',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* Column visibility */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            ref={colBtnRef}
            onClick={() => setColPanelOpen((p) => !p)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              border: hiddenCols.size > 0 ? '1.5px solid #4F46E5' : '1.5px solid #E2E0D8',
              borderRadius: 8,
              backgroundColor: hiddenCols.size > 0 ? '#EEF0F8' : '#FFFFFF',
              color: hiddenCols.size > 0 ? '#4F46E5' : '#64748B',
              fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
              fontSize: '0.8125rem',
              fontWeight: hiddenCols.size > 0 ? 600 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="12" height="2.5" rx="1" fill="currentColor" />
              <rect x="1" y="5.75" width="8" height="2.5" rx="1" fill="currentColor" fillOpacity="0.6" />
              <rect x="1" y="10.5" width="5" height="2.5" rx="1" fill="currentColor" fillOpacity="0.3" />
            </svg>
            Columns
            {hiddenCols.size > 0 && (
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.6875rem',
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  borderRadius: 10,
                  padding: '1px 7px',
                }}
              >
                {hiddenCols.size} hidden
              </span>
            )}
          </button>

          {colPanelOpen && (
            <div
              ref={colPanelRef}
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: 220,
                maxHeight: 300,
                overflowY: 'auto',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E0D8',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                zIndex: 50,
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid #F3F1EE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>
                  Show / Hide
                </span>
                {hiddenCols.size > 0 && (
                  <button
                    onClick={() => setHiddenCols(new Set())}
                    style={{
                      fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                      fontSize: '0.6875rem',
                      color: '#4F46E5',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: 600,
                    }}
                  >
                    Show all
                  </button>
                )}
              </div>
              {headers.map((h) => {
                const isVisible = !hiddenCols.has(h);
                return (
                  <label
                    key={h}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 14px',
                      cursor: 'pointer',
                      backgroundColor: 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLLabelElement).style.backgroundColor = '#F7F5F2')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLLabelElement).style.backgroundColor = 'transparent')}
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => toggleCol(h)}
                      style={{ accentColor: '#4F46E5', width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
                    />
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '0.75rem',
                        color: isVisible ? '#1F2937' : '#94A3B8',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Table wrapper */}
      <div
        style={{
          overflowX: 'auto',
          border: '1px solid #E2E0D8',
          borderRadius: 12,
          backgroundColor: '#FFFFFF',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.8125rem',
          }}
        >
          {/* Header */}
          <thead>
            <tr style={{ backgroundColor: '#F3F1EE', borderBottom: '2px solid #E2E0D8' }}>
              {visibleHeaders.map((header, colIdx) => {
                const isActive = sort?.column === header;
                const isFirst = colIdx === 0;
                return (
                  <th
                    key={header}
                    onClick={() => handleSort(header)}
                    style={{
                      padding: '11px 16px',
                      textAlign: 'left',
                      fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      color: isActive ? '#0D9488' : '#1F2937',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      borderRight: '1px solid #E2E0D8',
                      // Sticky first column
                      ...(isFirst && {
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        backgroundColor: '#F3F1EE',
                        boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)',
                      }),
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {header}
                      <SortIcon active={isActive} dir={sort?.dir ?? 'asc'} />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleHeaders.length}
                  style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    color: '#94A3B8',
                    fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                  }}
                >
                  No rows match your search.
                </td>
              </tr>
            ) : (
              visibleRows.map((row, rowIdx) => {
                const isSelected = row === selectedRow;
                const rowBg = isSelected ? '#EBF5F5' : rowIdx % 2 === 0 ? '#FFFFFF' : '#F9F8F6';
                const hoverBg = isSelected ? '#D6ECEC' : '#EEF0F8';
                return (
                  <tr
                    key={rowIdx}
                    onClick={() => onRowClick?.(row)}
                    style={{
                      borderBottom: '1px solid #E2E0D8',
                      backgroundColor: rowBg,
                      borderLeft: isSelected ? '3px solid #0D9488' : '3px solid transparent',
                      cursor: onRowClick ? 'pointer' : 'default',
                      transition: 'background-color 0.1s',
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = hoverBg)
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = rowBg)
                    }
                  >
                    {visibleHeaders.map((header, colIdx) => {
                      const isFirst = colIdx === 0;
                      const strVal = cellString(row[header]);
                      return (
                        <td
                          key={header}
                          style={{
                            padding: '9px 16px',
                            color: '#1F2937',
                            borderRight: '1px solid #E2E0D8',
                            maxWidth: isFirst ? 80 : 260,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            // Sticky first column
                            ...(isFirst && {
                              position: 'sticky',
                              left: 0,
                              backgroundColor: rowBg,
                              boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)',
                              zIndex: 1,
                              fontWeight: 600,
                              color: isSelected ? '#0D9488' : '#64748B',
                            }),
                          }}
                          title={strVal}
                        >
                          {isFirst ? strVal : <CellContent value={row[header]} />}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {/* Row count */}
        <p
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.8125rem',
            color: '#64748B',
            margin: 0,
          }}
        >
          {totalRows === 0
            ? 'No results'
            : `Showing ${startIdx + 1}–${endIdx} of ${totalRows} rows`}
          {search && rows.length !== totalRows && (
            <span style={{ color: '#9CA3AF' }}> (filtered from {rows.length})</span>
          )}
        </p>

        {/* Page controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <PageButton
            onClick={() => setPage(1)}
            disabled={safePage === 1}
            aria-label="First page"
          >
            «
          </PageButton>
          <PageButton
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            aria-label="Previous page"
          >
            ‹
          </PageButton>

          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.8125rem',
              color: '#1F2937',
              padding: '4px 10px',
              minWidth: 80,
              textAlign: 'center',
            }}
          >
            {safePage} / {totalPages}
          </span>

          <PageButton
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            aria-label="Next page"
          >
            ›
          </PageButton>
          <PageButton
            onClick={() => setPage(totalPages)}
            disabled={safePage === totalPages}
            aria-label="Last page"
          >
            »
          </PageButton>
        </div>
      </div>
    </div>
  );
}

// ---- Sub-components ----

interface PageButtonProps {
  onClick: () => void;
  disabled: boolean;
  'aria-label': string;
  children: React.ReactNode;
}

function PageButton({ onClick, disabled, children, ...rest }: PageButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      {...rest}
      style={{
        width: 32,
        height: 32,
        border: '1.5px solid #E2E0D8',
        borderRadius: 6,
        backgroundColor: disabled ? '#FAFBFF' : '#FFFFFF',
        color: disabled ? '#CBD5E1' : '#1F2937',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.875rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

interface SortIconProps {
  active: boolean;
  dir: SortDir;
}

function SortIcon({ active, dir }: SortIconProps) {
  return (
    <svg
      width="10"
      height="12"
      viewBox="0 0 10 12"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {/* Up arrow */}
      <path
        d="M5 1L5 11M5 1L2 4M5 1L8 4"
        stroke={active && dir === 'asc' ? '#0D9488' : '#CBD5E1'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: active && dir === 'desc' ? 'none' : undefined }}
      />
      {/* Down arrow */}
      <path
        d="M5 11L5 1M5 11L2 8M5 11L8 8"
        stroke={active && dir === 'desc' ? '#0D9488' : '#CBD5E1'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: active && dir === 'asc' ? 'none' : undefined }}
      />
    </svg>
  );
}
