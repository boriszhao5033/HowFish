import { describe, expect, it } from 'vitest';

import regionsJson from '../../../public/data/regions.json';
import speciesJson from '../../../public/data/species.json';
import type {
  FishCategoryAttrs,
  RegionsPayload,
  SpeciesRecord,
} from '../../types/schema';
import { COOKING_TAGS } from '../../types/schema';
import {
  buildHomeRankedFeed,
  buildRafflePool,
  createDefaultHomeFilterState,
  filterSpecies,
  isFreshInSeasonAnywhere,
  isFreshInSeasonForGroup,
  isFreshYearRound,
  isPreservedYearRound,
  isSpeciesInSeason,
  isSpeciesUnavailableInRegion,
  pickWeightedRaffleSpecies,
  type HomeFilterState,
} from '../filters';
import { useAppStore } from '../../store/useAppStore';

const species = speciesJson as unknown as SpeciesRecord[];
const regions = regionsJson as unknown as RegionsPayload;

function run(partial: Partial<HomeFilterState>, month = 11) {
  return filterSpecies(
    species,
    { ...createDefaultHomeFilterState(), ...partial },
    'global',
    regions,
    month,
    'ALL',
  );
}

function attrs(item: SpeciesRecord): FishCategoryAttrs {
  return item.category_attrs as FishCategoryAttrs;
}

