import Fuse from 'fuse.js';
import type { FuseResultMatch } from 'fuse.js';

import type {
  CrossFamilyTrap,
  RegionsPayload,
  SpeciesRecord,
  TrapsPayload,
} from '../types/schema';
import { getAliasRegionLabel } from '../types/schema';

export interface SearchEngine {
  fuse: Fuse<SpeciesRecord>;
  species: SpeciesRecord[];
}

export interface SpeciesSearchHit {
  item: SpeciesRecord;
  score: number;
  matchSource?: string;
}

const SEARCH_WEIGHTS = {
  zhFormal: 3.0,
  aliases: 2.8,
  enStandard: 2.5,
  signatureDishes: 2.2,
  pinyin: 2.0,
  latin: 1.8,
  identificationTips: 1.0,
} as const;

function collectAliasKeys(species: SpeciesRecord[]): string[] {
  const keys = new Set<string>();
  for (const item of species) {
    for (const key of Object.keys(item.names.aliases)) {
      keys.add(key);
    }
  }
  if (keys.size === 0) {
    keys.add('au');
    keys.add('cn_north');
    keys.add('cn_east');
    keys.add('cn_south');
  }
  return Array.from(keys);
}

export function buildSearchEngine(species: SpeciesRecord[]): SearchEngine {
  const aliasKeys = collectAliasKeys(species);
  const keys = [
    { name: 'names.zh_formal', weight: SEARCH_WEIGHTS.zhFormal },
    ...aliasKeys.map((aliasKey) => ({
      name: `names.aliases.${aliasKey}`,
      weight: SEARCH_WEIGHTS.aliases,
    })),
    { name: 'names.en_standard', weight: SEARCH_WEIGHTS.enStandard },
    { name: 'culinary.signature_dishes', weight: SEARCH_WEIGHTS.signatureDishes },
    { name: '_search.pinyin_full', weight: SEARCH_WEIGHTS.pinyin },
    { name: '_search.pinyin_initials', weight: SEARCH_WEIGHTS.pinyin },
    { name: 'names.latin', weight: SEARCH_WEIGHTS.latin },
    {
      name: 'buying_guide.identification_tips',
      weight: SEARCH_WEIGHTS.identificationTips,
    },
  ];

  const fuse = new Fuse(species, {
    keys,
    threshold: 0.5,
    ignoreLocation: false,
    ignoreDiacritics: true,
    minMatchCharLength: 1,
    includeScore: true,
    includeMatches: true,
    shouldSort: true,
    useExtendedSearch: false,
  });

  return { fuse, species };
}

function truncate(text: string, maxLength = 24): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}…`;
}

function matchedText(match: FuseResultMatch, fallback: string): string {
  const value = typeof match.value === 'string' ? match.value : fallback;
  const indices = match.indices;
  if (indices && indices.length > 0) {
    const [start, end] = indices[0];
    const slice = value.slice(start, end + 1);
    if (slice) {
      return slice;
    }
  }
  return value || fallback;
}

interface RankedMatch {
  match: FuseResultMatch;
  priority: number;
  aliasOrder: number;
}

function rankMatches(
  matches: readonly FuseResultMatch[] | undefined,
  regions: RegionsPayload,
): RankedMatch[] {
  if (!matches) {
    return [];
  }

  const regionOrder = new Map<string, number>();
  Object.keys(regions.regions).forEach((key, index) => {
    regionOrder.set(key, index);
  });

  const ranked: RankedMatch[] = [];

  for (const match of matches) {
    const key = match.key ?? '';
    let priority = 99;
    let aliasOrder = 99;

    if (key.startsWith('names.aliases.')) {
      priority = 0;
      const aliasKey = key.slice('names.aliases.'.length);
      aliasOrder = regionOrder.get(aliasKey) ?? 50;
    } else if (key === 'names.en_standard') {
      priority = 1;
    } else if (key === 'culinary.signature_dishes') {
      priority = 2;
    } else if (key === '_search.pinyin_full') {
      priority = 3;
    } else if (key === '_search.pinyin_initials') {
      priority = 4;
    } else if (key === 'names.latin') {
      priority = 5;
    } else if (key === 'buying_guide.identification_tips') {
      priority = 6;
    } else if (key === 'names.zh_formal') {
      priority = 7;
    }

    if (priority < 99) {
      ranked.push({ match, priority, aliasOrder });
    }
  }

  return ranked.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    if (a.aliasOrder !== b.aliasOrder) {
      return a.aliasOrder - b.aliasOrder;
    }
    return 0;
  });
}

function describeHit(
  matches: readonly FuseResultMatch[] | undefined,
  regions: RegionsPayload,
  query: string,
): string | undefined {
  const ranked = rankMatches(matches, regions);
  const best = ranked.find((entry) => entry.priority !== 7);
  if (!best) {
    return undefined;
  }

  const key = best.match.key ?? '';
  const text = truncate(matchedText(best.match, query));

  if (key.startsWith('names.aliases.')) {
    const aliasKey = key.slice('names.aliases.'.length);
    return `命中${getAliasRegionLabel(aliasKey)}俗称：${text}`;
  }

  switch (key) {
    case 'names.en_standard':
      return `命中英文名：${text}`;
    case 'culinary.signature_dishes':
      return `命中招牌名菜：${text}`;
    case '_search.pinyin_full':
      return `命中拼音：${text.toLowerCase()}`;
    case '_search.pinyin_initials':
      return `命中拼音首字母：${text.toLowerCase()}`;
    case 'names.latin':
      return `命中拉丁学名：${text}`;
    case 'buying_guide.identification_tips':
      return `命中辨识要点：${text}`;
    default:
      return undefined;
  }
}

export function searchSpecies(
  engine: SearchEngine,
  query: string,
  candidates: SpeciesRecord[],
  regions: RegionsPayload,
): SpeciesSearchHit[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return candidates.map((item) => ({ item, score: 0 }));
  }

  const candidateIds = new Set(candidates.map((item) => item.id));
  const results = engine.fuse.search(trimmed);

  const hits: SpeciesSearchHit[] = [];
  for (const result of results) {
    if (!candidateIds.has(result.item.id)) {
      continue;
    }
    const hit: SpeciesSearchHit = {
      item: result.item,
      score: result.score ?? 0,
    };
    const matchSource = describeHit(result.matches, regions, trimmed);
    if (matchSource) {
      hit.matchSource = matchSource;
    }
    hits.push(hit);
  }

  return hits;
}

/** Case-insensitive contains matching against cross-family trap triggers. */
export function matchTrapsForQuery(
  query: string,
  traps: TrapsPayload,
): CrossFamilyTrap[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return traps.cross_family_traps.filter((trap) =>
    trap.aliases_trigger.some((trigger) => {
      const normalizedTrigger = trigger.trim().toLowerCase();
      if (!normalizedTrigger) {
        return false;
      }
      return (
        normalized.includes(normalizedTrigger) ||
        normalizedTrigger.includes(normalized)
      );
    }),
  );
}