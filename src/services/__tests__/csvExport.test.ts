import { describe, expect, it } from 'vitest';

import speciesJson from '../../../public/data/species.json';
import type { SpeciesRecord } from '../../types/schema';
import {
  UTF8_BOM,
  buildSpeciesCsv,
  escapeCsvCell,
  generateCsvFilename,
} from '../csvExport';

const species = speciesJson as unknown as SpeciesRecord[];

describe('CSV export', () => {
  it('starts every file with a UTF-8 BOM at index 0', () => {
    const csv = buildSpeciesCsv(species.slice(0, 1), [
      {
        id: 'name',
        header: '物种',
        accessor: (row) => row.names.zh_formal,
      },
    ]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.indexOf(UTF8_BOM)).toBe(0);
  });

  it('escapes commas, quotes and newlines correctly', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvCell('line1\rline2')).toBe('"line1\rline2"');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('uses CRLF line endings and preserves Chinese text', () => {
    const csv = buildSpeciesCsv(species.slice(0, 2), [
      {
        id: 'name',
        header: '物种名称',
        accessor: (row) => row.names.zh_formal,
      },
      {
        id: 'latin',
        header: '拉丁学名',
        accessor: (row) => row.names.latin,
      },
    ]);

    const body = csv.slice(1);
    const lines = body.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(body.replace(/\r\n/g, '')).not.toContain('\n');
    expect(csv).toContain('日本鲭');
    expect(csv).toContain('Scomber japonicus');
    expect(lines[0]).toBe('物种名称,拉丁学名');
  });

  it('quotes cells containing delimiters inside a full export', () => {
    const csv = buildSpeciesCsv(species.slice(0, 1), [
      {
        id: 'comma',
        header: '标题,带逗号',
        accessor: () => 'alpha,beta',
      },
      {
        id: 'quote',
        header: '引号',
        accessor: () => 'say "hi"',
      },
    ]);
    expect(csv).toContain('"标题,带逗号"');
    expect(csv).toContain('"alpha,beta"');
    expect(csv).toContain('"say ""hi"""');
  });

  it('builds the required HowFish Chinese filename with a date stamp', () => {
    expect(generateCsvFilename(new Date(2026, 10, 21))).toBe(
      'HowFish_海产清单_20261121.csv',
    );
    expect(generateCsvFilename(new Date(2026, 0, 5))).toBe(
      'HowFish_海产清单_20260105.csv',
    );
  });
});