describe('filterSpecies cross-dimension AND / within-dimension OR', () => {
  it('returns every species when no dimension is active', () => {
    expect(run({})).toHaveLength(species.length);
  });

  it('unions salinity values within one dimension', () => {
    const freshBrackish = run({ salinity: ['freshwater', 'brackish'] });
    expect(freshBrackish.length).toBeGreaterThan(0);
    expect(
      freshBrackish.every((item) =>
        ['freshwater', 'brackish'].includes(item.habitat.salinity),
      ),
    ).toBe(true);
    expect(
      freshBrackish.some((item) => item.habitat.salinity === 'freshwater'),
    ).toBe(true);
    expect(
      freshBrackish.some((item) => item.habitat.salinity === 'brackish'),
    ).toBe(true);
  });

  it('unions sashimi levels and intersects with salinity across dimensions', () => {
    const sashimi = run({ sashimiLevels: ['recommended', 'forbidden'] });
    const levels = new Set(sashimi.map((item) => item.sashimi.level));
    expect(levels.has('recommended')).toBe(true);
    expect(levels.has('forbidden')).toBe(true);
    expect(
      sashimi.every(
        (item) =>
          item.sashimi.level === 'recommended' ||
          item.sashimi.level === 'forbidden',
      ),
    ).toBe(true);

    const combined = run({
      salinity: ['saltwater'],
      sashimiLevels: ['recommended', 'forbidden'],
      pinBoneLevels: ['none'],
    });
    expect(combined.length).toBeGreaterThan(0);
    for (const item of combined) {
      expect(item.habitat.salinity).toBe('saltwater');
      expect(['recommended', 'forbidden']).toContain(item.sashimi.level);
      expect(attrs(item).pin_bone_level).toBe('none');
    }
  });

  it('filters by an inclusive fat range', () => {
    const results = run({ fatRange: [4, 5] });
    expect(results.length).toBeGreaterThan(0);
    for (const item of results) {
      const fat = attrs(item).fat_level;
      expect(fat).not.toBeNull();
      expect(fat).toBeGreaterThanOrEqual(4);
      expect(fat).toBeLessThanOrEqual(5);
    }
  });

  it('filters by histamine risk and flesh colour', () => {
    const histamine = run({ histamineRisks: ['high', 'very_high'] });
    expect(histamine.length).toBeGreaterThan(0);
    expect(
      histamine.every((item) =>
        ['high', 'very_high'].includes(attrs(item).histamine_risk ?? ''),
      ),
    ).toBe(true);

    const expectedFlesh = species.filter(
      (item) => attrs(item).flesh_color_tag === '青皮红肉',
    );
    expect(expectedFlesh.length).toBeGreaterThan(0);

    const flesh = run({ fleshColors: ['青皮红肉'] });
    expect(new Set(flesh.map((item) => item.id))).toEqual(
      new Set(expectedFlesh.map((item) => item.id)),
    );
    expect(
      flesh.every((item) => attrs(item).flesh_color_tag === '青皮红肉'),
    ).toBe(true);
  });

  it('uses dynamic region availability keys from regions.json', () => {
    const enabled = Object.entries(regions.regions)
      .filter(([, config]) => config.enabled)
      .map(([key]) => key);
    expect(enabled.length).toBeGreaterThan(0);

    const results = run({ regionAvailability: ['cn_north', 'au'] });
    expect(results.length).toBeGreaterThan(0);
    for (const item of results) {
      const availableIn = ['cn_north', 'au'].some((regionKey) => {
        const availability = item.availability[regionKey];
        return (
          availability !== undefined &&
          availability !== 'none' &&
          availability !== 'unknown'
        );
      });
      expect(availableIn).toBe(true);
    }
  });

  it('supports every one of the 22 cooking tags with signature-only toggles', () => {
    expect(COOKING_TAGS).toHaveLength(22);

    for (const tag of COOKING_TAGS) {
      const all = run({ cookingTags: [tag] });
      expect(
        all.every((item) =>
          item.culinary.methods.some((method) => method.tag === tag),
        ),
      ).toBe(true);

      const signatureOnly = run({
        cookingTags: [tag],
        cookingSignatureOnly: true,
      });
      expect(
        signatureOnly.every((item) =>
          item.culinary.methods.some(
            (method) => method.tag === tag && method.tier === 'signature',
          ),
        ),
      ).toBe(true);
    }
  });

  it('distinguishes signature-only from all feasible cooking matches', () => {
    const allSteam = run({ cookingTags: ['清蒸'] });
    const allIds = new Set(allSteam.map((item) => item.id));
    expect(allIds.has('FI00000510101')).toBe(true);
    expect(allIds.has('FI00000010001b')).toBe(true);

    const signatureSteam = run({
      cookingTags: ['清蒸'],
      cookingSignatureOnly: true,
    });
    const signatureIds = new Set(signatureSteam.map((item) => item.id));
    expect(signatureIds.has('FI00000510101')).toBe(false);
    expect(signatureIds.has('FI00000010001b')).toBe(true);
  });

  it('combines season and safety-alert filters with the rest', () => {
    const seasonal = run({ onlyInSeason: true }, 11);
    expect(seasonal.length).toBeGreaterThan(0);
    expect(
      seasonal.every((item) =>
        isSpeciesInSeason(item, 11, 'global', regions, false),
      ),
    ).toBe(true);

    const alerts = run({ onlyWithSafetyAlert: true });
    expect(alerts.length).toBeGreaterThan(0);
    expect(
      alerts.every((item) =>
        item.safety_and_legal.some((entry) => entry.severity !== 'low'),
      ),
    ).toBe(true);
  });
});

