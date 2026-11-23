import type { SpeciesRecord } from '../types/schema';

/** Excel-friendly UTF-8 BOM. */
export const UTF8_BOM = '\uFEFF';

/**
 * Escape a single CSV cell: double quotes become `""`, and any cell that
 * contains a comma, quote, CR or LF is wrapped in double quotes.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export interface CsvColumnDef<T = SpeciesRecord> {
  id: string;
  header: string;
  accessor: (row: T) => string;
}

/**
 * Serialise species rows into a CSV string that always starts with the UTF-8
 * BOM and uses CRLF line endings. Header row is always emitted, even for an
 * empty result set, so Excel sees a valid table.
 */
export function buildSpeciesCsv(
  rows: SpeciesRecord[],
  columns: CsvColumnDef[],
): string {
  const header = columns.map((column) => escapeCsvCell(column.header)).join(',');
  const lines = rows.map((row) =>
    columns.map((column) => escapeCsvCell(column.accessor(row))).join(','),
  );
  return `${UTF8_BOM}${[header, ...lines].join('\r\n')}`;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/** Local-time filename such as `HowFish_海产清单_20261121.csv`. */
export function generateCsvFilename(date: Date = new Date()): string {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `HowFish_海产清单_${stamp}.csv`;
}

/** Build the CSV and trigger a browser download through a transient Blob URL. */
export function downloadSpeciesCsv(
  rows: SpeciesRecord[],
  columns: CsvColumnDef[],
): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return;
  }

  const csv = buildSpeciesCsv(rows, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = generateCsvFilename();
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}