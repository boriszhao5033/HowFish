import metaJson from '../../public/data/meta.json';
import redirectsJson from '../../public/data/id_redirects.json';
import regionsJson from '../../public/data/regions.json';
import speciesJson from '../../public/data/species.json';
import taxonomyJson from '../../public/data/taxonomy.json';
import trapsJson from '../../public/data/traps.json';

import {
  CATEGORY_CODES,
  type CategoryCode,
  type IdRedirects,
  type LoadedAppData,
  type MetaPayload,
  type RegionsPayload,
  type SpeciesRecord,
  type TaxonomyPayload,
  type TrapsPayload,
} from '../types/schema';

export const IS_SINGLE_FILE = import.meta.env.VITE_SINGLE_FILE === 'true';

const STATIC_SPECIES = speciesJson as unknown as SpeciesRecord[];
const STATIC_TAXONOMY = taxonomyJson as unknown as TaxonomyPayload;
const STATIC_TRAPS = trapsJson as unknown as TrapsPayload;
const STATIC_REGIONS = regionsJson as unknown as RegionsPayload;
const STATIC_REDIRECTS = redirectsJson as unknown as IdRedirects;
const STATIC_META = metaJson as unknown as MetaPayload;

const DATA_BASE = `${import.meta.env.BASE_URL}data/`;

function buildLoadedAppData(
  speciesInput: SpeciesRecord[],
  taxonomy: TaxonomyPayload,
  traps: TrapsPayload,
  regions: RegionsPayload,
  redirects: IdRedirects,
  meta: MetaPayload,
): LoadedAppData {
  const species = [...speciesInput].sort((a, b) => a.id.localeCompare(b.id));
  const speciesById: Record<string, SpeciesRecord> = {};
  for (const item of species) {
    speciesById[item.id] = item;
  }

  const taxonomyNodes = taxonomy.nodes;
  const taxonomyByCode: Record<string, (typeof taxonomyNodes)[number]> = {};
  for (const node of taxonomyNodes) {
    taxonomyByCode[node.code] = node;
  }

  const present = new Set<CategoryCode>(species.map((item) => item.category));
  const categoriesPresent = CATEGORY_CODES.filter((code) => present.has(code));

  return {
    species,
    speciesById,
    taxonomyNodes,
    taxonomyByCode,
    traps,
    regions,
    redirects,
    meta,
    categoriesPresent,
  };
}

async function fetchJson<T>(file: string): Promise<T> {
  const response = await fetch(`${DATA_BASE}${file}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`无法加载 ${file}（HTTP ${response.status}）`);
  }
  return (await response.json()) as T;
}

export function loadStaticAppData(): LoadedAppData {
  return buildLoadedAppData(
    STATIC_SPECIES,
    STATIC_TAXONOMY,
    STATIC_TRAPS,
    STATIC_REGIONS,
    STATIC_REDIRECTS,
    STATIC_META,
  );
}

export async function loadFetchedAppData(): Promise<LoadedAppData> {
  const [species, taxonomy, traps, regions, redirects, meta] = await Promise.all([
    fetchJson<SpeciesRecord[]>('species.json'),
    fetchJson<TaxonomyPayload>('taxonomy.json'),
    fetchJson<TrapsPayload>('traps.json'),
    fetchJson<RegionsPayload>('regions.json'),
    fetchJson<IdRedirects>('id_redirects.json'),
    fetchJson<MetaPayload>('meta.json'),
  ]);

  return buildLoadedAppData(species, taxonomy, traps, regions, redirects, meta);
}

interface PackedBundle {
  species: SpeciesRecord[];
  taxonomy: TaxonomyPayload;
  traps: TrapsPayload;
  regions: RegionsPayload;
  redirects: IdRedirects;
  meta: MetaPayload;
}

/**
 * Single-file builds embed one gzip-compressed payload as Base64 so the whole
 * dataset travels inside the HTML. `fflate` is a pure-JS ES2020 gunzip, which
 * keeps `file://` loading working on iOS Safari 14+ and WeChat WebViews.
 */
export async function loadSingleFileAppData(): Promise<LoadedAppData> {
  const [{ PACKED_DATA_B64 }, { gunzipSync }] = await Promise.all([
    import('virtual:howfish-single-data'),
    import('fflate'),
  ]);

  const binary = atob(PACKED_DATA_B64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const json = new TextDecoder('utf-8').decode(gunzipSync(bytes));
  const bundle = JSON.parse(json) as PackedBundle;

  return buildLoadedAppData(
    bundle.species,
    bundle.taxonomy,
    bundle.traps,
    bundle.regions,
    bundle.redirects,
    bundle.meta,
  );
}

/**
 * Single-file builds decode their embedded payload so the app works under
 * `file://` without CORS. PWA builds use fetch so the service worker can
 * pre-cache the data files; `fflate` is dead-code-eliminated there.
 */
export async function loadAppData(): Promise<LoadedAppData> {
  if (IS_SINGLE_FILE) {
    return loadSingleFileAppData();
  }
  return loadFetchedAppData();
}