describe('isSpeciesInSeason hemispheres and year-round handling', () => {
  const blueMackerel = species.find((item) => item.id === 'FI00000000002');
  const yearRoundMullet = species.find((item) => item.id === 'FI01020000001b');

  it('respects southern vs northern hemisphere seasons', () => {
    expect(blueMackerel).toBeDefined();
    if (!blueMackerel) return;

    expect(isSpeciesInSeason(blueMackerel, 6, 'au', regions)).toBe(true);
    expect(isSpeciesInSeason(blueMackerel, 6, 'cn_north', regions)).toBe(false);
    expect(isSpeciesInSeason(blueMackerel, 11, 'au', regions)).toBe(false);
    expect(isSpeciesInSeason(blueMackerel, 11, 'cn_north', regions)).toBe(true);
  });

  it('checks every enabled season group in global mode', () => {
    expect(blueMackerel).toBeDefined();
    if (!blueMackerel) return;

    expect(isSpeciesInSeason(blueMackerel, 6, 'global', regions)).toBe(true);
    expect(isSpeciesInSeason(blueMackerel, 3, 'global', regions)).toBe(false);
  });

  it('honours includeFreshYearRound only for locally available groups', () => {
    expect(yearRoundMullet).toBeDefined();
    if (!yearRoundMullet) return;

    expect(yearRoundMullet.seasonality.year_round).toBe(true);
    expect(
      isSpeciesInSeason(yearRoundMullet, 7, 'au', regions, false),
    ).toBe(false);
    expect(
      isSpeciesInSeason(yearRoundMullet, 7, 'au', regions, true),
    ).toBe(false);
    expect(
      isSpeciesInSeason(yearRoundMullet, 7, 'cn_east', regions, false),
    ).toBe(false);
    expect(
      isSpeciesInSeason(yearRoundMullet, 7, 'cn_east', regions, true),
    ).toBe(true);
  });
});

function seasonGroupFor(region: string): string {
  return regions.regions[region].season_group;
}

describe('v2 preserved_year_round / fresh_year_round semantics', () => {
  const preservedMackerel = species.find((item) => item.id === 'FI00000000001');
  const escolar = species.find((item) => item.id === 'FI00000500001');
  const mullet = species.find((item) => item.id === 'FI01020000001a');

  it('never treats preserved-only mackerel (FI00000000001) as fresh in au', () => {
    expect(preservedMackerel).toBeDefined();
    if (!preservedMackerel) return;

    const groupKey = seasonGroupFor('au');
    expect(isPreservedYearRound(preservedMackerel, groupKey)).toBe(true);
    expect(isFreshYearRound(preservedMackerel, groupKey)).toBe(false);

    for (let month = 1; month <= 12; month += 1) {
      expect(isSpeciesInSeason(preservedMackerel, month, 'au', regions, false)).toBe(false);
      expect(isSpeciesInSeason(preservedMackerel, month, 'au', regions, true)).toBe(false);
    }
  });

  it('keeps rare_import mackerel available when frozen supply is year-round', () => {
    expect(preservedMackerel).toBeDefined();
    if (!preservedMackerel) return;

    expect(preservedMackerel.availability.au).toBe('rare_import');
    expect(isSpeciesUnavailableInRegion(preservedMackerel, 'au', regions)).toBe(false);
  });

  it('never treats preserved-only escolar (FI00000500001) as fresh in season', () => {
    expect(escolar).toBeDefined();
    if (!escolar) return;

    for (const region of ['au', 'cn_north', 'cn_east', 'cn_south', 'global']) {
      for (let month = 1; month <= 12; month += 1) {
        expect(isSpeciesInSeason(escolar, month, region, regions, false)).toBe(false);
        expect(isSpeciesInSeason(escolar, month, region, regions, true)).toBe(false);
      }
    }
  });

  it('counts dual-supply mullet (FI01020000001a) in peak months and all months with fresh-year-round', () => {
    expect(mullet).toBeDefined();
    if (!mullet) return;

    const groupKey = seasonGroupFor('cn_east');
    expect(isPreservedYearRound(mullet, groupKey)).toBe(true);
    expect(isFreshYearRound(mullet, groupKey)).toBe(true);

    for (const month of [11, 12, 1, 2]) {
      expect(isSpeciesInSeason(mullet, month, 'cn_east', regions, false)).toBe(true);
      expect(isSpeciesInSeason(mullet, month, 'cn_east', regions, true)).toBe(true);
    }
    for (const month of [3, 4, 5, 6, 7, 8, 9, 10]) {
      expect(isSpeciesInSeason(mullet, month, 'cn_east', regions, false)).toBe(false);
      expect(isSpeciesInSeason(mullet, month, 'cn_east', regions, true)).toBe(true);
    }
  });
});

