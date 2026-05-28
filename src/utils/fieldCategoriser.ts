/** Shared field-categorisation logic used by RecordList and RowDrawer. */

export type FlagKind = 'active' | 'yes' | 'no' | 'empty';

export function cellStr(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Strip leading asterisks and trim — "*A/A" → "A/A" */
export function cleanLabel(header: string): string {
  return header.replace(/^\*+/, '').trim();
}

export function isUrlValue(value: unknown): boolean {
  return /^https?:\/\//i.test(cellStr(value).trim());
}

export function flagKind(value: unknown): FlagKind | null {
  const s = cellStr(value).trim().toUpperCase();
  if (s === 'X') return 'active';
  if (s === 'Y' || s === 'YES') return 'yes';
  if (s === 'N' || s === 'NO') return 'no';
  if (s === '' || s === '-' || s === '_') return 'empty';
  return null;
}

/** Shorten a column name used as a chip label. */
export function shortLabel(header: string): string {
  return cleanLabel(header)
    .replace(/\s*\([Yy]\/[Nn]\)/g, '')
    .replace(/\s*(required|supported|completed)\??\s*$/i, '')
    .replace(/\?$/, '')
    .trim()
    .slice(0, 24)
    .trim();
}

// ── Palette ──────────────────────────────────────────────────────────────────

export interface PaletteColor {
  bg: string;
  text: string;
  accent: string;
  border: string;
}

const PALETTE: PaletteColor[] = [
  { bg: '#EBF5F5', text: '#095555', accent: '#0D6E6E', border: '#C6E4E4' },
  { bg: '#EEF2FF', text: '#3730A3', accent: '#4338CA', border: '#C7D2FE' },
  { bg: '#FFF7ED', text: '#9A3412', accent: '#EA580C', border: '#FED7AA' },
  { bg: '#F0FDF4', text: '#166534', accent: '#16A34A', border: '#BBF7D0' },
  { bg: '#FDF4FF', text: '#6B21A8', accent: '#9333EA', border: '#E9D5FF' },
  { bg: '#FFF1F2', text: '#9F1239', accent: '#E11D48', border: '#FECDD3' },
  { bg: '#F0F9FF', text: '#075985', accent: '#0284C7', border: '#BAE6FD' },
  { bg: '#FEFCE8', text: '#854D0E', accent: '#CA8A04', border: '#FEF08A' },
];

export function hashPalette(value: string): PaletteColor {
  let h = 5381;
  for (let i = 0; i < value.length; i++) {
    h = ((h << 5) + h + value.charCodeAt(i)) & 0xffffffff;
  }
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ── Card content ─────────────────────────────────────────────────────────────

export interface CardContent {
  id: string;
  title: string;
  typeBadge: string;
  paletteColor: PaletteColor;
  details: Array<{ label: string; value: string }>;
  systemChips: string[];   // column names where value === X
  yesChips: string[];      // column names where value === Y / YES
  noChips: string[];       // column names where value === N / NO
  links: Array<{ label: string; url: string }>;
}

const DEFAULT_COLOR: PaletteColor = PALETTE[0];

export function buildCardContent(
  headers: string[],
  row: Record<string, unknown>,
  hiddenFields?: Set<string>
): CardContent {
  let id = '';
  let title = '';
  let typeBadge = '';
  const details: Array<{ label: string; value: string }> = [];
  const systemChips: string[] = [];
  const yesChips: string[] = [];
  const noChips: string[] = [];
  const links: Array<{ label: string; url: string }> = [];

  for (const h of headers) {
    if (hiddenFields?.has(h)) continue;
    const raw = row[h];
    const s = cellStr(raw).trim();
    const cl = cleanLabel(h);
    const hlo = h.toLowerCase();

    if (!s) continue;

    // URL fields → Links section
    if (isUrlValue(raw)) {
      links.push({ label: cl, url: s });
      continue;
    }

    // Flag fields
    const fk = flagKind(raw);
    if (fk === 'active') { systemChips.push(shortLabel(h)); continue; }
    if (fk === 'yes')    { yesChips.push(shortLabel(h));    continue; }
    if (fk === 'no')     { noChips.push(shortLabel(h));     continue; }
    if (fk === 'empty')  { continue; }

    // ID: first pure number
    if (!id && s !== '' && !isNaN(Number(s))) {
      id = s;
      continue;
    }

    // Type badge: column whose name contains type/category keywords
    if (
      !typeBadge &&
      (hlo.includes('type') || hlo.includes('category') || hlo.includes('kind'))
    ) {
      typeBadge = s;
      continue;
    }

    // Primary title: first short-ish non-numeric, non-email text
    if (!title && !s.includes('@') && s.length <= 60 && isNaN(Number(s))) {
      title = s;
      continue;
    }

    // Everything else → details
    details.push({ label: cl, value: s });
  }

  const paletteColor = typeBadge
    ? hashPalette(typeBadge)
    : title
    ? hashPalette(title.slice(0, 4))
    : DEFAULT_COLOR;

  return {
    id,
    title: title || 'Row',
    typeBadge,
    paletteColor,
    details,
    systemChips,
    yesChips,
    noChips,
    links,
  };
}
