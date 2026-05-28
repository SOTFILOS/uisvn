import { useMemo } from 'react';
import { readinessPct, readinessBucket } from '../utils/constants';
import type { ReadinessBucket } from '../utils/constants';
import { cellStr } from '../utils/fieldCategoriser';

interface DashboardProps {
  headers: string[];
  rows: Record<string, unknown>[];
  onRowClick: (row: Record<string, unknown>) => void;
}

type Bucket = ReadinessBucket;

interface ProjectStat {
  title: string;
  id: string;
  pct: number | null;
  bucket: Bucket;
  row: Record<string, unknown>;
}

interface Analytics {
  total: number;
  onTrack: number;
  good: number;
  attention: number;
  atRisk: number;
  noData: number;
  avgReadiness: number | null;
  projects: ProjectStat[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** cellStr centralized in ../utils/fieldCategoriser */

function inferTitle(headers: string[], row: Record<string, unknown>): string {
  for (const h of headers) {
    const v = cellStr(row[h]).trim();
    if (v && v.length > 1 && v.length <= 80 && isNaN(Number(v))) return v;
  }
  return 'Untitled';
}

function inferId(headers: string[], row: Record<string, unknown>): string {
  for (const h of headers) {
    const v = cellStr(row[h]).trim();
    const n = Number(v);
    if (v && !isNaN(n) && n > 0 && n < 1_000_000) return v;
  }
  return '';
}

function computeReadiness(headers: string[], row: Record<string, unknown>): number | null {
  return readinessPct(headers, row);
}

function getBucket(pct: number | null): Bucket {
  return readinessBucket(pct);
}

function computeAnalytics(headers: string[], rows: Record<string, unknown>[]): Analytics {
  let onTrack = 0, good = 0, attention = 0, atRisk = 0, noData = 0;
  let totalPct = 0, countWithData = 0;

  const projects: ProjectStat[] = rows.map((row) => {
    const pct = computeReadiness(headers, row);
    const bucket = getBucket(pct);
    if (bucket === 'on-track') onTrack++;
    else if (bucket === 'good') good++;
    else if (bucket === 'attention') attention++;
    else if (bucket === 'at-risk') atRisk++;
    else noData++;
    if (pct !== null) { totalPct += pct; countWithData++; }
    return { title: inferTitle(headers, row), id: inferId(headers, row), pct, bucket, row };
  });

  return {
    total: rows.length,
    onTrack, good, attention, atRisk, noData,
    avgReadiness: countWithData > 0 ? Math.round(totalPct / countWithData) : null,
    projects,
  };
}

const BUCKET_CONFIG: Record<Bucket, { label: string; color: string; lightBg: string; text: string }> = {
  'on-track':  { label: 'On Track',         color: '#22C55E', lightBg: '#F0FDF4', text: '#15803D' },
  'good':      { label: 'Good',             color: '#0D9488', lightBg: '#F0FDFA', text: '#0F766E' },
  'attention': { label: 'Needs Attention',  color: '#F59E0B', lightBg: '#FFFBEB', text: '#B45309' },
  'at-risk':   { label: 'At Risk',          color: '#EF4444', lightBg: '#FEF2F2', text: '#DC2626' },
  'no-data':   { label: 'No Data',          color: '#CBD5E1', lightBg: '#F8FAFC', text: '#64748B' },
};

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label, value, subLabel, accentColor, icon,
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  accentColor: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E0D8',
        borderRadius: 14,
        padding: '16px 18px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        flex: '1 1 0',
        minWidth: 120,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.6875rem', fontWeight: 600,
          color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          {label}
        </span>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          backgroundColor: accentColor + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '2rem', fontWeight: 700,
        color: '#0F172A', lineHeight: 1,
      }}>
        {value}
      </span>
      {subLabel && (
        <span style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.75rem', color: '#94A3B8' }}>
          {subLabel}
        </span>
      )}
      <div style={{ height: 3, background: accentColor, borderRadius: 99, marginTop: 6 }} />
    </div>
  );
}

// ── Multi-segment Donut Chart ─────────────────────────────────────────────────