describe('buildHomeRankedFeed strict 4-tier invariant', () => {
  const seeds = [1, 2, 3, 7, 11, 42, 99, 2026];

  function expectedTier(item: SpeciesRecord, region: string, month: number): number {
    if (isSpeciesUnavailableInRegion(item, region, regions)) {
      return isFreshInSeasonAnywhere(item, month, regions) ? 2 : 3;
    }
    const groupKey = regions.regions[region]?.season_group ?? null;
    const freshSeason = groupKey
      ? isFreshInSeasonForGroup(item, groupKey, month)
      : false;
    return freshSeason ? 0 : 1;
  }

  it('keeps 当季本地 > 本地 > 当季非本地 > 非本地 for every seed in au/month 6', () => {
    const region = 'au';
    const month = 6;
    const allIds = new Set(species.map((item) => item.id));

    for (const seed of seeds) {
      const feed = buildHomeRankedFeed(species, region, regions, month, seed);
      expect(feed).toHaveLength(species.length);
      expect(new Set(feed.map((item) => item.id))).toEqual(allIds);

      let previousTier = -1;
      for (const item of feed) {
        const tier = expectedTier(item, region, month);
        expect(tier).toBeGreaterThanOrEqual(previousTier);
        previousTier = tier;
      }

      const seenTiers = Array.from(
        new Set(feed.map((item) => expectedTier(item, region, month))),
      ).sort();
      expect(seenTiers).toEqual([0, 1, 2, 3]);
    }
  });

  it('keeps tier ordering for every seed in cn_east/month 11', () => {
    const region = 'cn_east';
    const month = 11;
    const allIds = new Set(species.map((item) => item.id));

    for (const seed of seeds) {
      const feed = buildHomeRankedFeed(species, region, regions, month, seed);
      expect(feed).toHaveLength(species.length);
      expect(new Set(feed.map((item) => item.id))).toEqual(allIds);

      let previousTier = -1;
      let hasLocalTier = false;
      for (const item of feed) {
        const tier = expectedTier(item, region, month);
        expect(tier).toBeGreaterThanOrEqual(previousTier);
        if (tier === 0) hasLocalTier = true;
        previousTier = tier;
      }
      expect(hasLocalTier).toBe(true);
    }
  });
});

