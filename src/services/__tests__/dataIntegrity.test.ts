import { describe, expect, it } from 'vitest';

import metaJson from '../../../public/data/meta.json';
import redirectsJson from '../../../public/data/id_redirects.json';
import regionsJson from '../../../public/data/regions.json';
import speciesJson from '../../../public/data/species.json';
import taxonomyJson from '../../../public/data/taxonomy.json';
import trapsJson from '../../../public/data/traps.json';
import {
  COOKING_TAGS,
  type IdRedirects,
  type MetaPayload,
  type RegionsPayload,
  type SpeciesRecord,
  type TaxonomyPayload,
  type TrapsPayload,
} from '../../types/schema';

const species = speciesJson as unknown as SpeciesRecord[];
const taxonomy = taxonomyJson as unknown as TaxonomyPayload;
const traps = trapsJson as unknown as TrapsPayload;
const regions = regionsJson as unknown as RegionsPayload;
const redirects = redirectsJson as unknown as IdRedirects;
const meta = metaJson as unknown as MetaPayload;

const speciesIds = species.map((item) => item.id);
const speciesIdSet = new Set(speciesIds);
const taxonomyCodes = new Set(taxonomy.nodes.map((node) => node.code));
const taxonomyByCode = new Map(
  taxonomy.nodes.map((node) => [node.code, node] as const),
);

describe('species.json integrity', () => {
  it('contains 350 unique records sorted by id', () => {
    expect(species).toHaveLength(350);
    expect(speciesIdSet.size).toBe(350);
    expect(speciesIds).toEqual([...speciesIds].sort());
  });

  it('ships a non-empty continuous taxonomy_path for every record', () => {
    for (const item of species) {
      expect(typeof item.taxonomy_path).toBe('string');
      expect((item.taxonomy_path ?? '').trim().length).toBeGreaterThan(0);
      expect((item.taxonomy_path ?? '').split('·')).toHaveLength(4);
    }
    expect(
      species.find((item) => item.id === 'FI00000000001')?.taxonomy_path,
    ).toBe('鲈形总目·鲭形目·鲭科·鲐属');
  });

  it('uses canonical 13-character base ids with optional a/b suffix', () => {
    for (const id of speciesIds) {
      expect(id).toMatch(/^[A-Z]{2}\d{11}[ab]?$/);
    }
  });

  it('ships complete names, habitat, safety, culinary and search hints', () => {
    for (const item of species) {
      expect(item.names.zh_formal.length).toBeGreaterThan(0);
      expect(item.names.latin.length).toBeGreaterThan(0);
      expect(item.names.en_standard.length).toBeGreaterThan(0);
      expect(item.habitat.salinity).toBeTruthy();
      expect(item.sashimi.level).not.toBeNull();
      expect(Array.isArray(item.safety_and_legal)).toBe(true);
      expect(Array.isArray(item.culinary.methods)).toBe(true);
      expect(Array.isArray(item.culinary.signature_dishes)).toBe(true);
      expect(Array.isArray(item.buying_guide.market_forms)).toBe(true);
      expect(item._search).toBeDefined();
      expect(item._search?.pinyin_full.length).toBeGreaterThan(0);
      expect(item._search?.pinyin_initials.length).toBeGreaterThan(0);
    }

    // Optional culinary detail is sparse for a handful of real records, but
    // the production dataset must stay at least 99% complete.
    const coverage = (values: boolean[]) =>
      values.filter(Boolean).length / values.length;
    expect(
      coverage(species.map((item) => item.culinary.methods.length > 0)),
    ).toBeGreaterThanOrEqual(0.99);
    expect(
      coverage(species.map((item) => item.culinary.signature_dishes.length > 0)),
    ).toBeGreaterThanOrEqual(0.99);
    expect(
      coverage(species.map((item) => item.buying_guide.market_forms.length > 0)),
    ).toBeGreaterThanOrEqual(0.99);
  });

  it('covers all four salinity values and all four sashimi levels', () => {
    expect(new Set(species.map((item) => item.habitat.salinity))).toEqual(
      new Set(['saltwater', 'freshwater', 'brackish', 'diadromous']),
    );
    expect(new Set(species.map((item) => item.sashimi.level))).toEqual(
      new Set(['recommended', 'conditional', 'not_recommended', 'forbidden']),
    );
  });

  it('only uses canonical cooking tags and tiers', () => {
    const validTags = new Set<string>(COOKING_TAGS);
    for (const item of species) {
      for (const method of item.culinary.methods) {
        expect(validTags.has(method.tag)).toBe(true);
        expect(['signature', 'suitable']).toContain(method.tier);
      }
    }
  });

  it('links every species to an existing taxonomy genus', () => {
    for (const item of species) {
      const codes = item.taxon_codes;
      expect(codes).not.toBeNull();
      if (!codes) continue;
      expect(taxonomyCodes.has(codes.superorder)).toBe(true);
      expect(taxonomyCodes.has(codes.order)).toBe(true);
      expect(taxonomyCodes.has(codes.family)).toBe(true);
      expect(taxonomyCodes.has(codes.subfamily)).toBe(true);
      expect(taxonomyCodes.has(codes.genus)).toBe(true);
      expect(taxonomyByCode.get(codes.genus)?.level).toBe('genus');
    }
  });
});