function StatusDonut({ a }: { a: Analytics }) {
  const r = 52, sw = 11, cx = 70, cy = 70;
  const circum = 2 * Math.PI * r;
  const GAP = 4;

  const segments = [
    { count: a.onTrack,   color: '#22C55E', label: 'On Track' },
    { count: a.good,      color: '#0D9488', label: 'Good' },
    { count: a.attention, color: '#F59E0B', label: 'Needs Attention' },
    { count: a.atRisk,    color: '#EF4444', label: 'At Risk' },
    { count: a.noData,    color: '#CBD5E1', label: 'No Data' },
  ].filter(s => s.count > 0);

  let offset = 0;
  const arcs = segments.map(s => {
    const rawLen = (s.count / a.total) * circum;
    const len = Math.max(0, rawLen - GAP);
    const arc = { ...s, dashArray: `${len} ${circum}`, dashOffset: -(offset) };
    offset += rawLen;
    return arc;
  });

  const avgColor =
    a.avgReadiness === null ? '#94A3B8'
    : a.avgReadiness >= 70 ? '#22C55E'
    : a.avgReadiness >= 50 ? '#0D9488'
    : a.avgReadiness >= 30 ? '#F59E0B'
    : '#EF4444';

  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E2E0D8', borderRadius: 16,
      padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <p style={{
        fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.75rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8', margin: '0 0 16px 0',
      }}>
        Status Distribution
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        {/* Donut */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F1EE" strokeWidth={sw} />
            {arcs.map((arc, i) => (
              <circle
                key={i} cx={cx} cy={cy} r={r}
                fill="none" stroke={arc.color} strokeWidth={sw - 1}
                strokeDasharray={arc.dashArray}
                strokeDashoffset={arc.dashOffset}
                style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'all 0.4s ease' }}
              />
            ))}
          </svg>
          {/* Center label */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '1.5rem', fontWeight: 700,
              color: '#0F172A', lineHeight: 1,
            }}>
              {a.total}
            </span>
            <span style={{
              fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.5625rem', color: '#94A3B8',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3,
            }}>
              projects
            </span>
            {a.avgReadiness !== null && (
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', fontWeight: 700,
                color: avgColor, marginTop: 4,
              }}>
                {a.avgReadiness}% avg
              </span>
            )}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 140 }}>
          {[
            { key: 'on-track' as Bucket,  count: a.onTrack },
            { key: 'good' as Bucket,      count: a.good },
            { key: 'attention' as Bucket, count: a.attention },
            { key: 'at-risk' as Bucket,   count: a.atRisk },
            { key: 'no-data' as Bucket,   count: a.noData },
          ].filter(s => s.count > 0).map(({ key, count }) => {
            const cfg = BUCKET_CONFIG[key];
            const pct = Math.round((count / a.total) * 100);
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cfg.color, flexShrink: 0 }} />
                <span style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.8125rem', color: '#374151', flex: 1 }}>
                  {cfg.label}
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', fontWeight: 700, color: cfg.color,
                }}>
                  {count}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: '#CBD5E1', minWidth: 32 }}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Health Distribution Bar Chart ─────────────────────────────────────────────