describe('buildRafflePool / pickWeightedRaffleSpecies v2', () => {
  it('excludes locally unavailable species (bluegill in au)', () => {
    const pool = buildRafflePool(species, 'au', regions, 6, {
      onlyInSeason: false,
    });
    expect(pool.some((entry) => entry.species.id === 'FI00040210001')).toBe(false);
    expect(pool.some((entry) => entry.species.id === 'FI91010000001')).toBe(false);
  });

  it('excludes strictly seasonal sleeper (FI00150200001) out of season in cn', () => {
    const strict = species.find((item) => item.id === 'FI00150200001');
    expect(strict).toBeDefined();
    if (!strict) return;

    const groupKey = seasonGroupFor('cn_east');
    expect(isPreservedYearRound(strict, groupKey)).toBe(false);
    expect(isFreshYearRound(strict, groupKey)).toBe(false);

    const inSeasonPool = buildRafflePool(species, 'cn_east', regions, 11);
    expect(inSeasonPool.some((entry) => entry.species.id === strict.id)).toBe(false);

    const allSupplyPool = buildRafflePool(species, 'cn_east', regions, 11, {
      onlyInSeason: false,
    });
    expect(allSupplyPool.some((entry) => entry.species.id === strict.id)).toBe(false);
  });

  it('assigns fresh_season 3.0 > fresh_year_round 1.5 > preserved 0.5 / 0.3', () => {
    const pool = buildRafflePool(species, 'au', regions, 6, {
      onlyInSeason: false,
    });

    const freshSeason = pool.find((entry) => entry.species.id === 'FI00000000002');
    const freshYearRound = pool.find((entry) => entry.species.id === 'FI00000030005');
    const preservedCommon = pool.find((entry) => entry.species.id === 'FI00000500001');
    const preservedRare = pool.find((entry) => entry.species.id === 'FI00000000001');

    expect(freshSeason?.reason).toBe('fresh_season');
    expect(freshSeason?.weight).toBe(3);
    expect(freshYearRound?.reason).toBe('fresh_year_round');
    expect(freshYearRound?.weight).toBe(1.5);
    expect(preservedCommon?.reason).toBe('preserved_year_round');
    expect(preservedCommon?.weight).toBe(0.5);
    expect(preservedRare?.reason).toBe('preserved_year_round');
    expect(preservedRare?.weight).toBe(0.3);

    expect(freshSeason!.weight).toBeGreaterThan(freshYearRound!.weight);
    expect(freshYearRound!.weight).toBeGreaterThan(preservedCommon!.weight);
    expect(preservedCommon!.weight).toBeGreaterThan(preservedRare!.weight);

    for (const entry of pool) {
      if (entry.reason === 'fresh_season') {
        expect(entry.weight).toBe(3);
      } else if (entry.reason === 'fresh_year_round') {
        expect(entry.weight).toBe(1.5);
      } else {
        expect([0.3, 0.5]).toContain(entry.weight);
      }
    }
  });

  it('excludes preserved-only entries when onlyInSeason is true', () => {
    const inSeason = buildRafflePool(species, 'au', regions, 6);
    expect(inSeason.some((entry) => entry.reason === 'preserved_year_round')).toBe(false);
    expect(inSeason.some((entry) => entry.species.id === 'FI00000000001')).toBe(false);
    expect(inSeason.some((entry) => entry.species.id === 'FI00000500001')).toBe(false);

    const withPreserved = buildRafflePool(species, 'au', regions, 6, {
      onlyInSeason: false,
    });
    expect(withPreserved.some((entry) => entry.reason === 'preserved_year_round')).toBe(true);
    expect(withPreserved.some((entry) => entry.species.id === 'FI00000000001')).toBe(true);
  });

  it('picks weighted species with deduplication and exhaustion handling', () => {
    const pool = buildRafflePool(species, 'au', regions, 6, {
      onlyInSeason: false,
    });
    expect(pool.length).toBeGreaterThan(1);

    const first = pickWeightedRaffleSpecies(pool, [], () => 0);
    expect(first?.id).toBe(pool[0].species.id);

    const second = pickWeightedRaffleSpecies(pool, [first!.id], () => 0);
    expect(second?.id).toBe(pool[1].species.id);
    expect(second?.id).not.toBe(first?.id);

    const last = pickWeightedRaffleSpecies(pool, [], () => 0.999999);
    expect(last?.id).toBe(pool[pool.length - 1].species.id);

    const exhausted = pool.map((entry) => entry.species.id);
    expect(pickWeightedRaffleSpecies(pool, exhausted, () => 0.5)).toBeNull();
  });
});

describe('useAppStore region switching v2', () => {
  it('increments regionEpoch and homeFeedSeed only when the region changes', () => {
    useAppStore.setState({
      selectedRegion: 'global',
      regionEpoch: 0,
      homeFeedSeed: 1,
    });

    useAppStore.getState().setSelectedRegion('au');
    expect(useAppStore.getState().selectedRegion).toBe('au');
    expect(useAppStore.getState().regionEpoch).toBe(1);
    expect(useAppStore.getState().homeFeedSeed).toBe(2);

    useAppStore.getState().setSelectedRegion('au');
    expect(useAppStore.getState().regionEpoch).toBe(1);
    expect(useAppStore.getState().homeFeedSeed).toBe(2);

    useAppStore.getState().setSelectedRegion('cn_north');
    expect(useAppStore.getState().selectedRegion).toBe('cn_north');
    expect(useAppStore.getState().regionEpoch).toBe(2);
    expect(useAppStore.getState().homeFeedSeed).toBe(3);

    useAppStore.setState({
      selectedRegion: 'global',
      regionEpoch: 0,
      homeFeedSeed: 1,
    });
  });
});