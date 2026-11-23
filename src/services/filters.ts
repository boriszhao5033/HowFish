import type {
  Availability,
  CategoryCode,
  CookingTag,
  FleshColorTag,
  FishCategoryAttrs,
  Hemisphere,
  HistamineRisk,
  PinBoneLevel,
  RegionsPayload,
  Salinity,
  SashimiLevel,
  SeasonGroup,
  SpeciesRecord,
} from '../types/schema';

export interface HomeFilterState {
  regionAvailability: string[];
  salinity: Salinity[];
  sashimiLevels: SashimiLevel[];
  pinBoneLevels: PinBoneLevel[];
  fatRange: [number, number];
  histamineRisks: HistamineRisk[];
  fleshColors: FleshColorTag[];
  cookingTags: CookingTag[];
  cookingSignatureOnly: boolean;
  onlyInSeason: boolean;
  onlyWithSafetyAlert: boolean;
}

export const DEFAULT_HOME_FILTER_STATE: HomeFilterState = {
  regionAvailability: [],
  salinity: [],
  sashimiLevels: [],
  pinBoneLevels: [],
  fatRange: [0, 10],
  histamineRisks: [],
  fleshColors: [],
  cookingTags: [],
  cookingSignatureOnly: false,
  onlyInSeason: false,
  onlyWithSafetyAlert: false,
};

export function createDefaultHomeFilterState(): HomeFilterState {
  return {
    ...DEFAULT_HOME_FILTER_STATE,
    regionAvailability: [],
    salinity: [],
    sashimiLevels: [],
    pinBoneLevels: [],
    fatRange: [0, 10],
    histamineRisks: [],
    fleshColors: [],
    cookingTags: [],
  };
}

export function countActiveFilterDimensions(filter: HomeFilterState): number {
  let count = 0;
  if (filter.regionAvailability.length > 0) count += 1;
  if (filter.salinity.length > 0) count += 1;
  if (filter.sashimiLevels.length > 0) count += 1;
  if (filter.pinBoneLevels.length > 0) count += 1;
  if (filter.fatRange[0] > 0 || filter.fatRange[1] < 10) count += 1;
  if (filter.histamineRisks.length > 0) count += 1;
  if (filter.fleshColors.length > 0) count += 1;
  if (filter.cookingTags.length > 0) count += 1;
  if (filter.onlyInSeason) count += 1;
  if (filter.onlyWithSafetyAlert) count += 1;
  return count;
}

export interface SpeciesSeasonInfo {
  groupKey: string;
  groupLabel: string;
  hemisphere: Hemisphere | null;
  months: number[];
  note: string;
  yearRound: boolean;
}

function enabledSeasonGroups(regions: RegionsPayload): string[] {
  const groups = new Set<string>();
  for (const config of Object.values(regions.regions)) {
    if (config.enabled) {
      groups.add(config.season_group);
    }
  }
  if (groups.size === 0) {
    for (const key of Object.keys(regions.season_groups)) {
      groups.add(key);
    }
  }
  return Array.from(groups);
}

function seasonEntry(
  species: SpeciesRecord,
  groupKey: string,
): SeasonGroup | undefined {
  return species.seasonality.by_group[groupKey];
}

/** True when the selected season group carries preserved/frozen supply all year. */
export function isPreservedYearRound(
  species: SpeciesRecord,
  groupKey: string,
): boolean {
  const entry = seasonEntry(species, groupKey);
  if (entry && typeof entry.preserved_year_round === 'boolean') {
    return entry.preserved_year_round;
  }
  // Legacy data may only carry `seasonality.year_round`.
  return species.seasonality.year_round === true;
}

/** True when the selected season group carries fresh (not frozen) supply all year. */
export function isFreshYearRound(
  species: SpeciesRecord,
  groupKey: string,
): boolean {
  const entry = seasonEntry(species, groupKey);
  if (entry && typeof entry.fresh_year_round === 'boolean') {
    return entry.fresh_year_round;
  }
  // Legacy fallback: `year_round` means fresh supply unless the group is preserved-only.
  if (entry && entry.preserved_year_round === true) {
    return false;
  }
  return species.seasonality.year_round === true;
}

/**
 * True only when the season group explicitly lists the month as fresh season.
 * Preserved-only groups carry `months: []`, so they are never "in season".
 */
