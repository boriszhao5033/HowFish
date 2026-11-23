import { describe, expect, it } from 'vitest';

import regionsJson from '../../../public/data/regions.json';
import speciesJson from '../../../public/data/species.json';
import trapsJson from '../../../public/data/traps.json';
import type {
  RegionsPayload,
  SpeciesRecord,
  TrapsPayload,
} from '../../types/schema';
import {
  buildSearchEngine,
  matchTrapsForQuery,
  searchSpecies,
} from '../searchEngine';

const species = speciesJson as unknown as SpeciesRecord[];
const regions = regionsJson as unknown as RegionsPayload;
const traps = trapsJson as unknown as TrapsPayload;
const engine = buildSearchEngine(species);

function search(query: string) {
  return searchSpecies(engine, query, species, regions);
}

describe('searchEngine weighted fuzzy search', () => {
  it('ranks an exact formal Chinese name first', () => {
    const hits = search('日本鲭');
    expect(hits[0]?.item.id).toBe('FI00000000001');
    expect(hits[0]?.score).toBeLessThan(0.7);
    if (hits[1]?.score !== undefined) {
      expect(hits[0]?.score).toBeLessThan(hits[1].score);
    }
  });

  it('matches full pinyin and reports pinyin provenance', () => {
    const hits = search('ribenqing');
    expect(hits[0]?.item.id).toBe('FI00000000001');
    expect(hits[0]?.matchSource).toContain('命中拼音');
  });

  it('matches pinyin initials for ribenqing and qinghuayu', () => {
    expect(search('rbq')[0]?.item.id).toBe('FI00000000001');
    expect(search('rbq')[0]?.matchSource).toContain('命中拼音首字母');
    expect(search('qhy')[0]?.item.id).toBe('FI00000000001');
  });

  it('tolerates an English spelling typo', () => {
    const hits = search('Baramundi');
    expect(hits[0]?.item.id).toBe('FI00010200001');
  });

  it('matches regional aliases and reports the source region', () => {
    const huafei = search('花飞');
    const huafeiIds = huafei.map((hit) => hit.item.id);
    expect(huafeiIds).toContain('FI00000000001');
    expect(huafeiIds).toContain('FI00000000002');
    expect(huafei[0]?.matchSource).toMatch(/^命中.+俗称：花/);

    const saba = search('Saba');
    expect(saba[0]?.item.id).toBe('FI00000000001');
    expect(saba[0]?.matchSource).toContain('命中澳洲俗称');
    expect(search('saba')[0]?.item.id).toBe('FI00000000001');
  });

  it('matches signature dishes such as 乌鱼子 and 潮汕鱼饭', () => {
    const wuyuzi = search('乌鱼子');
    expect(wuyuzi.map((hit) => hit.item.id)).toContain('FI01020000001a');

    const yufan = search('潮汕鱼饭');
    expect(yufan.some((entry) => entry.item.id === 'FI00000000002')).toBe(true);
    const hit = yufan.find((entry) => entry.item.id === 'FI00000000001');
    expect(hit).toBeDefined();
    expect(hit?.matchSource).toContain('命中招牌名菜：潮汕');
  });

  it('labels hit provenance for English, latin and identification matches', () => {
    expect(search('Barramundi')[0]?.matchSource).toContain('俗称');
    expect(search('Scomber japonicus')[0]?.matchSource).toContain('拉丁学名');
    expect(search('腹部银白无明显麻点')[0]?.matchSource).toContain('辨识要点');
  });
});

describe('matchTrapsForQuery', () => {
  it('detects 油鱼 and 面条鱼 cross-family traps', () => {
    expect(
      matchTrapsForQuery('油鱼', traps).some((trap) => trap.trap_index === 1),
    ).toBe(true);
    expect(
      matchTrapsForQuery('面条鱼', traps).some((trap) => trap.trap_index === 8),
    ).toBe(true);
  });

  it('is case-insensitive for Monkfish and Jade Perch', () => {
    expect(
      matchTrapsForQuery('Monkfish', traps).some(
        (trap) => trap.trap_index === 3,
      ),
    ).toBe(true);
    expect(
      matchTrapsForQuery('jade perch', traps).some(
        (trap) => trap.trap_index === 5,
      ),
    ).toBe(true);
  });

  it('returns no traps for an empty query', () => {
    expect(matchTrapsForQuery('   ', traps)).toEqual([]);
  });
});