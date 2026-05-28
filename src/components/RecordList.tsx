import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import {
  cellStr,
  cleanLabel,
  buildCardContent,
  type PaletteColor,
} from '../utils/fieldCategoriser';
import { DOC_COL_HEADER } from '../utils/constants';

interface RecordListProps {
  headers: string[];
  rows: Record<string, unknown>[];
  selectedRow: Record<string, unknown> | null;
  onRowClick: (row: Record<string, unknown>) => void;
}

const PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

type CardSize = 'S' | 'M' | 'L';
type ListMode = 'grid' | 'compact';

// ── Chip atoms ────────────────────────────────────────────────────────────────

function SystemChip({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        backgroundColor: '#EEF0F8', border: '1px solid #C7D2FE',
        borderRadius: 6, padding: '2px 8px',
        fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.625rem', fontWeight: 600,
        color: '#6366F1', whiteSpace: 'nowrap',
      }}
    >
      <svg width="5" height="5" viewBox="0 0 6 6" fill="none" aria-hidden="true">
        <circle cx="3" cy="3" r="3" fill="#4F46E5" />
      </svg>
      {label}
    </span>
  );
}

function StatusChip({ label, isYes }: { label: string; isYes: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        backgroundColor: isYes ? '#F0FDF4' : '#FFF7ED',
        border: `1px solid ${isYes ? '#BBF7D0' : '#FED7AA'}`,
        borderRadius: 6, padding: '2px 8px',
        fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.625rem', fontWeight: 600,
        color: isYes ? '#16A34A' : '#C2410C', whiteSpace: 'nowrap',
      }}
    >
      {isYes ? '✓' : '✗'} {label}
    </span>
  );
}

function TypeBadge({ value, color }: { value: string; color: PaletteColor }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center',
        backgroundColor: color.bg, border: `1px solid ${color.border}`,
        borderRadius: 6, padding: '3px 10px',
        fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.625rem', fontWeight: 700,
        color: color.text, whiteSpace: 'nowrap',
        letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0,
      }}
    >
      {value}
    </span>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ReadinessBar({ pct }: { pct: number }) {
  const color =
    pct >= 70
      ? { bar: 'linear-gradient(90deg, #059669, #34D399)', text: '#059669' }
      : pct >= 40
      ? { bar: 'linear-gradient(90deg, #D97706, #FCD34D)', text: '#D97706' }
      : { bar: 'linear-gradient(90deg, #E11D48, #FB7185)', text: '#E11D48' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{
          fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.5625rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.09em', color: '#94A3B8',
        }}>
          Readiness
        </span>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem',
          fontWeight: 700, color: color.text,
        }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 5, backgroundColor: '#EEF0F8', borderRadius: 99, overflow: 'hidden' }}>
        <div
          className="progress-bar"
          style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: color.bar }}
        />
      </div>
    </div>
  );
}

// ── Single record card ────────────────────────────────────────────────────────

interface RecordCardProps {
  headers: string[];
  row: Record<string, unknown>;
  isSelected: boolean;
  onClick: () => void;
  index: number;
  cardSize: CardSize;
  hiddenFields: Set<string>;
}