export function isFreshInSeasonForGroup(
  species: SpeciesRecord,
  groupKey: string,
  month: number,
): boolean {
  return seasonEntry(species, groupKey)?.months.includes(month) ?? false;
}

/**
 * True when the selected market has no usable supply at all.
 * `rare_import` stays available when the local season group carries frozen/preserved,
 * year-round fresh supply, or an explicit fresh season.
 */
export function isSpeciesUnavailableInRegion(
  species: SpeciesRecord,
  selectedRegion: string,
  regions: RegionsPayload,
): boolean {
  if (!selectedRegion || selectedRegion === 'global') {
    return false;
  }

  const availability = species.availability[selectedRegion];
  if (availability === 'common' || availability === 'occasional') {
    return false;
  }

  if (availability === 'rare_import') {
    const groupKey = regions.regions[selectedRegion]?.season_group;
    if (!groupKey) {
      return true;
    }
    const entry = seasonEntry(species, groupKey);
    if (!entry) {
      return true;
    }
    if (entry.months.length > 0) {
      return false;
    }
    return !(
      isPreservedYearRound(species, groupKey) ||
      isFreshYearRound(species, groupKey)
    );
  }

  // 'none', 'unknown', and missing keys all mean no local distribution.
  return true;
}

/**
 * True when the species is at its fresh seasonal peak in the selected market.
 * Preserved/frozen year-round supply never counts as in-season.
 */
export function isSpeciesInSeason(
  species: SpeciesRecord,
  month: number,
  selectedRegion: string,
  regions: RegionsPayload,
  includeFreshYearRound = false,
): boolean {
  if (
    selectedRegion &&
    selectedRegion !== 'global' &&
    isSpeciesUnavailableInRegion(species, selectedRegion, regions)
  ) {
    return false;
  }

  const checkGroup = (groupKey: string): boolean =>
    isFreshInSeasonForGroup(species, groupKey, month) ||
    (includeFreshYearRound && isFreshYearRound(species, groupKey));

  if (!selectedRegion || selectedRegion === 'global') {
    return enabledSeasonGroups(regions).some(checkGroup);
  }

  const region = regions.regions[selectedRegion];
  if (!region) {
    return enabledSeasonGroups(regions).some(checkGroup);
  }

  return checkGroup(region.season_group);
}

/** True when any season group lists the month as fresh season. */
export function isFreshInSeasonAnywhere(
  species: SpeciesRecord,
  month: number,
  regions: RegionsPayload,
): boolean {
  const groups = new Set<string>(enabledSeasonGroups(regions));
  for (const groupKey of Object.keys(species.seasonality.by_group)) {
    groups.add(groupKey);
  }
  for (const groupKey of groups) {
    if (isFreshInSeasonForGroup(species, groupKey, month)) {
      return true;
    }
  }
  return false;
}

const REGION_SHORT_LABELS: Record<string, string> = {
  au: '澳洲',
  cn_north: '中国北方',
  cn_east: '江浙沪',
  cn_south: '闽粤',
};

const CN_REGION_KEYS = ['cn_north', 'cn_east', 'cn_south'] as const;
const CN_REGION_KEY_SET = new Set<string>(CN_REGION_KEYS);

/** Concise human-readable summary of markets where the species is sold. */
export function formatCommonPlaces(
  species: SpeciesRecord,
  regions: RegionsPayload,
): string {
  const enabledKeys = Object.entries(regions.regions)
    .filter(([, config]) => config.enabled)
    .map(([key]) => key);
  const keys = enabledKeys.length > 0 ? enabledKeys : Object.keys(regions.regions);

  const availableKeys = keys.filter((key) => {
    const availability = species.availability[key];
    return availability === 'common' || availability === 'occasional';
  });

  const labelFor = (key: string): string =>
    REGION_SHORT_LABELS[key] ?? regions.regions[key]?.label ?? key;

  if (availableKeys.length === 0) {
    const hasImport = keys.some(
      (key) => species.availability[key] === 'rare_import',
    );
    return hasImport ? '进口冻品/制品' : '暂无公开分布';
  }

  const hasAu = availableKeys.includes('au');
  const cnKeys = CN_REGION_KEYS.filter((key) => availableKeys.includes(key));
  const otherKeys = availableKeys.filter(
    (key) => key !== 'au' && !CN_REGION_KEY_SET.has(key),
  );

  if (hasAu && cnKeys.length === CN_REGION_KEYS.length) {
    return '中澳常见';
  }
  if (hasAu && cnKeys.length === 0 && otherKeys.length === 0) {
    return '澳洲常见';
  }

  const parts = cnKeys.map(labelFor);
  if (hasAu) {
    parts.push('澳洲');
  }
  parts.push(...otherKeys.map(labelFor));
  return parts.join('/');
}