function HealthBarChart({ a }: { a: Analytics }) {
  const bars = [
    { label: 'On Track', sublabel: '≥ 70%', count: a.onTrack,   color: '#22C55E' },
    { label: 'Good',     sublabel: '50–69%', count: a.good,      color: '#0D9488' },
    { label: 'Attention',sublabel: '30–49%', count: a.attention, color: '#F59E0B' },
    { label: 'At Risk',  sublabel: '< 30%',  count: a.atRisk,    color: '#EF4444' },
    { label: 'No Data',  sublabel: 'N/A',    count: a.noData,    color: '#CBD5E1' },
  ].filter(b => b.count > 0);

  const maxCount = Math.max(...bars.map(b => b.count), 1);

  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E2E0D8', borderRadius: 16,
      padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <p style={{
        fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.75rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8', margin: '0 0 20px 0',
      }}>
        Health Score Distribution
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {bars.map(bar => {
          const widthPct = (bar.count / maxCount) * 100;
          return (
            <div key={bar.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
                    {bar.label}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', color: '#94A3B8' }}>
                    {bar.sublabel}
                  </span>
                </div>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem', fontWeight: 700, color: bar.color,
                }}>
                  {bar.count}
                </span>
              </div>
              <div style={{ height: 8, backgroundColor: '#F3F1EE', borderRadius: 99, overflow: 'hidden' }}>
                <div
                  className="progress-bar"
                  style={{
                    height: '100%', width: `${widthPct}%`,
                    backgroundColor: bar.color, borderRadius: 99,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Needs Attention Table ─────────────────────────────────────────────────────

function NeedsAttentionPanel({
  a,
  onRowClick,
}: {
  a: Analytics;
  onRowClick: (row: Record<string, unknown>) => void;
}) {
  const flagged = a.projects
    .filter(p => p.bucket === 'at-risk' || p.bucket === 'attention')
    .sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1))
    .slice(0, 10);

  if (flagged.length === 0) return null;

  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E2E0D8', borderRadius: 16,
      overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid #F3F1EE',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'linear-gradient(90deg, #FFFBEB 0%, #FFFFFF 100%)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF3C7',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1L13 12H1L7 1Z" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M7 5v3M7 10v.5" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: '#0F172A', margin: 0 }}>
            Projects Needing Attention
          </p>
          <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.75rem', color: '#94A3B8', margin: 0 }}>
            {flagged.length} project{flagged.length !== 1 ? 's' : ''} below 50% readiness
          </p>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#F9F8F6', borderBottom: '1px solid #E2E0D8' }}>
              {['Project', 'Status', 'Readiness', 'Score'].map(h => (
                <th key={h} style={{
                  padding: '8px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.6875rem',
                  color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flagged.map((p, i) => {
              const cfg = BUCKET_CONFIG[p.bucket];
              return (
                <tr
                  key={i}
                  onClick={() => onRowClick(p.row)}
                  style={{
                    borderBottom: '1px solid #F3F1EE', cursor: 'pointer',
                    backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#F3F1EE')}
                  onMouseLeave={e => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = i % 2 === 0 ? '#FFFFFF' : '#FAFAFA')}
                >
                  {/* Project */}
                  <td style={{ padding: '10px 16px', maxWidth: 280 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {p.id && (
                        <span style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.625rem', fontWeight: 700,
                          color: cfg.color, backgroundColor: cfg.lightBg,
                          border: `1px solid ${cfg.color}30`, borderRadius: 4, padding: '1px 6px', flexShrink: 0,
                        }}>#{p.id}</span>
                      )}
                      <span style={{
                        fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontWeight: 600, color: '#0F172A',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.title}
                      </span>
                    </div>
                  </td>
                  {/* Status */}
                  <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      backgroundColor: cfg.lightBg, color: cfg.text,
                      border: `1px solid ${cfg.color}40`, borderRadius: 6,
                      padding: '3px 8px', fontWeight: 600, fontSize: '0.6875rem',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.color }} />
                      {cfg.label}
                    </span>
                  </td>
                  {/* Bar */}
                  <td style={{ padding: '10px 16px', minWidth: 120 }}>
                    <div style={{ height: 6, backgroundColor: '#F3F1EE', borderRadius: 99, overflow: 'hidden', width: 100 }}>
                      <div style={{
                        height: '100%', width: `${p.pct ?? 0}%`,
                        backgroundColor: cfg.color, borderRadius: 99,
                      }} />
                    </div>
                  </td>
                  {/* Score */}
                  <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.875rem', fontWeight: 700, color: cfg.color,
                    }}>
                      {p.pct !== null ? `${p.pct}%` : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── On-Track Showcase ─────────────────────────────────────────────────────────

function OnTrackPanel({ a, onRowClick }: { a: Analytics; onRowClick: (row: Record<string, unknown>) => void }) {
  const top = a.projects
    .filter(p => p.bucket === 'on-track')
    .sort((x, y) => (y.pct ?? 0) - (x.pct ?? 0))
    .slice(0, 5);

  if (top.length === 0) return null;

  return (
    <div style={{
      backgroundColor: '#FFFFFF', border: '1px solid #E2E0D8', borderRadius: 16,
      overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid #F3F1EE',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'linear-gradient(90deg, #F0FDF4 0%, #FFFFFF 100%)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, backgroundColor: '#DCFCE7',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="7" cy="7" r="6" stroke="#22C55E" strokeWidth="1.5" />
            <path d="M4 7l2 2 4-4" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: '#0F172A', margin: 0 }}>
            Top Performers
          </p>
          <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.75rem', color: '#94A3B8', margin: 0 }}>
            Highest readiness scores
          </p>
        </div>
      </div>
      <div style={{ padding: '8px 0' }}>
        {top.map((p, i) => (
          <div
            key={i}
            onClick={() => onRowClick(p.row)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 20px', cursor: 'pointer', transition: 'background 0.1s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = '#F0FDF4')}
            onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent')}
          >
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem', fontWeight: 700,
              color: '#94A3B8', width: 16, textAlign: 'right', flexShrink: 0,
            }}>{i + 1}</span>
            <span style={{
              fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.875rem', fontWeight: 600,
              color: '#0F172A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {p.title}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 60, height: 5, backgroundColor: '#F3F1EE', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${p.pct ?? 0}%`, backgroundColor: '#22C55E', borderRadius: 99 }} />
              </div>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', fontWeight: 700, color: '#22C55E', minWidth: 32,
              }}>
                {p.pct}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyDashboard() {
  return (
    <div style={{ padding: '80px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
        <rect width="56" height="56" rx="16" fill="#EEF0F8" />
        <path d="M14 38V28M22 38V20M30 38V24M38 38V14" stroke="#C7D2FE" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontWeight: 600, color: '#64748B', margin: 0 }}>
        No data to analyse
      </p>
      <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.875rem', color: '#94A3B8', margin: 0 }}>
        Import an Excel file to see the dashboard
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Dashboard({ headers, rows, onRowClick }: DashboardProps) {
  const a = useMemo(() => computeAnalytics(headers, rows), [headers, rows]);

  if (rows.length === 0) return <EmptyDashboard />;

  const healthLabel =
    a.avgReadiness === null ? 'No readiness data'
    : a.avgReadiness >= 70 ? 'Portfolio is On Track'
    : a.avgReadiness >= 50 ? 'Portfolio is performing well'
    : a.avgReadiness >= 30 ? 'Portfolio needs attention'
    : 'Portfolio is at risk';

  return (
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Health banner ── */}
      {a.avgReadiness !== null && (
        <div style={{
          padding: '12px 20px',
          borderRadius: 12,
          background: a.avgReadiness >= 70
            ? 'linear-gradient(135deg, #F0FDF4, #ECFDF5)'
            : a.avgReadiness >= 50
            ? 'linear-gradient(135deg, #F0FDFA, #ECFDF5)'
            : a.avgReadiness >= 30
            ? 'linear-gradient(135deg, #FFFBEB, #FEF9C3)'
            : 'linear-gradient(135deg, #FEF2F2, #FFF1F2)',
          border: `1px solid ${a.avgReadiness >= 70 ? '#BBF7D0' : a.avgReadiness >= 50 ? '#99F6E4' : a.avgReadiness >= 30 ? '#FDE68A' : '#FECACA'}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '1.25rem', fontWeight: 700,
            color: a.avgReadiness >= 70 ? '#15803D' : a.avgReadiness >= 50 ? '#0F766E' : a.avgReadiness >= 30 ? '#B45309' : '#DC2626',
          }}>
            {a.avgReadiness}%
          </span>
          <div>
            <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontWeight: 700, fontSize: '0.875rem', color: '#0F172A', margin: 0 }}>
              {healthLabel}
            </p>
            <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.75rem', color: '#64748B', margin: 0 }}>
              Average readiness across {a.total} projects
            </p>
          </div>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KPICard
          label="Total Projects" value={a.total}
          subLabel="in this sheet"
          accentColor="#4F46E5"
          icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="4" rx="1.2" fill="#4F46E5"/><rect x="8" y="1" width="5" height="4" rx="1.2" fill="#4F46E5" fillOpacity="0.4"/><rect x="1" y="7" width="5" height="4" rx="1.2" fill="#4F46E5" fillOpacity="0.4"/><rect x="8" y="7" width="5" height="4" rx="1.2" fill="#4F46E5" fillOpacity="0.2"/></svg>}
        />
        <KPICard
          label="On Track" value={a.onTrack}
          subLabel={`${a.total > 0 ? Math.round((a.onTrack / a.total) * 100) : 0}% of portfolio`}
          accentColor="#22C55E"
          icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#22C55E" strokeWidth="1.5"/><path d="M4 7l2 2 4-4" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
        <KPICard
          label="Needs Attention" value={a.attention}
          subLabel="30–69% readiness"
          accentColor="#F59E0B"
          icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L13 12H1L7 1Z" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round"/><path d="M7 5v3M7 10v.5" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        />
        <KPICard
          label="At Risk" value={a.atRisk}
          subLabel="below 30% readiness"
          accentColor="#EF4444"
          icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#EF4444" strokeWidth="1.5"/><path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        />
        <KPICard
          label="No Status" value={a.noData}
          subLabel="no Y/N flags found"
          accentColor="#94A3B8"
          icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#94A3B8" strokeWidth="1.5"/><path d="M7 4v3.5L9 9" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
      </div>

      {/* ── Charts Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <StatusDonut a={a} />
        <HealthBarChart a={a} />
      </div>

      {/* ── Detail panels ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
        <NeedsAttentionPanel a={a} onRowClick={onRowClick} />
        <OnTrackPanel a={a} onRowClick={onRowClick} />
      </div>

    </div>
  );
}
