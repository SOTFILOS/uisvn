import { useMemo } from 'react';
import { buildCardContent } from '../utils/fieldCategoriser';
import { readinessPct, readinessBucket } from '../utils/constants';
import type { ReadinessBucket } from '../utils/constants';

interface KanbanBoardProps {
  headers: string[];
  rows: Record<string, unknown>[];
  selectedRow: Record<string, unknown> | null;
  onRowClick: (row: Record<string, unknown>) => void;
}

type Bucket = ReadinessBucket;

const BUCKET_CONFIG: Record<ReadinessBucket, {
  label: string; color: string; bg: string; border: string; textColor: string;
}> = {
  'at-risk':   { label: 'At Risk',         color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', textColor: '#DC2626' },
  'attention': { label: 'Needs Attention', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', textColor: '#B45309' },
  'good':      { label: 'Good',            color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4', textColor: '#0F766E' },
  'on-track':  { label: 'On Track',        color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0', textColor: '#15803D' },
  'no-data':   { label: 'No Data',         color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0', textColor: '#64748B' },
};

const BUCKET_ORDER: ReadinessBucket[] = ['at-risk', 'attention', 'good', 'on-track', 'no-data'];


interface KanbanCardProps {
  headers: string[];
  row: Record<string, unknown>;
  isSelected: boolean;
  onClick: () => void;
  pct: number | null;
  bucket: ReadinessBucket;
}

function KanbanCard({ headers, row, isSelected, onClick, pct, bucket }: KanbanCardProps) {
  const c = buildCardContent(headers, row);
  const cfg = BUCKET_CONFIG[bucket];

  const detailSnippet = c.details
    .slice(0, 2)
    .map(d => d.value)
    .filter(v => v.length <= 40)
    .join(' · ');

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      style={{
        backgroundColor: '#FFFFFF',
        border: `1.5px solid ${isSelected ? cfg.color : '#E2E0D8'}`,
        borderRadius: 10,
        padding: '11px 13px',
        cursor: 'pointer',
        outline: 'none',
        boxShadow: isSelected
          ? `0 0 0 3px ${cfg.color}25, 0 4px 12px ${cfg.color}20`
          : '0 1px 4px rgba(0,0,0,0.05)',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = cfg.color;
          el.style.boxShadow = `0 4px 14px ${cfg.color}20`;
          el.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = '#E2E0D8';
          el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
          el.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* ID + Title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        {c.id && (
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.5625rem', fontWeight: 700,
            color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`,
            borderRadius: 4, padding: '1px 5px', flexShrink: 0, lineHeight: 1.6,
          }}>
            #{c.id}
          </span>
        )}
        <span style={{
          fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.8125rem', fontWeight: 600,
          color: '#0F172A', flex: 1,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
        }}>
          {c.title}
        </span>
      </div>

      {/* Detail snippet */}
      {detailSnippet && (
        <p style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.625rem',
          color: '#94A3B8', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {detailSnippet}
        </p>
      )}

      {/* Type badge */}
      {c.typeBadge && (
        <span style={{
          fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.5625rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: c.paletteColor.text, backgroundColor: c.paletteColor.bg,
          border: `1px solid ${c.paletteColor.border}`, borderRadius: 4,
          padding: '2px 7px', alignSelf: 'flex-start',
        }}>
          {c.typeBadge}
        </span>
      )}

      {/* Progress bar */}
      {pct !== null && (
        <div>
          <div style={{ height: 4, backgroundColor: '#F3F1EE', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              backgroundColor: cfg.color, borderRadius: 99,
            }} />
          </div>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.625rem',
            fontWeight: 700, color: cfg.color,
            display: 'block', marginTop: 3, textAlign: 'right',
          }}>
            {pct}%
          </span>
        </div>
      )}
    </div>
  );
}

export default function KanbanBoard({ headers, rows, selectedRow, onRowClick }: KanbanBoardProps) {
  const bucketed = useMemo(() => {
    const map = new Map<ReadinessBucket, Array<{ row: Record<string, unknown>; pct: number | null }>>();
    BUCKET_ORDER.forEach(b => map.set(b, []));
    for (const row of rows) {
      const pct = readinessPct(headers, row);
      const bucket = readinessBucket(pct);
      map.get(bucket)!.push({ row, pct });
    }
    return map;
  }, [headers, rows]);

  if (rows.length === 0) {
    return (
      <div style={{ padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontWeight: 600, color: '#64748B', margin: 0 }}>
          No data to display
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(5, minmax(200px, 1fr))',
      gap: 12,
      overflowX: 'auto',
      paddingBottom: 4,
    }}>
      {BUCKET_ORDER.map(bucket => {
        const items = bucketed.get(bucket)!;
        const cfg = BUCKET_CONFIG[bucket];
        return (
          <div key={bucket} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
            {/* Column header */}
            <div style={{
              backgroundColor: cfg.bg,
              border: `1px solid ${cfg.border}`,
              borderRadius: 10,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  backgroundColor: cfg.color, flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.75rem', fontWeight: 700,
                  color: cfg.textColor,
                }}>
                  {cfg.label}
                </span>
              </div>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 700,
                color: cfg.textColor, backgroundColor: '#FFFFFF',
                border: `1px solid ${cfg.border}`, borderRadius: 10, padding: '1px 7px',
              }}>
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 7,
              maxHeight: 'calc(100vh - 400px)',
              overflowY: 'auto',
              paddingRight: 2,
            }}>
              {items.map(({ row, pct }, idx) => (
                <KanbanCard
                  key={idx}
                  headers={headers}
                  row={row}
                  isSelected={row === selectedRow}
                  onClick={() => onRowClick(row)}
                  pct={pct}
                  bucket={bucket}
                />
              ))}
              {items.length === 0 && (
                <div style={{
                  border: '1.5px dashed #E2E0D8', borderRadius: 10,
                  padding: '24px 14px', textAlign: 'center',
                }}>
                  <span style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.75rem', color: '#CBD5E1' }}>
                    No projects
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
