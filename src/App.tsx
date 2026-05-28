import { useState, useCallback, useEffect, useMemo } from 'react';
import SheetSelector from './components/SheetSelector';
import DataTable from './components/DataTable';
import RecordList from './components/RecordList';
import ExportSummary from './components/ExportSummary';
import RowDrawer from './components/RowDrawer';
import UploadPreview from './components/UploadPreview';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import KanbanBoard from './components/KanbanBoard';
import LandingPage from './components/LandingPage';
import { useExcelParser } from './hooks/useExcelParser';
import { cellStr } from './utils/fieldCategoriser';
import { enrichRows, getUniquePMs } from './utils/projectAnalytics';
import { applyValidation } from './utils/rowValidation';
import { readinessPct } from './utils/constants';
import { ensureDocHeader, annotateRowsWithDocUrlInPlace, rowHasDocumentation } from './utils/docUtils';
/** Keep only rows whose type column value is exactly "Project" (case-insensitive). */
function filterProjectRows(
  headers: string[],
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  const typeHeader = headers.find((h) => {
    const lo = h.toLowerCase();
    return lo.includes('type') || lo.includes('category') || lo.includes('kind');
  });
  if (!typeHeader) return rows;
  return rows.filter(
    (row) => cellStr(row[typeHeader]).trim().toLowerCase() === 'project'
  );
}

type ViewMode = 'cards' | 'table' | 'kanban';
type ReadinessFilter = 'all' | 'on-track' | 'at-risk' | 'no-status';
type DashboardView = 'data' | 'analytics';
type DocFilter = 'all' | 'has-docs' | 'no-docs';


 // Documentation helpers centralized in utils/docUtils.ts

const FILTER_OPTIONS: { key: ReadinessFilter; label: string; dotColor?: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'on-track', label: 'On Track', dotColor: '#22C55E' },
  { key: 'at-risk', label: 'At Risk', dotColor: '#EF4444' },
  { key: 'no-status', label: 'No Status' },
];