function RecordCard({ headers, row, isSelected, onClick, index, cardSize, hiddenFields }: RecordCardProps) {
  const c = buildCardContent(headers, row, hiddenFields);
  const accent = c.paletteColor.accent;
  const border = c.paletteColor.border;

  const totalFlags = c.yesChips.length + c.noChips.length;
  const progressPct = totalFlags > 0 ? Math.round((c.yesChips.length / totalFlags) * 100) : null;

  const detailLine = c.details
    .map((d) => d.value)
    .filter((v) => v.length <= 50)
    .slice(0, 4)
    .join('  ·  ');

  const hasChips =
    c.systemChips.length > 0 || c.yesChips.length > 0 ||
    c.noChips.length > 0 || c.links.length > 0;

  const docUrl = cellStr((row as any)[DOC_COL_HEADER]).trim();
  const showDocChip = !!docUrl && !hiddenFields.has(DOC_COL_HEADER);

  const showDetails = cardSize !== 'S' && Boolean(detailLine);
  const showChips = cardSize === 'L' && hasChips;
  const showFooter = cardSize === 'L' && c.systemChips.length > 0;

  const bodyPadding = cardSize === 'S' ? '12px 14px 14px' : '16px 18px 18px';
  const bodyGap = cardSize === 'S' ? 8 : 12;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      style={{
        backgroundColor: '#FFFFFF',
        border: `1.5px solid ${isSelected ? border : '#E2E0D8'}`,
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.18s ease, box-shadow 0.22s ease, transform 0.18s cubic-bezier(0.2,0,0,1)',
        animation: `cardIn 0.32s cubic-bezier(0.2,0,0,1) ${Math.min(index, 12) * 40}ms both`,
        boxShadow: isSelected
          ? `0 0 0 3px ${accent}25, 0 8px 28px -4px ${accent}30`
          : '0 2px 8px rgba(0,0,0,0.05)',
        outline: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = 'translateY(-3px)';
          el.style.boxShadow = `0 12px 36px -6px ${accent}40, 0 4px 14px -2px rgba(0,0,0,0.07)`;
          el.style.borderColor = border;
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = '0 1px 8px rgba(0,0,0,0.05)';
          el.style.borderColor = '#E2E0D8';
        }
      }}
    >
      {/* Accent strip */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${accent} 0%, ${accent}60 100%)`, flexShrink: 0 }} />

      {/* Card body */}
      <div style={{ padding: bodyPadding, display: 'flex', flexDirection: 'column', gap: bodyGap, flex: 1 }}>
        {/* Row 1: ID + Title + Type badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            {c.id && (
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.625rem', fontWeight: 700,
                color: accent, backgroundColor: c.paletteColor.bg,
                border: `1px solid ${border}`, borderRadius: 5,
                padding: '2px 7px', flexShrink: 0, letterSpacing: '0.03em',
              }}>
                #{c.id}
              </span>
            )}
            <span style={{
              fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.9375rem', fontWeight: 700,
              color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              {c.title}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {c.typeBadge && <TypeBadge value={c.typeBadge} color={c.paletteColor} />}
            {showDocChip && (
              <a
                href={docUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  backgroundColor: '#EEF0F8', border: '1px solid #E2E0D8',
                  borderRadius: 6, padding: '2px 8px',
                  fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.625rem', fontWeight: 600,
                  color: '#4F46E5', textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                Docs ↗
              </a>
            )}
          </div>
        </div>

        {/* Detail sub-line */}
        {showDetails && (
          <p style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: '#94A3B8', margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {detailLine}
          </p>
        )}

        {/* Readiness bar */}
        {progressPct !== null && <ReadinessBar pct={progressPct} />}

        {/* Chips – only in L mode */}
        {showChips && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            {c.systemChips.map((chip) => <SystemChip key={chip} label={chip} />)}
            {c.systemChips.length > 0 && (c.yesChips.length > 0 || c.noChips.length > 0) && (
              <span aria-hidden="true" style={{
                display: 'inline-block', width: 1, height: 12,
                backgroundColor: '#E2E0D8', marginInline: 2, flexShrink: 0,
              }} />
            )}
            {c.yesChips.map((chip) => <StatusChip key={chip} label={chip} isYes={true} />)}
            {c.noChips.map((chip) => <StatusChip key={chip} label={chip} isYes={false} />)}
            {c.links.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  backgroundColor: '#EEF0F8', border: '1px solid #E2E0D8',
                  borderRadius: 6, padding: '2px 8px',
                  fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.625rem', fontWeight: 600,
                  color: '#4F46E5', textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                {link.label} ↗
              </a>
            ))}
          </div>
        )}

        {/* Footer – only in L mode */}
        {showFooter && (
          <div style={{
            marginTop: 'auto', paddingTop: 10, borderTop: '1px solid #E2E0D8',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="4" height="4" rx="1" fill="#94A3B8" />
              <rect x="7" y="1" width="4" height="4" rx="1" fill="#94A3B8" fillOpacity="0.5" />
              <rect x="1" y="7" width="4" height="4" rx="1" fill="#94A3B8" fillOpacity="0.5" />
              <rect x="7" y="7" width="4" height="4" rx="1" fill="#94A3B8" fillOpacity="0.3" />
            </svg>
            <span style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.6875rem', color: '#94A3B8' }}>
              {c.systemChips.length} system{c.systemChips.length !== 1 ? 's' : ''} affected
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Compact row ───────────────────────────────────────────────────────────────

function CompactRow({
  headers,
  row,
  isSelected,
  onClick,
}: {
  headers: string[];
  row: Record<string, unknown>;
  isSelected: boolean;
  onClick: () => void;
}) {
  const c = buildCardContent(headers, row);
  const totalFlags = c.yesChips.length + c.noChips.length;
  const pct = totalFlags > 0 ? Math.round((c.yesChips.length / totalFlags) * 100) : null;
  const barColor =
    pct === null ? '#E2E0D8'
    : pct >= 70 ? '#22C55E'
    : pct >= 40 ? '#F59E0B'
    : '#EF4444';

  const detailItems = c.details.filter((d) => d.value.length <= 60).slice(0, 5);
  const docUrl = cellStr((row as any)[DOC_COL_HEADER]).trim();

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        padding: '12px 16px',
        backgroundColor: isSelected ? '#EBF5F5' : '#FFFFFF',
        borderLeft: `3px solid ${isSelected ? '#0D9488' : 'transparent'}`,
        borderBottom: '1px solid #F3F1EE',
        cursor: 'pointer', transition: 'background 0.12s', outline: 'none',
      }}
      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = '#F7F5F2'; }}
      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = '#FFFFFF'; }}
    >
      {/* Top row: dot + ID + title + type + readiness */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.paletteColor.accent, flexShrink: 0 }} />
        {c.id && (
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.625rem', fontWeight: 700,
            color: c.paletteColor.accent, backgroundColor: c.paletteColor.bg,
            border: `1px solid ${c.paletteColor.border}`, borderRadius: 4,
            padding: '1px 6px', flexShrink: 0,
          }}>
            #{c.id}
          </span>
        )}
        <span style={{
          fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '1rem', fontWeight: 700,
          color: '#0F172A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {c.title}
        </span>
        {c.typeBadge && (
          <span style={{
            fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.5625rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.04em',
            color: c.paletteColor.text, backgroundColor: c.paletteColor.bg,
            border: `1px solid ${c.paletteColor.border}`, borderRadius: 4,
            padding: '2px 7px', flexShrink: 0,
          }}>
            {c.typeBadge}
          </span>
        )}
        {docUrl && (
          <a
            href={docUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              backgroundColor: '#EEF0F8', border: '1px solid #E2E0D8',
              borderRadius: 6, padding: '2px 8px',
              fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.6875rem', fontWeight: 600,
              color: '#4F46E5', textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            Docs ↗
          </a>
        )}
        {pct !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ width: 90, height: 5, backgroundColor: '#F3F1EE', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, backgroundColor: barColor, borderRadius: 99 }} />
            </div>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem',
              fontWeight: 700, color: barColor, minWidth: 32,
            }}>
              {pct}%
            </span>
          </div>
        )}
      </div>

      {/* Bottom row: detail fields + yes/no summary */}
      {(detailItems.length > 0 || totalFlags > 0 || c.systemChips.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingLeft: 18, flexWrap: 'wrap' }}>
          {detailItems.map((d) => (
            <span key={d.label} style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#94A3B8',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200,
            }}>
              <span style={{ color: '#94A3B8', fontWeight: 600 }}>{d.label}:</span>{' '}
              <span style={{ color: '#1E293B', fontWeight: 700 }}>{d.value}</span>
            </span>
          ))}
          {totalFlags > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', fontWeight: 700,
                color: '#16A34A',
              }}>
                ✓ {c.yesChips.length}
              </span>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', fontWeight: 700,
                color: '#C2410C',
              }}>
                ✗ {c.noChips.length}
              </span>
            </span>
          )}
          {c.systemChips.length > 0 && (
            <span style={{
              fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.6875rem', color: '#6366F1',
              backgroundColor: '#EEF0F8', border: '1px solid #C7D2FE',
              borderRadius: 4, padding: '1px 7px', flexShrink: 0,
            }}>
              {c.systemChips.length} {c.systemChips.length === 1 ? 'system' : 'systems'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <div style={{ padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, color: '#94A3B8' }}>
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
        <rect width="52" height="52" rx="16" fill="#EEF0F8" />
        <path d="M14 20h24M14 26h16M14 32h10" stroke="#C7D2FE" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontWeight: 600, color: '#64748B', margin: 0 }}>
        {isFiltered ? 'No records match your search' : 'No data to display'}
      </p>
      {isFiltered && (
        <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.875rem', margin: 0 }}>
          Try a different search term
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RecordList({
  headers,
  rows,
  selectedRow,
  onRowClick,
}: RecordListProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(12);
  const [listMode, setListMode] = useState<ListMode>('compact');
  const [cardSize, setCardSize] = useState<CardSize>('L');
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(new Set());
  const [fieldPanelOpen, setFieldPanelOpen] = useState(false);
  const fieldBtnRef = useRef<HTMLButtonElement>(null);
  const fieldPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHiddenFields(new Set()); }, [headers]);

  useEffect(() => {
    if (!fieldPanelOpen) return;
    const handle = (e: MouseEvent) => {
      if (
        fieldBtnRef.current && !fieldBtnRef.current.contains(e.target as Node) &&
        fieldPanelRef.current && !fieldPanelRef.current.contains(e.target as Node)
      ) setFieldPanelOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [fieldPanelOpen]);

  const toggleHiddenField = useCallback((h: string) => {
    setHiddenFields(prev => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h); else next.add(h);
      return next;
    });
  }, []);

  const handleSearch = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const lower = search.toLowerCase();
    return rows.filter((row) =>
      headers.some((h) => cellStr(row[h]).toLowerCase().includes(lower))
    );
  }, [rows, headers, search]);

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalRows);
  const visibleRows = filteredRows.slice(startIdx, endIdx);

  if (headers.length === 0) return <EmptyState isFiltered={false} />;

  const gridMinWidth = cardSize === 'S' ? 220 : cardSize === 'M' ? 280 : 340;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="5" stroke="#94A3B8" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search" value={search} onChange={handleSearch}
            placeholder="Search projects…" aria-label="Search projects"
            style={{
              width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
              border: '1.5px solid #E2E0D8', borderRadius: 10,
              fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.875rem', color: '#0F172A',
              backgroundColor: '#F3F1EE', outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.12)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#E2E0D8'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>

        {/* Per page */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <label htmlFor="rpl-page-size"
            style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.8125rem', color: '#64748B', whiteSpace: 'nowrap' }}>
            Per page
          </label>
          <select
            id="rpl-page-size" value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value) as PageSize); setPage(1); }}
            style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem',
              border: '1.5px solid #E2E0D8', borderRadius: 8, padding: '6px 10px',
              backgroundColor: '#FFFFFF', color: '#0F172A', cursor: 'pointer', outline: 'none',
            }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Count badge */}
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem',
          color: '#4F46E5', backgroundColor: '#EEF0F8', border: '1px solid #C7D2FE',
          borderRadius: 20, padding: '4px 12px', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {totalRows} project{totalRows !== 1 ? 's' : ''}
        </span>

        {/* S / M / L size – grid mode only */}
        {listMode === 'grid' && (
          <div style={{ display: 'flex', border: '1.5px solid #E2E0D8', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            {(['S', 'M', 'L'] as CardSize[]).map(size => (
              <button
                key={size}
                onClick={() => setCardSize(size)}
                aria-pressed={cardSize === size}
                title={size === 'S' ? 'Small cards' : size === 'M' ? 'Medium cards' : 'Full cards'}
                style={{
                  width: 32, height: 30, border: 'none',
                  backgroundColor: cardSize === size ? '#4F46E5' : '#FFFFFF',
                  color: cardSize === size ? '#FFFFFF' : '#94A3B8',
                  cursor: cardSize === size ? 'default' : 'pointer',
                  fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.75rem', fontWeight: 700,
                  transition: 'all 0.15s',
                }}
              >
                {size}
              </button>
            ))}
          </div>
        )}

        {/* Fields picker – grid mode only */}
        {listMode === 'grid' && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              ref={fieldBtnRef}
              onClick={() => setFieldPanelOpen(p => !p)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px',
                border: hiddenFields.size > 0 ? '1.5px solid #4F46E5' : '1.5px solid #E2E0D8',
                borderRadius: 8,
                backgroundColor: hiddenFields.size > 0 ? '#EEF0F8' : '#FFFFFF',
                color: hiddenFields.size > 0 ? '#4F46E5' : '#64748B',
                fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.8125rem',
                fontWeight: hiddenFields.size > 0 ? 600 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.93 2.93l1.41 1.41M9.66 9.66l1.41 1.41M2.93 11.07l1.41-1.41M9.66 4.34l1.41-1.41"
                  stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Fields
              {hiddenFields.size > 0 && (
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem',
                  backgroundColor: '#4F46E5', color: '#FFFFFF',
                  borderRadius: 10, padding: '1px 7px',
                }}>
                  {hiddenFields.size} hidden
                </span>
              )}
            </button>

            {fieldPanelOpen && (
              <div
                ref={fieldPanelRef}
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  width: 240, maxHeight: 320, overflowY: 'auto',
                  backgroundColor: '#FFFFFF', border: '1px solid #E2E0D8',
                  borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', zIndex: 50,
                }}
              >
                <div style={{
                  padding: '10px 14px', borderBottom: '1px solid #F3F1EE',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.75rem', fontWeight: 600, color: '#374151' }}>
                    Show / Hide Fields
                  </span>
                  {hiddenFields.size > 0 && (
                    <button
                      onClick={() => setHiddenFields(new Set())}
                      style={{
                        fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.6875rem', color: '#4F46E5',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600,
                      }}
                    >
                      Show all
                    </button>
                  )}
                </div>
                {headers.map(h => {
                  const isVisible = !hiddenFields.has(h);
                  return (
                    <label
                      key={h}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px',
                        cursor: 'pointer', transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLLabelElement).style.backgroundColor = '#F7F5F2')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLLabelElement).style.backgroundColor = 'transparent')}
                    >
                      <input
                        type="checkbox" checked={isVisible}
                        onChange={() => toggleHiddenField(h)}
                        style={{ accentColor: '#4F46E5', width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem',
                        color: isVisible ? '#1F2937' : '#94A3B8',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {cleanLabel(h)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Grid / Compact toggle */}
        <div style={{ display: 'flex', border: '1.5px solid #E2E0D8', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          {(['grid', 'compact'] as ListMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setListMode(mode)}
              aria-pressed={listMode === mode}
              title={mode === 'grid' ? 'Card grid' : 'Compact list'}
              style={{
                width: 32, height: 30, border: 'none',
                backgroundColor: listMode === mode ? '#4F46E5' : '#FFFFFF',
                color: listMode === mode ? '#FFFFFF' : '#94A3B8',
                cursor: listMode === mode ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              {mode === 'grid' ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="1" y="1" width="5" height="4" rx="1.5" fill="currentColor" />
                  <rect x="8" y="1" width="5" height="4" rx="1.5" fill="currentColor" fillOpacity="0.4" />
                  <rect x="1" y="7" width="5" height="4" rx="1.5" fill="currentColor" fillOpacity="0.4" />
                  <rect x="8" y="7" width="5" height="4" rx="1.5" fill="currentColor" fillOpacity="0.4" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="1" y="1" width="12" height="2.5" rx="1" fill="currentColor" />
                  <rect x="1" y="5.5" width="12" height="2.5" rx="1" fill="currentColor" fillOpacity="0.6" />
                  <rect x="1" y="10" width="12" height="2.5" rx="1" fill="currentColor" fillOpacity="0.3" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      {visibleRows.length === 0 ? (
        <EmptyState isFiltered={search.trim().length > 0} />
      ) : listMode === 'grid' ? (
        <div
          role="list"
          aria-label="Projects"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${gridMinWidth}px, 1fr))`,
            gap: cardSize === 'S' ? 10 : 16,
          }}
        >
          {visibleRows.map((row, idx) => (
            <div key={idx} role="listitem">
              <RecordCard
                headers={headers}
                row={row}
                isSelected={row === selectedRow}
                onClick={() => onRowClick(row)}
                index={idx}
                cardSize={cardSize}
                hiddenFields={hiddenFields}
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          role="list"
          aria-label="Projects"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E0D8', borderRadius: 12, overflow: 'hidden' }}
        >
          {visibleRows.map((row, idx) => (
            <div key={idx} role="listitem">
              <CompactRow
                headers={headers}
                row={row}
                isSelected={row === selectedRow}
                onClick={() => onRowClick(row)}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem', color: '#64748B', margin: 0 }}>
          {totalRows === 0 ? 'No results' : `${startIdx + 1}–${endIdx} of ${totalRows} records`}
          {search && rows.length !== totalRows && (
            <span style={{ color: '#94A3B8' }}> (filtered from {rows.length})</span>
          )}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <PgBtn onClick={() => setPage(1)} disabled={safePage === 1} label="First">«</PgBtn>
          <PgBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} label="Prev">‹</PgBtn>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem', color: '#1F2937',
            padding: '4px 14px', minWidth: 72, textAlign: 'center',
            backgroundColor: '#FAFBFF', border: '1.5px solid #E2E0D8', borderRadius: 8,
          }}>
            {safePage} / {totalPages}
          </span>
          <PgBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} label="Next">›</PgBtn>
          <PgBtn onClick={() => setPage(totalPages)} disabled={safePage === totalPages} label="Last">»</PgBtn>
        </div>
      </div>
    </div>
  );
}

function PgBtn({
  onClick, disabled, label, children,
}: { onClick: () => void; disabled: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick} disabled={disabled} aria-label={label}
      style={{
        width: 32, height: 32, border: '1.5px solid #E2E0D8', borderRadius: 8,
        backgroundColor: disabled ? '#F8FAFC' : '#FFFFFF',
        color: disabled ? '#CBD5E1' : '#1F2937',
        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#4F46E5';
          (e.currentTarget as HTMLButtonElement).style.color = '#4F46E5';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0';
          (e.currentTarget as HTMLButtonElement).style.color = '#1F2937';
        }
      }}
    >
      {children}
    </button>
  );
}

/** Compact key-value display */
export function KvLine({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#94A3B8' }}>
      {cleanLabel(label)}:{' '}
      <span style={{ color: '#374151' }}>{value}</span>
    </span>
  );
}
