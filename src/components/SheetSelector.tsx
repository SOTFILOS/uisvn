interface SheetSelectorProps {
  sheets: string[];
  activeSheet: string;
  onSelect: (name: string) => void;
}

export default function SheetSelector({
  sheets,
  activeSheet,
  onSelect,
}: SheetSelectorProps) {
  if (sheets.length <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label="Worksheet tabs"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      }}
    >
      {/* Sheet count badge */}
      <span
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.6875rem',
          fontWeight: 500,
          color: '#94A3B8',
          backgroundColor: '#F3F1EE',
          borderRadius: 20,
          padding: '2px 8px',
          whiteSpace: 'nowrap',
          marginRight: 6,
        }}
      >
        {sheets.length} sheets
      </span>

      {sheets.map((sheet) => {
        const isActive = sheet === activeSheet;
        return (
          <button
            key={sheet}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(sheet)}
            style={{
              fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
              fontSize: '0.8125rem',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#0B1437' : '#64748B',
              backgroundColor: isActive ? '#0D9488' : '#FFFFFF',
              border: isActive ? '1.5px solid #0D9488' : '1.5px solid #E2E0D8',
              borderRadius: 8,
              padding: '5px 14px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#0D9488';
                (e.currentTarget as HTMLButtonElement).style.color = '#0D9488';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E0D8';
                (e.currentTarget as HTMLButtonElement).style.color = '#64748B';
              }
            }}
          >
            {sheet}
          </button>
        );
      })}
    </div>
  );
}