const AVAILABILITY_WEIGHT: Record<Availability, number> = {
  common: 4,
  occasional: 3,
  rare_import: 2,
  unknown: 1,
  none: 0,
};

function availabilityWeight(value: Availability | undefined): number {
  return value ? AVAILABILITY_WEIGHT[value] : 0;
}

function supplyBonus(species: SpeciesRecord, groupKey: string | null): number {
  if (!groupKey) {
    return 0;
  }
  if (isFreshYearRound(species, groupKey)) {
    return 2;
  }
  if (isPreservedYearRound(species, groupKey)) {
    return 1;
  }
  return 0;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value = (value + Math.imul(value ^ (value >>> 7), value | 61)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRng(parts: Array<string | number>): () => number {
  return mulberry32(hashString(parts.join('|')));
}

function weightedShuffle<T>(
  items: T[],
  weightOf: (item: T) => number,
  rng: () => number,
): T[] {
  return items
    .map((item) => ({
      item,
      key: Math.pow(rng(), 1 / Math.max(weightOf(item), 0.05)),
    }))
    .sort((a, b) => b.key - a.key)
    .map((entry) => entry.item);
}

/**
 * Home feed ranking with strict, non-mixing tiers.
 *
 * Specific region:
 *   1. local distribution + local fresh season
 *   2. local distribution + not fresh season (common > occasional > rare_import)
 *   3. no local distribution + fresh season elsewhere
 *   4. no local distribution + not in season
 *
 * Global: 1. fresh season somewhere, 2. everything else (fresh year-round first).
 */
export function buildHomeRankedFeed(
  species: SpeciesRecord[],
  selectedRegion: string,
  regions: RegionsPayload,
  month: number,
  seed: number,
): SpeciesRecord[] {
  if (selectedRegion === 'global') {
    const groups = enabledSeasonGroups(regions);
    const tierOne: SpeciesRecord[] = [];
    const tierTwo: SpeciesRecord[] = [];

    for (const item of species) {
      if (isSpeciesInSeason(item, month, 'global', regions, false)) {
        tierOne.push(item);
      } else {
        tierTwo.push(item);
      }
    }

    const first = weightedShuffle(
      tierOne,
      (item) => 1 + (groups.some((key) => isFreshYearRound(item, key)) ? 0.5 : 0),
      seededRng([seed, selectedRegion, month, 'tier-1']),
    );
    const second = weightedShuffle(
      tierTwo,
      (item) => {
        if (groups.some((key) => isFreshYearRound(item, key))) {
          return 3;
        }
        if (groups.some((key) => isPreservedYearRound(item, key))) {
          return 1;
        }
        return 0.5;
      },
      seededRng([seed, selectedRegion, month, 'tier-2']),
    );

    return [...first, ...second];
  }

  const groupKey = regions.regions[selectedRegion]?.season_group ?? null;
  const buckets: [
    SpeciesRecord[],
    SpeciesRecord[],
    SpeciesRecord[],
    SpeciesRecord[],
  ] = [[], [], [], []];

  for (const item of species) {
    const unavailable = isSpeciesUnavailableInRegion(
      item,
      selectedRegion,
      regions,
    );
    if (!unavailable) {
      const freshSeason = groupKey
        ? isFreshInSeasonForGroup(item, groupKey, month)
        : false;
      buckets[freshSeason ? 0 : 1].push(item);
      continue;
    }
    buckets[isFreshInSeasonAnywhere(item, month, regions) ? 2 : 3].push(item);
  }

  const rngBase = [seed, selectedRegion, month];
  const first = weightedShuffle(
    buckets[0],
    (item) =>
      availabilityWeight(item.availability[selectedRegion]) * 10 +
      supplyBonus(item, groupKey),
    seededRng([...rngBase, 'tier-1']),
  );
  const second = weightedShuffle(
    buckets[1],
    (item) =>
      availabilityWeight(item.availability[selectedRegion]) * 10 +
      supplyBonus(item, groupKey),
    seededRng([...rngBase, 'tier-2']),
  );
  const third = weightedShuffle(
    buckets[2],
    (item) => 1 + supplyBonus(item, groupKey),
    seededRng([...rngBase, 'tier-3']),
  );
  const fourth = weightedShuffle(
    buckets[3],
    () => 1,
    seededRng([...rngBase, 'tier-4']),
  );

  return [...first, ...second, ...third, ...fourth];
}

export interface RaffleEntry {
  species: SpeciesRecord;
  weight: number;
  reason: 'fresh_season' | 'fresh_year_round' | 'preserved_year_round';
}

export interface RafflePoolOptions {
  onlyInSeason?: boolean;
}

/**
 * Build the weighted raffle pool.
 * Unavailable species and species with no fresh/preserved supply are excluded.
 * Preserved-only entries join only when `onlyInSeason === false`.
 */
export function buildRafflePool(
  species: SpeciesRecord[],
  selectedRegion: string,
  regions: RegionsPayload,
  month: number,
  options: RafflePoolOptions | boolean = {},
): RaffleEntry[] {
  const onlyInSeason =
    typeof options === 'boolean' ? options : options.onlyInSeason ?? true;
  const isGlobal = !selectedRegion || selectedRegion === 'global';
  const groupKey = isGlobal
    ? null
    : regions.regions[selectedRegion]?.season_group ?? null;
  const groups = isGlobal
    ? enabledSeasonGroups(regions)
    : groupKey
      ? [groupKey]
      : [];
  const entries: RaffleEntry[] = [];

  for (const item of species) {
    if (isSpeciesUnavailableInRegion(item, selectedRegion, regions)) {
      continue;
    }

    const freshSeason = groups.some((key) =>
      isFreshInSeasonForGroup(item, key, month),
    );
    const freshYearRound = groups.some((key) => isFreshYearRound(item, key));
    const preservedYearRound = groups.some((key) =>
      isPreservedYearRound(item, key),
    );

    if (freshSeason) {
      entries.push({ species: item, weight: 3.0, reason: 'fresh_season' });
      continue;
    }
    if (freshYearRound) {
      entries.push({ species: item, weight: 1.5, reason: 'fresh_year_round' });
      continue;
    }
    if (!onlyInSeason && preservedYearRound) {
      const rareImport =
        !isGlobal && item.availability[selectedRegion] === 'rare_import';
      entries.push({
        species: item,
        weight: rareImport ? 0.3 : 0.5,
        reason: 'preserved_year_round',
      });
    }
  }

  return entries;
}

/** Weighted pick that honours round deduplication. Returns null when exhausted. */
export function pickWeightedRaffleSpecies(
  pool: RaffleEntry[],
  excludeIds: string[] = [],
  rng: () => number = Math.random,
): SpeciesRecord | null {
  const excluded = new Set(excludeIds);
  const candidates = pool.filter((entry) => !excluded.has(entry.species.id));
  if (candidates.length === 0) {
    return null;
  }

  let total = 0;
  for (const entry of candidates) {
    total += Math.max(entry.weight, 0);
  }
  if (total <= 0) {
    return candidates[Math.floor(rng() * candidates.length)]?.species ?? null;
  }

  let roll = rng() * total;
  for (const entry of candidates) {
    roll -= Math.max(entry.weight, 0);
    if (roll <= 0) {
      return entry.species;
    }
  }
  return candidates[candidates.length - 1].species;
}

/**
 * Return the season entry for a selected market, or every group in global mode.
 * Specific markets return a single entry (or `null` when the group is absent).
 */
export function getSpeciesSeasonInfoForRegion(
  species: SpeciesRecord,
  selectedRegion: string,
  regions: RegionsPayload,
): SpeciesSeasonInfo | SpeciesSeasonInfo[] | null {
  const build = (groupKey: string): SpeciesSeasonInfo | null => {
    const entry = species.seasonality.by_group[groupKey];
    if (!entry) {
      return null;
    }
    const groupConfig = regions.season_groups[groupKey];
    return {
      groupKey,
      groupLabel: groupConfig?.label ?? groupKey,
      hemisphere: groupConfig?.hemisphere ?? null,
      months: entry.months,
      note: entry.note,
      yearRound: species.seasonality.year_round,
    };
  };

  if (!selectedRegion || selectedRegion === 'global') {
    const infos: SpeciesSeasonInfo[] = [];
    for (const groupKey of Object.keys(species.seasonality.by_group)) {
      const info = build(groupKey);
      if (info) {
        infos.push(info);
      }
    }
    return infos;
  }

  const region = regions.regions[selectedRegion];
  if (!region) {
    const infos: SpeciesSeasonInfo[] = [];
    for (const groupKey of Object.keys(species.seasonality.by_group)) {
      const info = build(groupKey);
      if (info) {
        infos.push(info);
      }
    }
    return infos;
  }

  return build(region.season_group);
}

function getFishAttrs(species: SpeciesRecord): FishCategoryAttrs | null {
  if (species.category !== 'FI') {
    return null;
  }
  return species.category_attrs as FishCategoryAttrs;
}

function hasSafetyAlert(species: SpeciesRecord): boolean {
  return species.safety_and_legal.some((item) => item.severity !== 'low');
}

function matchesCooking(
  species: SpeciesRecord,
  filter: HomeFilterState,
): boolean {
  if (filter.cookingTags.length === 0) {
    return true;
  }
  const available = new Set<CookingTag>();
  for (const method of species.culinary.methods) {
    if (filter.cookingSignatureOnly && method.tier !== 'signature') {
      continue;
    }
    available.add(method.tag);
  }
  return filter.cookingTags.some((tag) => available.has(tag));
}

/**
 * Cross-dimension AND, within-dimension OR.
 */
export function filterSpecies(
  species: SpeciesRecord[],
  filter: HomeFilterState,
  selectedRegion: string,
  regions: RegionsPayload,
  month: number,
  selectedCategory: CategoryCode | 'ALL',
): SpeciesRecord[] {
  const hasFatFilter = filter.fatRange[0] > 0 || filter.fatRange[1] < 10;

  return species.filter((item) => {
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
      return false;
    }

    if (filter.regionAvailability.length > 0) {
      const availableInRegion = filter.regionAvailability.some((regionKey) => {
        const availability = item.availability[regionKey];
        return (
          availability !== undefined &&
          availability !== 'none' &&
          availability !== 'unknown'
        );
      });
      if (!availableInRegion) {
        return false;
      }
    }

    if (
      filter.salinity.length > 0 &&
      !filter.salinity.includes(item.habitat.salinity)
    ) {
      return false;
    }

    if (
      filter.sashimiLevels.length > 0 &&
      (item.sashimi.level === null ||
        !filter.sashimiLevels.includes(item.sashimi.level))
    ) {
      return false;
    }

    const fishAttrs = getFishAttrs(item);

    if (filter.pinBoneLevels.length > 0) {
      const level = fishAttrs?.pin_bone_level ?? null;
      if (level === null || !filter.pinBoneLevels.includes(level)) {
        return false;
      }
    }

    if (hasFatFilter) {
      const fat = fishAttrs?.fat_level ?? null;
      if (
        fat === null ||
        fat === undefined ||
        fat < filter.fatRange[0] ||
        fat > filter.fatRange[1]
      ) {
        return false;
      }
    }

    if (filter.histamineRisks.length > 0) {
      const risk = fishAttrs?.histamine_risk ?? null;
      if (risk === null || !filter.histamineRisks.includes(risk)) {
        return false;
      }
    }

    if (filter.fleshColors.length > 0) {
      const flesh = fishAttrs?.flesh_color_tag ?? null;
      if (flesh === null || !filter.fleshColors.includes(flesh)) {
        return false;
      }
    }

    if (!matchesCooking(item, filter)) {
      return false;
    }

    if (
      filter.onlyInSeason &&
      !isSpeciesInSeason(item, month, selectedRegion, regions, false)
    ) {
      return false;
    }

    if (filter.onlyWithSafetyAlert && !hasSafetyAlert(item)) {
      return false;
    }

    return true;
  });
}