function FilterBar({
  active,
  onChange,
  counts,
}: {
  active: ReadinessFilter;
  onChange: (f: ReadinessFilter) => void;
  counts: Record<ReadinessFilter, number>;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {FILTER_OPTIONS.map(({ key, label, dotColor }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 14px',
              borderRadius: 20,
              border: isActive ? '1.5px solid #4F46E5' : '1.5px solid #E2E0D8',
              backgroundColor: isActive ? '#4F46E5' : '#FFFFFF',
              color: isActive ? '#FFFFFF' : '#64748B',
              fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
              fontSize: '0.8125rem',
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {dotColor && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.8)' : dotColor,
                  flexShrink: 0,
                }}
              />
            )}
            {label}
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.6875rem',
                backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#F3F1EE',
                borderRadius: 10,
                padding: '1px 7px',
                color: isActive ? '#FFFFFF' : '#94A3B8',
                minWidth: 18,
                textAlign: 'center',
              }}
            >
              {counts[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface ProjectStats {
  total: number;
  avgReadiness: number | null;
  green: number;
  red: number;
}

// ── Header stat pill ──────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  valueColor,
  dotColor,
  delay = 0,
}: {
  label: string;
  value: string | number;
  valueColor: string;
  dotColor?: string;
  delay?: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '6px 20px',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {dotColor && (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: dotColor,
              flexShrink: 0,
              boxShadow: `0 0 8px ${dotColor}99`,
            }}
          />
        )}
        <span
          className="stat-in"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            fontSize: '1.125rem',
            color: valueColor,
            lineHeight: 1,
            animationDelay: `${delay}ms`,
          }}
        >
          {value}
        </span>
      </div>
      <span
        style={{
          fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
          fontSize: '0.5625rem',
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          color: '#94A3B8',
          marginTop: 4,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── View toggle button ────────────────────────────────────────────────────────

function ViewToggleBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 30,
        border: 'none',
        backgroundColor: active ? '#4F46E5' : '#EEF0F8',
        color: active ? '#FFFFFF' : '#94A3B8',
        cursor: active ? 'default' : 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: 'error' | 'info';
}

let toastCounter = 0;
const DRAWER_WIDTH = 460;

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>('all');
  const [pmFilter, setPMFilter] = useState<string>('all');
  const [dashboardView, setDashboardView] = useState<DashboardView>('data');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'error'>('all');
  const [docsFilter, setDocsFilter] = useState<DocFilter>('all');
  const [importDate, setImportDate] = useState<Date | null>(null);

  const { sheets, activeSheet, setActiveSheet, headers, rows, loading, error, parsedFile } =
    useExcelParser(file);

  useEffect(() => {
    setSelectedRow(null);
    setReadinessFilter('all');
    setPMFilter('all');
    setDocsFilter('all');
    setDashboardView('data');
  }, [activeSheet, file]);

  useEffect(() => {
    if (error) {
      const id = ++toastCounter;
      setToasts((prev) => [...prev, { id, message: error, type: 'error' }]);
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (parsedFile) setImportDate(new Date());
  }, [parsedFile]);

  const handleFileSelect = useCallback((f: File) => { setPendingFile(f); }, []);
  const handlePreviewConfirm = useCallback((f: File) => { setFile(f); setPendingFile(null); setSelectedRow(null); }, []);
  const handlePreviewCancel = useCallback(() => { setPendingFile(null); }, []);
  const handleReset = useCallback(() => { setFile(null); setSelectedRow(null); }, []);
  const handleRowClick = useCallback((row: Record<string, unknown>) => {
    setSelectedRow((prev) => (prev === row ? null : row));
  }, []);
  const handleDrawerClose = useCallback(() => { setSelectedRow(null); }, []);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const projectRows = useMemo(
    () => filterProjectRows(headers, rows),
    [headers, rows]
  );

  // Enrich all project rows (for PM list & status)
  const allEnrichedRows = useMemo(
    () => enrichRows(headers, projectRows),
    [headers, projectRows]
  );

  const pmList = useMemo(() => getUniquePMs(allEnrichedRows), [allEnrichedRows]);

  // Apply PM filter first
  const pmFilteredRows = useMemo(
    () =>
      pmFilter === 'all'
        ? projectRows
        : projectRows.filter((_, i) => allEnrichedRows[i]?.pm === pmFilter),
    [projectRows, allEnrichedRows, pmFilter]
  );

  // Compute Documentation URL column on the PM-filtered rows and include it in headers
  const headersWithDoc = useMemo(() => ensureDocHeader(headers), [headers]);

  const pmFilteredRowsWithDoc = useMemo(() => {
    // annotate rows in-place so selection identity is preserved (applyValidation also mutates)
    annotateRowsWithDocUrlInPlace(headers, pmFilteredRows);
    return pmFilteredRows;
  }, [pmFilteredRows, headers]);

  // Validate rows (adds Row Number + Status) and reorder headers
  const validation = useMemo(
    () => applyValidation(headersWithDoc, pmFilteredRowsWithDoc),
    [headersWithDoc, pmFilteredRowsWithDoc]
  );

  // Apply record status filter
  const statusFilteredRows = useMemo(() => {
    const sh = validation.statusHeader;
    if (!sh) return pmFilteredRows;
    if (statusFilter === 'all') return pmFilteredRows;
    const target = statusFilter === 'valid' ? 'Valid' : 'Error';
    return pmFilteredRows.filter((row) => String((row as any)[sh]) === target);
  }, [pmFilteredRows, validation, statusFilter]);

  // Docs filter counts (for chip UI)
  const docCounts = useMemo((): Record<DocFilter, number> => {
    let has = 0, none = 0;
    statusFilteredRows.forEach((row) => {
      if (rowHasDocumentation(headers, row)) has++;
      else none++;
    });
    return { all: statusFilteredRows.length, 'has-docs': has, 'no-docs': none };
  }, [statusFilteredRows, headers]);

  // Apply documentation filter
  const docsFilteredRows = useMemo(() => {
    if (docsFilter === 'all') return statusFilteredRows;
    return statusFilteredRows.filter((row) =>
      docsFilter === 'has-docs'
        ? rowHasDocumentation(headers, row)
        : !rowHasDocumentation(headers, row)
    );
  }, [statusFilteredRows, headers, docsFilter]);

  const filterCounts = useMemo((): Record<ReadinessFilter, number> => {
    let onTrack = 0, atRisk = 0, noStatus = 0;
    docsFilteredRows.forEach((row) => {
      const pct = readinessPct(headers, row);
      if (pct === null) noStatus++;
      else if (pct >= 70) onTrack++;
      else if (pct < 40) atRisk++;
    });
    return { all: docsFilteredRows.length, 'on-track': onTrack, 'at-risk': atRisk, 'no-status': noStatus };
  }, [docsFilteredRows, headers]);

  const filteredProjectRows = useMemo(() => {
    if (readinessFilter === 'all') return docsFilteredRows;
    return docsFilteredRows.filter((row) => {
      const pct = readinessPct(headers, row);
      if (readinessFilter === 'on-track') return pct !== null && pct >= 70;
      if (readinessFilter === 'at-risk') return pct !== null && pct < 40;
      if (readinessFilter === 'no-status') return pct === null;
      return true;
    });
  }, [docsFilteredRows, headers, readinessFilter]);

  // Enrich the final filtered rows (for charts & Excel export)
  const filteredEnrichedRows = useMemo(
    () => enrichRows(headers, filteredProjectRows),
    [headers, filteredProjectRows]
  );

  const projectStats = useMemo((): ProjectStats | null => {
    if (!projectRows.length || !headers.length) return null;
    let totalYes = 0, totalNo = 0, green = 0, red = 0;
    projectRows.forEach((row) => {
      let yes = 0, no = 0;
      headers.forEach((h) => {
        const v = String(row[h] ?? '').trim().toUpperCase();
        if (v === 'Y' || v === 'YES') yes++;
        else if (v === 'N' || v === 'NO') no++;
      });
      totalYes += yes;
      totalNo += no;
      const t = yes + no;
      if (t > 0) {
        if (yes / t >= 0.7) green++;
        else if (yes / t < 0.4) red++;
      }
    });
    const total = totalYes + totalNo;
    return {
      total: projectRows.length,
      avgReadiness: total > 0 ? Math.round((totalYes / total) * 100) : null,
      green,
      red,
    };
  }, [projectRows, headers]);

  const hasData = parsedFile !== null && !loading;
  const drawerOpen = selectedRow !== null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F5F2', fontFamily: 'Roboto, Arial, Helvetica, sans-serif' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        style={{
          background: 'linear-gradient(135deg, #0B1437 0%, #1A1654 100%)',
          padding: '0 28px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 4px 32px -4px rgba(11,20,55,0.6)',
        }}
      >
        {/* Logo + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, #4F46E5 0%, #0D9488 100%)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 16px rgba(79,70,229,0.5)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.9" />
              <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.5" />
              <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.5" />
              <rect x="10" y="10" width="6" height="6" rx="1.5" fill="#F59E0B" />
            </svg>
          </div>
          <div>
            <span
              style={{
                fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                fontWeight: 700,
                fontSize: '1rem',
                color: '#F8FAFC',
                display: 'block',
                lineHeight: 1.2,
              }}
            >
              Project Tracker
            </span>
            <span
              style={{
                fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                fontSize: '0.625rem',
                color: '#94A3B8',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Excel Importer
            </span>
          </div>
        </div>

        {/* Center: Live stats */}
        {hasData && projectStats && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* View tabs */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                padding: 3,
                gap: 2,
              }}
            >
              {(['data', 'analytics'] as DashboardView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setDashboardView(v)}
                  style={{
                    fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '4px 14px',
                    borderRadius: 7,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: dashboardView === v ? '#4F46E5' : 'transparent',
                    color: dashboardView === v ? '#FFFFFF' : '#94A3B8',
                    transition: 'all 0.15s',
                    textTransform: 'capitalize',
                  }}
                >
                  {v === 'analytics' ? 'Analytics' : 'Data'}
                </button>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              <StatPill label="Projects" value={projectStats.total} valueColor="#A5B4FC" delay={0} />
              {projectStats.avgReadiness !== null && (
                <StatPill
                  label="Avg Readiness"
                  value={`${projectStats.avgReadiness}%`}
                  valueColor={
                    projectStats.avgReadiness >= 70 ? '#6EE7B7' :
                    projectStats.avgReadiness >= 40 ? '#FDE68A' : '#FCA5A5'
                  }
                  delay={80}
                />
              )}
              <StatPill label="On Track" value={projectStats.green} valueColor="#86EFAC" dotColor="#22C55E" delay={160} />
              <StatPill label="At Risk" value={projectStats.red} valueColor="#FCA5A5" dotColor="#EF4444" delay={240} />
            </div>
          </div>
        )}

        {/* Right: file badge + esc hint */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {hasData && (
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.75rem',
                color: '#CBD5E1',
                backgroundColor: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 20,
                padding: '3px 12px',
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {parsedFile.fileName}
            </span>
          )}
          {drawerOpen && (
            <span style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.75rem', color: '#94A3B8' }}>
              Press{' '}
              <kbd
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 4,
                  padding: '1px 5px',
                  color: '#CBD5E1',
                  fontSize: '0.6875rem',
                }}
              >
                Esc
              </kbd>{' '}
              to close
            </span>
          )}
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main
        style={{
          maxWidth: 1360,
          margin: '0 auto',
          padding: '28px 24px',
          paddingRight: drawerOpen ? `calc(24px + ${DRAWER_WIDTH}px)` : '24px',
          transition: 'padding-right 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Upload screen */}
        {!hasData && !loading && (
          <LandingPage onFileSelect={handleFileSelect} />
        )}

        {/* Loading */}
        {loading && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              padding: '80px 0',
            }}
            role="status"
            aria-live="polite"
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              style={{ animation: 'spin 0.8s linear infinite' }}
              aria-hidden="true"
            >
              <circle cx="20" cy="20" r="16" stroke="#E2E8F0" strokeWidth="4" />
              <path
                d="M20 4C28.8366 4 36 11.1634 36 20"
                stroke="#4F46E5"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
            <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', color: '#64748B', margin: 0 }}>
              Parsing your file…
            </p>
          </div>
        )}

        {/* Data view */}
        {hasData && (
          <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ExportSummary
              excelFile={parsedFile}
              activeSheet={activeSheet}
              totalRows={filteredProjectRows.length}
              totalColumns={validation.headers.length}
              headers={validation.headers}
              rows={filteredProjectRows}
              enrichedRows={filteredEnrichedRows}
              onReset={handleReset}
              validCount={validation.validCount}
              errorCount={validation.errorCount}
              importDate={importDate}
            />

            {/* Analytics Dashboard */}
            {dashboardView === 'analytics' && (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E0D8',
                  borderRadius: 20,
                  padding: '20px',
                  boxShadow: '0 2px 12px rgba(79,70,229,0.06)',
                }}
              >
                <AnalyticsDashboard
                  headers={headers}
                  rows={filteredProjectRows}
                  pmFilter={pmFilter}
                  onPMFilterChange={(pm) => { setPMFilter(pm); }}
                />
              </div>
            )}

            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E0D8',
                borderRadius: 20,
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(79,70,229,0.06)',
              }}
            >
              {/* Panel header */}
              <div
                style={{
                  borderBottom: '1px solid #E2E0D8',
                  background: 'linear-gradient(180deg, #FAFBFF 0%, #FFFFFF 100%)',
                }}
              >
                {/* Top row: sheet selector + count | view toggle */}
                <div
                  style={{
                    padding: '14px 20px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <SheetSelector
                      sheets={sheets}
                      activeSheet={activeSheet}
                      onSelect={setActiveSheet}
                    />
                    {sheets.length === 1 && (
                      <span
                        style={{
                          fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                          fontWeight: 600,
                          fontSize: '0.9375rem',
                          color: '#0F172A',
                        }}
                      >
                        {activeSheet}
                      </span>
                    )}
                    {/* Row count badge */}
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: readinessFilter !== 'all' ? '#4F46E5' : '#64748B',
                        backgroundColor: readinessFilter !== 'all' ? '#EEF0F8' : '#F3F1EE',
                        border: `1px solid ${readinessFilter !== 'all' ? '#C7D2FE' : '#E2E0D8'}`,
                        borderRadius: 20,
                        padding: '3px 10px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {filteredProjectRows.length.toLocaleString()} project{filteredProjectRows.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      border: '1.5px solid #E2E0D8',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <ViewToggleBtn
                      active={viewMode === 'cards'}
                      onClick={() => setViewMode('cards')}
                      label="Card view"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="5" height="4" rx="1.5" fill="currentColor" />
                        <rect x="8" y="1" width="5" height="4" rx="1.5" fill="currentColor" fillOpacity="0.4" />
                        <rect x="1" y="7" width="5" height="4" rx="1.5" fill="currentColor" fillOpacity="0.4" />
                        <rect x="8" y="7" width="5" height="4" rx="1.5" fill="currentColor" fillOpacity="0.4" />
                      </svg>
                    </ViewToggleBtn>
                    <ViewToggleBtn
                      active={viewMode === 'table'}
                      onClick={() => setViewMode('table')}
                      label="Table view"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="12" height="3" rx="1" fill="currentColor" />
                        <rect x="1" y="6" width="12" height="2" rx="1" fill="currentColor" fillOpacity="0.4" />
                        <rect x="1" y="10" width="12" height="2" rx="1" fill="currentColor" fillOpacity="0.4" />
                      </svg>
                    </ViewToggleBtn>
                    <ViewToggleBtn
                      active={viewMode === 'kanban'}
                      onClick={() => setViewMode('kanban')}
                      label="Kanban view"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <rect x="1" y="1" width="3" height="12" rx="1" fill="currentColor" />
                        <rect x="5.5" y="1" width="3" height="9" rx="1" fill="currentColor" fillOpacity="0.6" />
                        <rect x="10" y="1" width="3" height="6" rx="1" fill="currentColor" fillOpacity="0.35" />
                      </svg>
                    </ViewToggleBtn>
                  </div>
                </div>

                {/* Bottom row: readiness filter chips + PM filter */}
                {pmFilteredRows.length > 0 && (
                  <div
                    style={{
                      padding: '10px 20px 12px',
                      borderTop: '1px solid #F3F1EE',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      flexWrap: 'wrap',
                    }}
                  >
                    <FilterBar
                      active={readinessFilter}
                      onChange={setReadinessFilter}
                      counts={filterCounts}
                    />

                    {/* Record Status filter */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#64748B',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Record Status
                      </span>
                      <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value as 'all' | 'valid' | 'error'); }}
                        style={{
                          fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                          fontSize: '0.8125rem',
                          border: `1.5px solid ${statusFilter !== 'all' ? '#4F46E5' : '#E2E0D8'}`,
                          borderRadius: 8,
                          padding: '5px 10px',
                          backgroundColor: statusFilter !== 'all' ? '#EEF0F8' : '#FFFFFF',
                          color: statusFilter !== 'all' ? '#4F46E5' : '#0F172A',
                          cursor: 'pointer',
                          outline: 'none',
                          minWidth: 160,
                        }}
                      >
                        <option value="all">All Records</option>
                        <option value="valid">Valid Only</option>
                        <option value="error">Errors Only</option>
                      </select>
                      <button
                        onClick={() => { setStatusFilter('all'); setReadinessFilter('all'); setPMFilter('all'); setDocsFilter('all'); }}
                        style={{
                          fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                          fontSize: '0.75rem',
                          color: '#64748B',
                          background: 'transparent',
                          border: '1.5px solid #E2E0D8',
                          borderRadius: 8,
                          padding: '5px 10px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                        title="Clear all filters"
                      >
                        Clear Filters
                      </button>
                    </div>

                    {/* Docs filter */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#64748B',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Docs
                      </span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(['all', 'has-docs', 'no-docs'] as DocFilter[]).map((key) => {
                          const isActive = docsFilter === key;
                          const label = key === 'all' ? 'All' : key === 'has-docs' ? 'Has Docs' : 'No Docs';
                          const count = docCounts[key];
                          return (
                            <button
                              key={key}
                              onClick={() => setDocsFilter(key)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '5px 14px',
                                borderRadius: 20,
                                border: isActive ? '1.5px solid #4F46E5' : '1.5px solid #E2E0D8',
                                backgroundColor: isActive ? '#4F46E5' : '#FFFFFF',
                                color: isActive ? '#FFFFFF' : '#64748B',
                                fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                                fontSize: '0.8125rem',
                                fontWeight: isActive ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {label}
                              <span
                                style={{
                                  fontFamily: 'JetBrains Mono, monospace',
                                  fontSize: '0.6875rem',
                                  backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#F3F1EE',
                                  borderRadius: 10,
                                  padding: '1px 7px',
                                  color: isActive ? '#FFFFFF' : '#94A3B8',
                                  minWidth: 18,
                                  textAlign: 'center',
                                }}
                              >
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* PM filter */}
                    {pmList.length > 0 && (
                      <>
                        <div
                          aria-hidden="true"
                          style={{ width: 1, height: 20, backgroundColor: '#E2E0D8', flexShrink: 0 }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span
                            style={{
                              fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: '#64748B',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            PM
                          </span>
                          <select
                            value={pmFilter}
                            onChange={(e) => { setPMFilter(e.target.value); setReadinessFilter('all'); }}
                            style={{
                              fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                              fontSize: '0.8125rem',
                              border: `1.5px solid ${pmFilter !== 'all' ? '#4F46E5' : '#E2E0D8'}`,
                              borderRadius: 8,
                              padding: '5px 10px',
                              backgroundColor: pmFilter !== 'all' ? '#EEF0F8' : '#FFFFFF',
                              color: pmFilter !== 'all' ? '#4F46E5' : '#0F172A',
                              cursor: 'pointer',
                              outline: 'none',
                              minWidth: 120,
                            }}
                          >
                            <option value="all">All PMs</option>
                            {pmList.map((pm) => (
                              <option key={pm} value={pm}>{pm}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: '20px' }}>
                {viewMode === 'cards' ? (
                  <RecordList
                    headers={validation.headers}
                    rows={filteredProjectRows}
                    selectedRow={selectedRow}
                    onRowClick={handleRowClick}
                  />
                ) : viewMode === 'kanban' ? (
                  <KanbanBoard
                    headers={validation.headers}
                    rows={filteredProjectRows}
                    selectedRow={selectedRow}
                    onRowClick={handleRowClick}
                  />
                ) : (
                  <DataTable
                    headers={validation.headers}
                    rows={filteredProjectRows}
                    selectedRow={selectedRow}
                    onRowClick={handleRowClick}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Row detail drawer ──────────────────────────────────────────── */}
      <RowDrawer
        row={selectedRow}
        headers={headers}
        isOpen={drawerOpen}
        onClose={handleDrawerClose}
      />

      {/* ── Upload preview modal ──────────────────────────────────────── */}
      {pendingFile && (
        <UploadPreview
          file={pendingFile}
          onConfirm={handlePreviewConfirm}
          onCancel={handlePreviewCancel}
        />
      )}

      {/* ── Toast container ────────────────────────────────────────────── */}
      <div
        aria-live="assertive"
        aria-atomic="false"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 100,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className="animate-slide-in-right"
            style={{
              backgroundColor: toast.type === 'error' ? '#FEF2F2' : '#FFFFFF',
              border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#C7D2FE'}`,
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              maxWidth: 360,
              pointerEvents: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            }}
          >
            {toast.type === 'error' ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                style={{ flexShrink: 0 }}
                aria-hidden="true"
              >
                <circle cx="9" cy="9" r="8" stroke="#DC2626" strokeWidth="1.5" />
                <path d="M9 5.5V9.5M9 12.5V12" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                style={{ flexShrink: 0 }}
                aria-hidden="true"
              >
                <circle cx="9" cy="9" r="8" stroke="#4F46E5" strokeWidth="1.5" />
                <path
                  d="M5.5 9L7.5 11L12.5 6.5"
                  stroke="#4F46E5"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  color: toast.type === 'error' ? '#DC2626' : '#4F46E5',
                  margin: 0,
                }}
              >
                {toast.type === 'error' ? 'Parse Error' : 'Info'}
              </p>
              <p
                style={{
                  fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                  fontSize: '0.8125rem',
                  color: toast.type === 'error' ? '#7F1D1D' : '#6366F1',
                  margin: '2px 0 0 0',
                  wordBreak: 'break-word',
                }}
              >
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: toast.type === 'error' ? '#DC2626' : '#4F46E5',
                padding: 2,
                flexShrink: 0,
                lineHeight: 1,
                fontSize: '1rem',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
