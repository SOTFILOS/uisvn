import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import {
  enrichRows,
  getUniquePMs,
  getStatusCounts,
  getRadarAxes,
  getRadarData,
} from '../utils/projectAnalytics';
import type { EnrichedRow, ProjectStatus } from '../utils/projectAnalytics';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ProjectStatus, string> = {
  Completed: '#22C55E',
  'In Progress': '#4F46E5',
  Delayed: '#EF4444',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface AnalyticsDashboardProps {
  headers: string[];
  rows: Record<string, unknown>[];
  pmFilter: string;
  onPMFilterChange: (pm: string) => void;
}

// ── Tooltip customisation ─────────────────────────────────────────────────────

function BarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: EnrichedRow & { progress: number; status: ProjectStatus; name: string } }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E0D8',
        borderRadius: 8,
        padding: '8px 12px',
        fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
        fontSize: '0.75rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      }}
    >
      <p style={{ margin: 0, fontWeight: 700, color: '#0F172A', maxWidth: 200 }}>{d.name}</p>
      <p style={{ margin: '4px 0 0', color: STATUS_COLORS[d.status] }}>
        {d.status} — {d.progress}%
      </p>
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  children,
  flex = 1,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  flex?: number;
}) {
  return (
    <div
      style={{
        flex,
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E0D8',
        borderRadius: 16,
        padding: '16px 20px',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div>
        <p
          style={{
            fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
            fontWeight: 700,
            fontSize: '0.8125rem',
            color: '#0F172A',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {title}
        </p>
        {subtitle && (
          <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.6875rem', color: '#94A3B8', margin: '2px 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

// ── PM filter dropdown ────────────────────────────────────────────────────────

function PMFilter({
  pmList,
  value,
  onChange,
}: {
  pmList: string[];
  value: string;
  onChange: (pm: string) => void;
}) {
  if (pmList.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label
        htmlFor="pm-filter"
        style={{
          fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: '#64748B',
          whiteSpace: 'nowrap',
        }}
      >
        Project Manager
      </label>
      <select
        id="pm-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
          fontSize: '0.8125rem',
          border: '1.5px solid #E2E0D8',
          borderRadius: 8,
          padding: '6px 12px',
          backgroundColor: value !== 'all' ? '#EEF0F8' : '#FFFFFF',
          color: value !== 'all' ? '#4F46E5' : '#0F172A',
          cursor: 'pointer',
          outline: 'none',
          minWidth: 140,
        }}
      >
        <option value="all">All PMs</option>
        {pmList.map((pm) => (
          <option key={pm} value={pm}>
            {pm}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Custom Radar tick ─────────────────────────────────────────────────────────

function RadarTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fill="#64748B"
      fontFamily="Roboto, Arial, Helvetica, sans-serif"
      fontSize={9}
    >
      {payload?.value}
    </text>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AnalyticsDashboard({
  headers,
  rows,
  pmFilter,
  onPMFilterChange,
}: AnalyticsDashboardProps) {
  const allEnriched = useMemo(() => enrichRows(headers, rows), [headers, rows]);
  const pmList = useMemo(() => getUniquePMs(allEnriched), [allEnriched]);

  const enriched = useMemo(
    () => (pmFilter === 'all' ? allEnriched : allEnriched.filter((r) => r.pm === pmFilter)),
    [allEnriched, pmFilter]
  );

  const statusCounts = useMemo(() => getStatusCounts(enriched), [enriched]);

  // Bar chart: top 15 projects sorted by progress desc
  const barData = useMemo(
    () =>
      [...enriched]
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 15)
        .map((r) => ({ name: r.name, progress: r.progress, status: r.status })),
    [enriched]
  );

  // Pie chart data
  const pieData = useMemo(
    () =>
      (Object.entries(statusCounts) as [ProjectStatus, number][])
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] })),
    [statusCounts]
  );

  // Radar data
  const radarAxes = useMemo(
    () => getRadarAxes(headers, enriched.map((r) => r.row)),
    [headers, enriched]
  );
  const radarData = useMemo(
    () => getRadarData(radarAxes, enriched.map((r) => r.row)),
    [radarAxes, enriched]
  );

  if (enriched.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: '#F7F5F2',
        borderRadius: 20,
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* ── Dashboard header ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '0 0 14px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              background: 'linear-gradient(135deg, #4F46E5, #0D9488)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <rect x="1" y="8" width="3" height="6" rx="1" fill="white" />
              <rect x="6" y="5" width="3" height="9" rx="1" fill="white" fillOpacity="0.8" />
              <rect x="11" y="2" width="3" height="12" rx="1" fill="white" fillOpacity="0.6" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
              fontWeight: 700,
              fontSize: '0.9375rem',
              color: '#0F172A',
            }}
          >
            Analytics Dashboard
          </span>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.6875rem',
              color: '#4F46E5',
              backgroundColor: '#EEF0F8',
              border: '1px solid #C7D2FE',
              borderRadius: 20,
              padding: '2px 10px',
            }}
          >
            {enriched.length} project{enriched.length !== 1 ? 's' : ''}
          </span>
        </div>

        <PMFilter pmList={pmList} value={pmFilter} onChange={onPMFilterChange} />
      </div>

      {/* ── Charts row ───────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        {/* Bar chart */}
        <ChartCard
          title="Progress by Project"
          subtitle={`Top ${barData.length} projects`}
          flex={2}
        >
          <ResponsiveContainer width="100%" height={Math.max(180, barData.length * 28)}>
            <BarChart
              layout="vertical"
              data={barData}
              margin={{ top: 0, right: 48, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F1EE" />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: '#94A3B8' }}
                tickFormatter={(v) => `${v}%`}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: 11, fill: '#374151' }}
                tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: '#F3F1EE' }} />
              <Bar dataKey="progress" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {barData.map((d, i) => (
                  <Cell key={i} fill={STATUS_COLORS[d.status as ProjectStatus]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Pie chart */}
        <ChartCard title="Status Distribution" subtitle="All visible projects" flex={1}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="42%"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={3}
                dataKey="value"
                label={({ percent }) =>
                  `${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {pieData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span
                    style={{
                      fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                      fontSize: '0.75rem',
                      color: '#374151',
                    }}
                  >
                    {value}
                  </span>
                )}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${value} project${value !== 1 ? 's' : ''}`,
                  name,
                ]}
                contentStyle={{
                  fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                  fontSize: '0.75rem',
                  borderRadius: 8,
                  border: '1px solid #E2E0D8',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Radar chart */}
        {radarData.length >= 3 && (
          <ChartCard
            title="Portfolio Health Radar"
            subtitle="Y/N criteria completion %"
            flex={1}
          >
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#E2E0D8" />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={<RadarTick />}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fill: '#94A3B8' }}
                  tickCount={4}
                  axisLine={false}
                />
                <Radar
                  dataKey="value"
                  stroke="#4F46E5"
                  fill="#4F46E5"
                  fillOpacity={0.18}
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#4F46E5' }}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, 'Completion']}
                  contentStyle={{
                    fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                    fontSize: '0.75rem',
                    borderRadius: 8,
                    border: '1px solid #E2E0D8',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </div>
  );
}