describe('seasonal month coverage', () => {
  function monthCoverage(group: string): number[] {
    const months = new Set<number>();
    for (const item of species) {
      for (const month of item.seasonality.by_group[group]?.months ?? []) {
        months.add(month);
      }
    }
    return [...months].sort((a, b) => a - b);
  }

  it('covers all twelve months in both AU and CN season groups', () => {
    const everyMonth = Array.from({ length: 12 }, (_, index) => index + 1);
    expect(monthCoverage('au')).toEqual(everyMonth);
    expect(monthCoverage('cn')).toEqual(everyMonth);
  });

  it('has at least two fresh-in-season species in November for both groups', () => {
    for (const group of ['au', 'cn']) {
      const count = species.filter((item) =>
        item.seasonality.by_group[group]?.months.includes(11),
      ).length;
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps preserved-only imports out of fresh season lists', () => {
    const mackerel = species.find((item) => item.id === 'FI00000000001');
    expect(mackerel?.seasonality.by_group.au.months).toEqual([]);
    expect(mackerel?.seasonality.by_group.au.fresh_year_round).toBe(false);
    expect(mackerel?.seasonality.by_group.au.preserved_year_round).toBe(true);

    const escolar = species.find((item) => item.id === 'FI00000500001');
    for (const entry of Object.values(escolar?.seasonality.by_group ?? {})) {
      expect(entry.months).toEqual([]);
      expect(entry.fresh_year_round).toBe(false);
      expect(entry.preserved_year_round).toBe(true);
    }
  });
});

describe('taxonomy.json integrity', () => {
  it('contains 545 unique hierarchical nodes', () => {
    expect(taxonomy.nodes).toHaveLength(545);
    expect(taxonomyCodes.size).toBe(545);
    expect(new Set(taxonomy.nodes.map((node) => node.level))).toEqual(
      new Set(['superorder', 'order', 'family', 'subfamily', 'genus']),
    );
  });

  it('has valid parents and anatomy/ecology notes on genera', () => {
    for (const node of taxonomy.nodes) {
      if (node.parent_code !== null) {
        expect(taxonomyCodes.has(node.parent_code)).toBe(true);
      }
      expect(node.name_zh.length).toBeGreaterThan(0);
    }

    const annotatedGenera = taxonomy.nodes.filter(
      (node) =>
        node.level === 'genus' &&
        Boolean(node.anatomy_notes) &&
        Boolean(node.ecology_notes),
    );
    expect(annotatedGenera).toHaveLength(233);
  });
});

describe('traps.json integrity', () => {
  it('ships 15 complete a/b pairs and 10 complete cross-family traps', () => {
    const completePairs = traps.ab_pairs.filter(
      (pair) =>
        pair.species_id_a !== null &&
        pair.species_id_b !== null &&
        speciesIdSet.has(pair.species_id_a) &&
        speciesIdSet.has(pair.species_id_b),
    );
    expect(completePairs).toHaveLength(15);
    for (const pair of completePairs) {
      expect(pair.name_zh.length).toBeGreaterThan(0);
      expect(pair.family.length).toBeGreaterThan(0);
      expect(pair.difference.length).toBeGreaterThan(0);
      expect(pair.usage_tips.length).toBeGreaterThan(0);
    }

    const completeCrossFamily = traps.cross_family_traps.filter(
      (trap) =>
        trap.species_ids.length >= 2 &&
        trap.species_ids.every((id) => speciesIdSet.has(id)),
    );
    expect(completeCrossFamily).toHaveLength(10);
    for (const trap of completeCrossFamily) {
      expect(trap.aliases_trigger.length).toBeGreaterThan(0);
      expect(trap.families.length).toBeGreaterThan(0);
      expect(trap.truth.length).toBeGreaterThan(0);
      expect(trap.tips.length).toBeGreaterThan(0);
    }
  });

  it('reports trap totals in meta.json', () => {
    expect(meta.traps_count).toBe(
      traps.ab_pairs.length + traps.cross_family_traps.length,
    );
    expect(meta.traps_count).toBe(25);
  });
});

describe('regions.json / id_redirects.json / meta.json integrity', () => {
  it('matches enabled regions and references valid season groups', () => {
    const enabled = Object.entries(regions.regions)
      .filter(([, config]) => config.enabled)
      .map(([key]) => key);
    expect(enabled.sort()).toEqual([...meta.enabled_regions].sort());

    for (const [key, config] of Object.entries(regions.regions)) {
      expect(key.length).toBeGreaterThan(0);
      expect(['north', 'south']).toContain(config.hemisphere);
      expect(regions.season_groups[config.season_group]).toBeDefined();
    }
    for (const config of Object.values(regions.season_groups)) {
      expect(['north', 'south']).toContain(config.hemisphere);
    }
  });

  it('keeps redirects as string pairs and reports the same count', () => {
    for (const [from, to] of Object.entries(redirects)) {
      expect(from.length).toBeGreaterThan(0);
      expect(typeof to).toBe('string');
      expect(to.length).toBeGreaterThan(0);
    }
    expect(meta.redirects_count).toBe(Object.keys(redirects).length);
    expect(meta.redirects_count).toBe(0);
  });

  it('reports consistent meta counts and build metadata', () => {
    expect(meta.schema_version).toBe(1);
    expect(meta.total_species).toBe(species.length);
    expect(meta.taxonomy_count).toBe(taxonomy.nodes.length);
    expect(meta.counts_by_category.FI).toBe(350);
    expect(
      Object.values(meta.counts_by_category).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBe(350);
    expect(Number.isNaN(Date.parse(meta.build_timestamp))).toBe(false);
  });
});