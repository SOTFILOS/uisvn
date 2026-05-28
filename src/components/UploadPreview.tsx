import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

interface UploadPreviewProps {
  file: File;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

interface SheetPreview {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

function parsePreview(file: File): Promise<SheetPreview[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(data, { type: 'array' });
        const previews: SheetPreview[] = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name];
          const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (raw.length === 0) return { name, headers: [], rows: [], totalRows: 0 };
          const headerRow = raw[0] as unknown[];
          const headers = headerRow.map((v, i) => {
            const s = String(v ?? '').replace(/\r\n|\r|\n/g, ' ').trim();
            return s || `Column ${i + 1}`;
          });
          const dataRows = raw.slice(1).filter((r) => r.some((c) => c !== '' && c !== null && c !== undefined));
          const previewRows = dataRows.slice(0, 5).map((r) => {
            const obj: Record<string, unknown> = {};
            headers.forEach((h, i) => { obj[h] = (r as unknown[])[i] ?? ''; });
            return obj;
          });
          return { name, headers, rows: previewRows, totalRows: dataRows.length };
        });
        resolve(previews);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadPreview({ file, onConfirm, onCancel }: UploadPreviewProps) {
  const [previews, setPreviews] = useState<SheetPreview[] | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    parsePreview(file)
      .then((p) => { setPreviews(p); setLoading(false); })
      .catch(() => { setError('Could not read file.'); setLoading(false); });
  }, [file]);

  const current = previews?.[activeSheet];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        backgroundColor: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          width: '100%',
          maxWidth: 860,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #F3F1EE',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #4F46E5 0%, #0D9488 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M3 3h12M3 7h12M3 11h8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontWeight: 700, fontSize: '1rem', color: '#0F172A', margin: 0 }}>
                Preview before importing
              </p>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#94A3B8', margin: 0 }}>
                {file.name} · {formatBytes(file.size)}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{
              width: 32, height: 32, border: '1.5px solid #E2E0D8', borderRadius: 8,
              backgroundColor: '#FFFFFF', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M1 1L11 11M11 1L1 11" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
          {loading && (
            <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 40 40" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                <circle cx="20" cy="20" r="16" stroke="#E2E8F0" strokeWidth="4" />
                <path d="M20 4C28.8366 4 36 11.1634 36 20" stroke="#4F46E5" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
          )}

          {error && (
            <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', color: '#DC2626', textAlign: 'center', padding: '40px 0' }}>{error}</p>
          )}

          {!loading && !error && previews && (
            <>
              {/* Sheet tabs */}
              {previews.length > 1 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {previews.map((p, i) => (
                    <button
                      key={p.name}
                      onClick={() => setActiveSheet(i)}
                      style={{
                        fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.8125rem',
                        fontWeight: activeSheet === i ? 600 : 400,
                        color: activeSheet === i ? '#0B1437' : '#64748B',
                        backgroundColor: activeSheet === i ? '#0D9488' : '#FFFFFF',
                        border: activeSheet === i ? '1.5px solid #0D9488' : '1.5px solid #E2E0D8',
                        borderRadius: 8, padding: '5px 14px', cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {p.name}
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6875rem',
                        marginLeft: 6, color: activeSheet === i ? 'rgba(255,255,255,0.7)' : '#94A3B8',
                      }}>
                        {p.totalRows}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Stats row */}
              {current && (
                <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Total rows', value: current.totalRows },
                    { label: 'Columns', value: current.headers.length },
                    { label: 'Showing', value: `first ${Math.min(5, current.rows.length)}` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontSize: '0.6875rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        {label}
                      </span>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8125rem', fontWeight: 600,
                        color: '#0F172A', backgroundColor: '#F3F1EE', border: '1px solid #E2E0D8',
                        borderRadius: 6, padding: '2px 9px',
                      }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Preview table */}
              {current && current.rows.length > 0 ? (
                <div style={{ overflowX: 'auto', border: '1px solid #E2E0D8', borderRadius: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F3F1EE', borderBottom: '2px solid #E2E0D8' }}>
                        {current.headers.map((h) => (
                          <th key={h} style={{
                            padding: '9px 14px', textAlign: 'left',
                            fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontWeight: 600, fontSize: '0.6875rem',
                            color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em',
                            whiteSpace: 'nowrap', borderRight: '1px solid #E2E0D8',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {current.rows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F3F1EE', backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9F8F6' }}>
                          {current.headers.map((h) => (
                            <td key={h} style={{
                              padding: '8px 14px', color: '#374151',
                              borderRight: '1px solid #F3F1EE',
                              maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {String(row[h] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', color: '#94A3B8', textAlign: 'center', padding: '32px 0' }}>
                  This sheet appears to be empty.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #F3F1EE',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
          backgroundColor: '#FAFBFF',
        }}>
          <button
            onClick={onCancel}
            style={{
              fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontWeight: 600, fontSize: '0.875rem',
              color: '#64748B', backgroundColor: '#FFFFFF',
              border: '1.5px solid #E2E0D8', borderRadius: 10,
              padding: '9px 20px', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(file)}
            disabled={loading || !!error}
            style={{
              fontFamily: 'Roboto, Arial, Helvetica, sans-serif', fontWeight: 600, fontSize: '0.875rem',
              color: '#FFFFFF', background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
              border: 'none', borderRadius: 10, padding: '9px 24px',
              cursor: loading || !!error ? 'not-allowed' : 'pointer',
              opacity: loading || !!error ? 0.6 : 1,
              boxShadow: '0 2px 10px rgba(79,70,229,0.35)',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'opacity 0.15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Import this file
          </button>
        </div>
      </div>
    </div>
  );
}
