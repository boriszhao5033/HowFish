import type { IdRedirects, SpeciesRecord } from '../types/schema';

/**
 * Resolve an ID through the redirect chain until a terminal ID is reached.
 * Cycles are detected and safely stopped, returning the last stable ID.
 */
export function resolveRedirectId(id: string, redirects: IdRedirects): string {
  if (!id) {
    return id;
  }

  let current = id;
  const visited = new Set<string>();

  while (Object.prototype.hasOwnProperty.call(redirects, current)) {
    if (visited.has(current)) {
      break;
    }
    visited.add(current);
    const next = redirects[current];
    if (!next || next === current) {
      break;
    }
    current = next;
  }

  return current;
}

/** Migrate a list of IDs, removing duplicates while preserving order. */
export function migrateIdList(ids: string[], redirects: IdRedirects): string[] {
  const seen = new Set<string>();
  const migrated: string[] = [];

  for (const id of ids) {
    if (!id) {
      continue;
    }
    const resolved = resolveRedirectId(id, redirects);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      migrated.push(resolved);
    }
  }

  return migrated;
}

/** Migrate every key in a record and merge collisions when a merger is given. */
export function migrateRecordMap<T>(
  record: Record<string, T>,
  redirects: IdRedirects,
  mergeFn?: (a: T, b: T) => T,
): Record<string, T> {
  const migrated: Record<string, T> = {};

  for (const [id, value] of Object.entries(record)) {
    if (!id) {
      continue;
    }
    const resolved = resolveRedirectId(id, redirects);
    if (Object.prototype.hasOwnProperty.call(migrated, resolved)) {
      migrated[resolved] = mergeFn
        ? mergeFn(migrated[resolved], value)
        : value;
    } else {
      migrated[resolved] = value;
    }
  }

  return migrated;
}

export type KinshipKind =
  | 'same_record'
  | 'same_species_ab'
  | 'same_genus'
  | 'same_family'
  | 'different_category'
  | 'cross_family';

export type KinshipTone = 'purple' | 'blue' | 'green' | 'neutral' | 'orange';

export interface KinshipDiagnosis {
  kind: KinshipKind;
  label: string;
  tone: KinshipTone;
  emoji: string;
  explanation: string;
  matchedPrefixLength: number;
}

/**
 * Diagnose the relationship between two 11+ digit lineage IDs.
 *
 * ID structure: AA(2) + CC(2) + OO(2) + FF(2) + T(1) + GG(2) + SS(2) + v(0-1)
 * Base species IDs are 13 characters; an optional trailing a/b marks a variant.
 */
export function diagnoseKinship(
  idA: string,
  idB: string,
): KinshipDiagnosis {
  if (idA === idB) {
    return {
      kind: 'same_record',
      label: '同一物种记录',
      tone: 'neutral',
      emoji: '⚪',
      explanation: '完整记录 ID 完全一致，为同一物种记录。',
      matchedPrefixLength: Math.max(idA.length, idB.length),
    };
  }

  if (idA.slice(0, 13) === idB.slice(0, 13)) {
    return {
      kind: 'same_species_ab',
      label: '同种不同产地/季节品系（a/b 分化）',
      tone: 'purple',
      emoji: '🟣',
      explanation:
        '前 13 位基础种码一致，仅末位 a/b 品系不同：属于同种不同产地或季节分化群体。',
      matchedPrefixLength: 13,
    };
  }

  if (idA.slice(0, 11) === idB.slice(0, 11)) {
    return {
      kind: 'same_genus',
      label: '同属亲兄弟',
      tone: 'blue',
      emoji: '🔵',
      explanation:
        '前 11 位属级谱系码一致：同属亲兄弟，风味、肉质与做法往往高度接近。',
      matchedPrefixLength: 11,
    };
  }

  if (idA.slice(0, 8) === idB.slice(0, 8)) {
    return {
      kind: 'same_family',
      label: '同科近亲（常可互为平替）',
      tone: 'green',
      emoji: '🟢',
      explanation:
        '前 8 位科级谱系码一致：同科近亲，鱼市缺货时常可作为风味平替。',
      matchedPrefixLength: 8,
    };
  }

  if (idA.slice(0, 2) !== idB.slice(0, 2)) {
    return {
      kind: 'different_category',
      label: '不同海产大类',
      tone: 'neutral',
      emoji: '⚪',
      explanation: `前 2 位大类码不同（${idA.slice(0, 2)} vs ${idB.slice(0, 2)}）：属于不同海产大类，无近缘血缘关系。`,
      matchedPrefixLength: 0,
    };
  }

  return {
    kind: 'cross_family',
    label: '跨科无血缘（谨防市场俗名混淆！）',
    tone: 'orange',
    emoji: '🟠',
    explanation: `同属 ${idA.slice(0, 2)} 大类，但科级谱系码不同：跨科无血缘，市场俗名极易混淆。`,
    matchedPrefixLength: 2,
  };
}

export interface RelatedSpecies {
  abSiblings: SpeciesRecord[];
  sameGenus: SpeciesRecord[];
  sameFamily: SpeciesRecord[];
}

/** Find a/b siblings, same-genus relatives and same-family relatives. */
export function getRelatedSpecies(
  target: SpeciesRecord,
  allSpecies: SpeciesRecord[],
): RelatedSpecies {
  const speciesPrefix = target.id.slice(0, 13);
  const genusPrefix = target.id.slice(0, 11);
  const familyPrefix = target.id.slice(0, 8);

  const abSiblings: SpeciesRecord[] = [];
  const sameGenus: SpeciesRecord[] = [];
  const sameFamily: SpeciesRecord[] = [];

  for (const candidate of allSpecies) {
    if (candidate.id === target.id) {
      continue;
    }

    if (candidate.id.slice(0, 13) === speciesPrefix) {
      abSiblings.push(candidate);
    } else if (candidate.id.slice(0, 11) === genusPrefix) {
      sameGenus.push(candidate);
    } else if (candidate.id.slice(0, 8) === familyPrefix) {
      sameFamily.push(candidate);
    }
  }

  const byId = (a: SpeciesRecord, b: SpeciesRecord) => a.id.localeCompare(b.id);
  abSiblings.sort(byId);
  sameGenus.sort(byId);
  sameFamily.sort(byId);

  return { abSiblings, sameGenus, sameFamily };
}