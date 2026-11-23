import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, Info, Plus, RotateCcw, Search, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';

import {
  HorizontalScrollSyncBar,
  useDragToScroll,
} from '../components/common/HorizontalScrollSyncBar';
import {
  TableZoomControls,
  usePinchZoom,
} from '../components/common/TableZoomControls';
import {
  ColumnCustomizer,
  type CustomizerColumn,
} from '../components/table/ColumnCustomizer';
import {
  ColumnHeaderFilter,
  type ColumnFilterOption,
  type SortDirection,
} from '../components/table/ColumnHeaderFilter';
import { useData } from '../context/DataContext';
import {
  isWeChatBrowser,
  WECHAT_OPEN_IN_BROWSER_TIP,
} from '../services/browserEnv';
import { downloadSpeciesCsv, type CsvColumnDef } from '../services/csvExport';
import { useAppStore, type TablePreset } from '../store/useAppStore';
import {
  AVAILABILITY_SHORT_LABELS,
  CATEGORY_LABELS,
  COOKING_TAGS,
  FLESH_COLOR_LIST,
  HISTAMINE_LABELS,
  MARKET_FORMS,
  ODOR_PROFILES,
  PIN_BONE_LABELS,
  SALINITY_LABELS,
  SASHIMI_LABELS,
  getAliasRegionLabel,
  type Availability,
  type CookingTag,
  type FishCategoryAttrs,
  type HistamineRisk,
  type PinBoneLevel,
  type RegionsPayload,
  type SashimiLevel,
  type SafetySeverity,
  type SpeciesRecord,
  type TaxonomyNode,
} from '../types/schema';

type SortValue = string | number | null;

interface ColumnSpec {
  id: string;
  label: string;
  width: number;
  getValue: (species: SpeciesRecord) => string;
  getSortValue?: (species: SpeciesRecord) => SortValue;
  getFilterValues?: (species: SpeciesRecord) => string[];
  optionValues?: string[];
  align?: 'left' | 'center';
}

const EMPTY_SPECIES: SpeciesRecord[] = [];
const EMPTY_TAXONOMY_BY_CODE: Record<string, TaxonomyNode> = {};
const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 44;

const PRESET_LABELS: Record<TablePreset, string> = {
  core: '核心选购列',
  aliases: '多地俗称列',
  full: '完整全表',
};

const PIN_BONE_ORDER: PinBoneLevel[] = ['none', 'few', 'moderate', 'many'];
const HISTAMINE_ORDER: HistamineRisk[] = [
  'low',
  'medium',
  'medium_high',
  'high',
  'very_high',
];
const SASHIMI_ORDER: SashimiLevel[] = [
  'recommended',
  'conditional',
  'traditional_not_recommended',
  'not_recommended',
  'forbidden',
];
const PRICE_ORDER = ['$', '$$', '$$$', '$$$$'] as const;

const AVAILABILITY_ORDER: Availability[] = [
  'common',
  'occasional',
  'rare_import',
  'none',
  'unknown',
];

const AVAILABILITY_RANK: Record<Availability, number> = {
  common: 0,
  occasional: 1,
  rare_import: 2,
  none: 3,
  unknown: 4,
};

const AVAILABILITY_DOT_CLASS: Record<Availability, string> = {
  common: 'bg-emerald-500 dark:bg-emerald-400',
  occasional: 'bg-amber-500 dark:bg-amber-400',
  rare_import: 'bg-sky-500 dark:bg-sky-400',
  none: 'bg-red-400 dark:bg-red-400',
  unknown: 'bg-slate-400 dark:bg-slate-500',
};

const AVAILABILITY_SHORT_OPTIONS = AVAILABILITY_ORDER.map(
  (value) => AVAILABILITY_SHORT_LABELS[value],
);

const PIN_BONE_RANK = {
  none: 0,
  few: 1,
  moderate: 2,
  many: 3,
} as const satisfies Record<PinBoneLevel, number>;

const HISTAMINE_RANK = {
  low: 0,
  medium: 1,
  medium_high: 2,
  high: 3,
  very_high: 4,
} as const satisfies Record<HistamineRisk, number>;

const SASHIMI_RANK = {
  recommended: 0,
  conditional: 1,
  traditional_not_recommended: 2,
  not_recommended: 3,
  forbidden: 4,
} as const satisfies Record<SashimiLevel, number>;

const SAFETY_RANK: Record<SafetySeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const SAFETY_OPTIONS = ['红牌警示', '黄色提醒', '低风险', '无警示'];

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (value && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

function fishAttrs(species: SpeciesRecord): FishCategoryAttrs | null {
  return species.category === 'FI'
    ? (species.category_attrs as FishCategoryAttrs)
    : null;
}

function signatureTags(species: SpeciesRecord): CookingTag[] {
  const tags: CookingTag[] = [];
  for (const method of species.culinary.methods) {
    if (method.tier === 'signature' && !tags.includes(method.tag)) {
      tags.push(method.tag);
    }
  }
  return tags;
}

function cookingFilterValues(species: SpeciesRecord): string[] {
  const tags = signatureTags(species);
  if (tags.length > 0) {
    return tags;
  }
  return species.culinary.methods.map((method) => method.tag);
}

function worstSafety(species: SpeciesRecord): SafetySeverity | null {
  let worst: SafetySeverity | null = null;
  for (const item of species.safety_and_legal) {
    if (!item.severity) {
      continue;
    }
    if (!worst || SAFETY_RANK[item.severity] > SAFETY_RANK[worst]) {
      worst = item.severity;
    }
  }
  return worst;
}

function safetyLabel(species: SpeciesRecord): string {
  const worst = worstSafety(species);
  if (worst === null) {
    return '无警示';
  }
  if (worst === 'critical' || worst === 'high') {
    return '红牌警示';
  }
  if (worst === 'medium') {
    return '黄色提醒';
  }
  return '低风险';
}

function aliasValue(species: SpeciesRecord, key: string): string {
  const aliases = species.names.aliases[key] ?? [];
  return aliases.length > 0 ? aliases.join('、') : '—';
}

function cleanTaxonName(value: string): string {
  const text = value.trim();
  if (!text) {
    return '';
  }
  const cleaned = text
    .replace(/\s*(?:[（(][^）)]*[)）]|\[[^\]]*\])\s*$/, '')
    .trim();
  return cleaned || text;
}

function taxonomyPathFor(
  species: SpeciesRecord,
  taxonomyByCode: Record<string, TaxonomyNode>,
): string {
  const stored = species.taxonomy_path?.trim();
  if (stored) {
    return stored;
  }
  const codes = species.taxon_codes;
  if (!codes) {
    return '—';
  }
  const parts: string[] = [];
  for (const level of ['superorder', 'order', 'family', 'genus'] as const) {
    const code = codes[level];
    const node = code ? taxonomyByCode[code] : undefined;
    const fallback =
      species.extra_attrs?.[level] ?? species.extra_attrs?.[`taxonomy_${level}`];
    const name = node?.name_zh?.trim()
      ? cleanTaxonName(node.name_zh)
      : typeof fallback === 'string' && fallback.trim()
        ? cleanTaxonName(fallback)
        : '';
    if (name) {
      parts.push(name);
    }
  }
  return parts.length > 0 ? parts.join('·') : '—';
}

function availabilityShort(species: SpeciesRecord, key: string): string {
  const value = species.availability[key] ?? 'unknown';
  return AVAILABILITY_SHORT_LABELS[value];
}

function formatMonths(months: number[]): string {
  if (months.length === 0) {
    return '';
  }
  if (months.length === 12) {
    return '全年';
  }
  return months.join('/');
}

function formatSeasonGroup(
  species: SpeciesRecord,
  key: string,
  regions: RegionsPayload,
): string | null {
  const group = species.seasonality.by_group[key];
  if (!group) {
    return null;
  }
  const hemisphere =
    regions.season_groups[key]?.hemisphere === 'south' ? '南半球' : '北半球';
  const parts: string[] = [];
  if (group.fresh_year_round) {
    parts.push('全年鲜食');
  }
  if (group.preserved_year_round) {
    parts.push('全年冻品/制品');
  }
  const months = formatMonths(group.months);
  if (months === '全年') {
    if (parts.length === 0) {
      parts.push('全年');
    }
  } else if (months) {
    parts.push(`${parts.length > 0 ? '峰值 ' : ''}${months}`);
  }
  if (parts.length === 0) {
    return null;
  }
  return `${hemisphere} ${parts.join(' · ')}`;
}

function buildSeasonText(
  species: SpeciesRecord,
  groupKeys: string[],
  regions: RegionsPayload,
): string {
  if (groupKeys.length === 0) {
    return '—';
  }
  const parts = groupKeys
    .map((key) => formatSeasonGroup(species, key, regions))
    .filter((value): value is string => Boolean(value));
  if (parts.length > 0) {
    return parts.join(' ｜ ');
  }
  return species.seasonality.year_round ? '全年可得' : '—';
}

function buildPriceText(species: SpeciesRecord, priceGroups: string[]): string {
  const tiers = uniqueStrings(
    priceGroups
      .map((group) => species.buying_guide.price_tier[group])
      .filter(Boolean) as string[],
  );
  return tiers.length > 0 ? tiers.join(' / ') : '—';
}

function priceFilterValues(species: SpeciesRecord, priceGroups: string[]): string[] {
  return uniqueStrings(
    priceGroups
      .map((group) => species.buying_guide.price_tier[group])
      .filter(Boolean) as string[],
  );
}

function compareRows(
  a: SpeciesRecord,
  b: SpeciesRecord,
  getValue: (species: SpeciesRecord) => SortValue,
): number {
  const aValue = getValue(a);
  const bValue = getValue(b);

  if (aValue === null && bValue === null) {
    return a.id.localeCompare(b.id);
  }
  if (aValue === null) {
    return 1;
  }
  if (bValue === null) {
    return -1;
  }

  if (typeof aValue === 'number' && typeof bValue === 'number') {
    if (aValue !== bValue) {
      return aValue - bValue;
    }
  } else {
    const compared = String(aValue).localeCompare(String(bValue), 'zh-Hans-CN', {
      numeric: true,
      sensitivity: 'base',
    });
    if (compared !== 0) {
      return compared;
    }
  }

  return a.id.localeCompare(b.id);
}

function buildColumnSpecs(
  species: SpeciesRecord[],
  regions: RegionsPayload,
  taxonomyByCode: Record<string, TaxonomyNode>,
): ColumnSpec[] {
  const regionEntries = Object.entries(regions.regions).filter(
    ([, config]) => config.enabled,
  );
  const regionKeys = regionEntries.map(([key]) => key);
  const groupKeys = uniqueStrings(
    regionEntries.map(([, config]) => config.season_group),
  );
  const priceGroups = uniqueStrings(
    regionEntries.map(([, config]) => config.price_group),
  );
  const aliasKeys = regionKeys.filter((key) =>
    species.some((record) => (record.names.aliases[key] ?? []).length > 0),
  );

  const presentCooking = COOKING_TAGS.filter((tag) =>
    species.some((record) => cookingFilterValues(record).includes(tag)),
  );

  const presentFlesh = FLESH_COLOR_LIST.map((item) => item.value).filter((value) =>
    species.some((record) => fishAttrs(record)?.flesh_color_tag === value),
  );

  const presentMarket = MARKET_FORMS.filter((value) =>
    species.some((record) => record.buying_guide.market_forms.includes(value)),
  );

  const presentOdor = ODOR_PROFILES.filter((value) =>
    species.some((record) => record.sensory.odor_profile === value),
  );

  const presentTexture = uniqueStrings(
    species.flatMap((record) => record.sensory.texture_tags),
  ).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

  const presentCategories = uniqueStrings(
    species.map((record) => CATEGORY_LABELS[record.category]),
  ).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

  const specs: ColumnSpec[] = [
    {
      id: 'name',
      label: '物种名称',
      width: 280,
      getValue: (record) => record.names.zh_formal,
      getSortValue: (record) => record.names.zh_formal,
    },
    {
      id: 'id',
      label: '谱系 ID',
      width: 126,
      getValue: (record) => record.id,
      getSortValue: (record) => record.id,
      getFilterValues: (record) => [record.id],
    },
    {
      id: 'category',
      label: '类别',
      width: 78,
      getValue: (record) => CATEGORY_LABELS[record.category],
      getFilterValues: (record) => [CATEGORY_LABELS[record.category]],
      optionValues: presentCategories,
      align: 'center',
    },
    {
      id: 'habitat',
      label: '生境',
      width: 76,
      getValue: habitatLabel,
      getSortValue: (record) => habitatLabel(record),
      getFilterValues: (record) => [habitatLabel(record)],
      optionValues: uniqueStrings(
        species.map((record) => habitatLabel(record)),
      ),
    },
    {
      id: 'sashimi',
      label: '刺身评级',
      width: 106,
      getValue: (record) =>
        record.sashimi.level ? SASHIMI_LABELS[record.sashimi.level] : '—',
      getSortValue: (record) =>
        record.sashimi.level ? SASHIMI_RANK[record.sashimi.level] : null,
      getFilterValues: (record) => [
        record.sashimi.level ? SASHIMI_LABELS[record.sashimi.level] : '—',
      ],
      optionValues: [...SASHIMI_ORDER.map((level) => SASHIMI_LABELS[level]), '—'],
    },
    {
      id: 'pinbone',
      label: '肌间刺',
      width: 88,
      getValue: (record) => {
        const level = fishAttrs(record)?.pin_bone_level;
        return level ? PIN_BONE_LABELS[level] : '—';
      },
      getSortValue: (record) => {
        const level = fishAttrs(record)?.pin_bone_level;
        return level ? PIN_BONE_RANK[level] : null;
      },
      getFilterValues: (record) => {
        const level = fishAttrs(record)?.pin_bone_level;
        return [level ? PIN_BONE_LABELS[level] : '—'];
      },
      optionValues: [...PIN_BONE_ORDER.map((level) => PIN_BONE_LABELS[level]), '—'],
    },
    {
      id: 'fat',
      label: '油脂等级',
      width: 84,
      getValue: (record) => {
        const fat = fishAttrs(record)?.fat_level;
        return typeof fat === 'number' ? `${fat}/10` : '—';
      },
      getSortValue: (record) => {
        const fat = fishAttrs(record)?.fat_level;
        return typeof fat === 'number' ? fat : null;
      },
      getFilterValues: (record) => {
        const fat = fishAttrs(record)?.fat_level;
        return [typeof fat === 'number' ? `${fat}/10` : '—'];
      },
      optionValues: [
        ...Array.from({ length: 11 }, (_, index) => `${index}/10`),
        '—',
      ],
      align: 'center',
    },
    {
      id: 'cooking',
      label: '主打烹饪',
      width: 204,
      getValue: (record) => {
        const tags = cookingFilterValues(record);
        return tags.length > 0 ? tags.slice(0, 3).join('、') : '—';
      },
      getSortValue: (record) => cookingFilterValues(record)[0] ?? null,
      getFilterValues: cookingFilterValues,
      optionValues: [...presentCooking],
    },
    {
      id: 'safety',
      label: '安全警示',
      width: 98,
      getValue: safetyLabel,
      getSortValue: (record) => {
        const worst = worstSafety(record);
        return worst ? SAFETY_RANK[worst] : 0;
      },
      getFilterValues: (record) => [safetyLabel(record)],
      optionValues: SAFETY_OPTIONS,
      align: 'center',
    },
    {
      id: 'latin',
      label: '拉丁学名',
      width: 180,
      getValue: (record) => record.names.latin,
      getSortValue: (record) => record.names.latin,
      getFilterValues: (record) => [record.names.latin],
    },
    {
      id: 'en',
      label: '英文标准名',
      width: 200,
      getValue: (record) => record.names.en_standard,
      getSortValue: (record) => record.names.en_standard,
      getFilterValues: (record) => [record.names.en_standard],
    },
    ...aliasKeys.map<ColumnSpec>((key) => ({
      id: `alias_${key}`,
      label: `${getAliasRegionLabel(key)}俗称`,
      width: 180,
      getValue: (record) => aliasValue(record, key),
      getSortValue: (record) => aliasValue(record, key),
      getFilterValues: (record) => [aliasValue(record, key)],
    })),
    {
      id: 'taxonomy_path',
      label: '生物分类',
      width: 248,
      getValue: (record) => taxonomyPathFor(record, taxonomyByCode),
      getSortValue: (record) => taxonomyPathFor(record, taxonomyByCode),
      getFilterValues: (record) => [taxonomyPathFor(record, taxonomyByCode)],
    },
    {
      id: 'histamine',
      label: '组胺风险',
      width: 88,
      getValue: (record) => {
        const risk = fishAttrs(record)?.histamine_risk;
        return risk ? HISTAMINE_LABELS[risk] : '—';
      },
      getSortValue: (record) => {
        const risk = fishAttrs(record)?.histamine_risk;
        return risk ? HISTAMINE_RANK[risk] : null;
      },
      getFilterValues: (record) => {
        const risk = fishAttrs(record)?.histamine_risk;
        return [risk ? HISTAMINE_LABELS[risk] : '—'];
      },
      optionValues: [...HISTAMINE_ORDER.map((risk) => HISTAMINE_LABELS[risk]), '—'],
      align: 'center',
    },
    {
      id: 'flesh',
      label: '肉色',
      width: 104,
      getValue: (record) => fishAttrs(record)?.flesh_color_tag ?? '—',
      getSortValue: (record) => fishAttrs(record)?.flesh_color_tag ?? null,
      getFilterValues: (record) => [fishAttrs(record)?.flesh_color_tag ?? '—'],
      optionValues: [...presentFlesh, ...(species.some((r) => !fishAttrs(r)?.flesh_color_tag) ? ['—'] : [])],
    },
    {
      id: 'texture',
      label: '口感',
      width: 150,
      getValue: (record) =>
        record.sensory.texture_tags.length > 0
          ? record.sensory.texture_tags.join('、')
          : '—',
      getSortValue: (record) => record.sensory.texture_tags[0] ?? null,
      getFilterValues: (record) =>
        record.sensory.texture_tags.length > 0
          ? record.sensory.texture_tags
          : ['—'],
      optionValues: [...presentTexture, '—'],
    },
    {
      id: 'odor',
      label: '气味',
      width: 126,
      getValue: (record) => record.sensory.odor_profile ?? '—',
      getSortValue: (record) => record.sensory.odor_profile ?? null,
      getFilterValues: (record) => [record.sensory.odor_profile ?? '—'],
      optionValues: [...presentOdor, '—'],
    },
    {
      id: 'season',
      label: '当季月份',
      width: 176,
      getValue: (record) => buildSeasonText(record, groupKeys, regions),
      getFilterValues: (record) => [buildSeasonText(record, groupKeys, regions)],
      getSortValue: (record) => {
        const months = groupKeys.flatMap(
          (key) => record.seasonality.by_group[key]?.months ?? [],
        );
        return months.length > 0 ? Math.min(...months) : null;
      },
    },
    {
      id: 'market',
      label: '常见形态',
      width: 176,
      getValue: (record) =>
        record.buying_guide.market_forms.length > 0
          ? record.buying_guide.market_forms.join('、')
          : '—',
      getSortValue: (record) => record.buying_guide.market_forms[0] ?? null,
      getFilterValues: (record) =>
        record.buying_guide.market_forms.length > 0
          ? record.buying_guide.market_forms
          : ['—'],
      optionValues: [...presentMarket, '—'],
    },
    {
      id: 'price',
      label: '参考价位',
      width: 116,
      getValue: (record) => buildPriceText(record, priceGroups),
      getSortValue: (record) => {
        const tiers = priceFilterValues(record, priceGroups);
        const first = tiers[0];
        return first ? PRICE_ORDER.indexOf(first as (typeof PRICE_ORDER)[number]) : null;
      },
      getFilterValues: (record) => priceFilterValues(record, priceGroups),
      optionValues: [...PRICE_ORDER],
    },
    ...regionEntries.map<ColumnSpec>(([key, config]) => ({
      id: `avail_${key}`,
      label: config.label,
      width: 86,
      align: 'center',
      getValue: (record) => availabilityShort(record, key),
      getSortValue: (record) =>
        AVAILABILITY_RANK[record.availability[key] ?? 'unknown'],
      getFilterValues: (record) => [availabilityShort(record, key)],
      optionValues: [...AVAILABILITY_SHORT_OPTIONS],
    })),
  ];

  return specs;
}

function habitatLabel(species: SpeciesRecord): string {
  return SALINITY_LABELS[species.habitat.salinity];
}
function meetsColumnFilter(
  spec: ColumnSpec,
  species: SpeciesRecord,
  values: string[],
): boolean {
  if (!spec.getFilterValues || values.length === 0) {
    return true;
  }
  const rowValues = spec.getFilterValues(species);
  return values.some((value) => rowValues.includes(value));
}

function buildHaystack(species: SpeciesRecord): string {
  const aliases = Object.values(species.names.aliases).flat();
  const search = species._search;
  return [
    species.names.zh_formal,
    species.names.latin,
    species.names.en_standard,
    ...aliases,
    ...species.culinary.signature_dishes,
    ...(search?.terms ?? []),
    ...(search?.pinyin_full ?? []),
    ...(search?.pinyin_initials ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

export function TablePage() {
  const { data, loading, error } = useData();
  const navigate = useNavigate();

  const tableState = useAppStore((state) => state.tableState);
  const setTableState = useAppStore((state) => state.setTableState);
  const compareIds = useAppStore((state) => state.compareIds);
  const toggleCompare = useAppStore((state) => state.toggleCompare);

  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [wechatCsvTipVisible, setWechatCsvTipVisible] = useState(false);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollRef = useRef(tableState.scrollTop);
  const scrollTimerRef = useRef<number | null>(null);
  const restoredRef = useRef(false);
  const initializedVisibilityRef = useRef(false);

  const species = data?.species ?? EMPTY_SPECIES;
  const regions = data?.regions ?? null;
  const taxonomyByCode = data?.taxonomyByCode ?? EMPTY_TAXONOMY_BY_CODE;

  usePinchZoom(scrollRef, zoom, setZoom);

  const specs = useMemo(
    () => (regions ? buildColumnSpecs(species, regions, taxonomyByCode) : []),
    [species, regions, taxonomyByCode],
  );
  const allIds = useMemo(() => specs.map((spec) => spec.id), [specs]);
  const specMap = useMemo(
    () => new Map(specs.map((spec) => [spec.id, spec])),
    [specs],
  );

  const presetMap = useMemo<Record<TablePreset, string[]>>(() => {
    const aliasColumns = allIds.filter((id) => id.startsWith('alias_'));
    return {
      core: [
        'name',
        'habitat',
        'sashimi',
        'pinbone',
        'fat',
        'cooking',
        'safety',
      ].filter((id) => specMap.has(id)),
      aliases: ['name', 'latin', 'en', ...aliasColumns],
      full: allIds,
    };
  }, [allIds, specMap]);

  const hiddenSet = useMemo(
    () => new Set(tableState.hiddenColumns.filter((id) => id !== 'name')),
    [tableState.hiddenColumns],
  );
  const visibleIds = useMemo(
    () => allIds.filter((id) => !hiddenSet.has(id)),
    [allIds, hiddenSet],
  );
  const visibleSpecs = useMemo(
    () =>
      visibleIds
        .map((id) => specMap.get(id))
        .filter((spec): spec is ColumnSpec => Boolean(spec)),
    [visibleIds, specMap],
  );

  useEffect(() => {
    if (!data || initializedVisibilityRef.current) {
      return;
    }
    initializedVisibilityRef.current = true;
    if (
      !tableState.columnsCustomized &&
      tableState.hiddenColumns.length === 0 &&
      allIds.length > 0
    ) {
      const defaults = new Set(presetMap[tableState.preset]);
      const complement = allIds.filter((id) => !defaults.has(id));
      if (complement.length > 0) {
        setTableState({ hiddenColumns: complement });
      }
    }
  }, [
    data,
    allIds,
    presetMap,
    setTableState,
    tableState.columnsCustomized,
    tableState.hiddenColumns.length,
    tableState.preset,
  ]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current);
      }
      useAppStore.getState().setTableState({ scrollTop: lastScrollRef.current });
    };
  }, []);

  useLayoutEffect(() => {
    if (restoredRef.current || !data) {
      return;
    }
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    restoredRef.current = true;
    if (tableState.scrollTop > 0) {
      element.scrollTop = tableState.scrollTop;
      lastScrollRef.current = element.scrollTop;
    }
  }, [data, tableState.scrollTop]);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    lastScrollRef.current = element.scrollTop;
    if (scrollTimerRef.current !== null) {
      window.clearTimeout(scrollTimerRef.current);
    }
    scrollTimerRef.current = window.setTimeout(() => {
      scrollTimerRef.current = null;
      setTableState({ scrollTop: lastScrollRef.current });
    }, 180);
  }, [setTableState]);

  const baseRows = useMemo(() => {
    const keyword = tableState.keyword.trim().toLowerCase();
    if (!keyword) {
      return species;
    }
    const tokens = keyword.split(/\s+/).filter(Boolean);
    return species.filter((record) => {
      const haystack = buildHaystack(record);
      return tokens.every((token) => haystack.includes(token));
    });
  }, [species, tableState.keyword]);

  const columnFilters = useMemo<ColumnFiltersState>(
    () =>
      Object.entries(tableState.columnFilters)
        .filter(([, values]) => values.length > 0)
        .map(([id, value]) => ({ id, value })),
    [tableState.columnFilters],
  );

  const sortingState = useMemo<SortingState>(
    () =>
      tableState.sorting.map((rule) => ({ id: rule.id, desc: rule.desc })),
    [tableState.sorting],
  );

  const visibilityState = useMemo<VisibilityState>(() => {
    const next: VisibilityState = {};
    for (const id of allIds) {
      next[id] = !hiddenSet.has(id);
    }
    return next;
  }, [allIds, hiddenSet]);

  const renderCell = useCallback(
    (spec: ColumnSpec, record: SpeciesRecord): ReactNode => {
      if (spec.id === 'name') {
        const selected = compareIds.includes(record.id);
        const compareFull = !selected && compareIds.length >= 3;
        const compareButtonHeight = Math.max(13, Math.round(20 * zoom));
        const comparePaddingX = Math.max(3, Math.round(5 * zoom));
        const compareFontSize = Math.max(7.5, Number((9 * zoom).toFixed(1)));
        const compareIconSize = Math.max(8, Math.round(10 * zoom));
        const compareGap = Math.max(1, Math.round(2 * zoom));
        return (
          <div className="flex w-full min-w-0 items-center gap-1.5">
            <span
              className="min-w-0 flex-1 truncate font-semibold text-[#0F172A] dark:text-[#F1F5F9]"
              title={record.names.zh_formal}
            >
              {record.names.zh_formal}
            </span>
            <button
              type="button"
              aria-pressed={selected}
              disabled={compareFull}
              title={compareFull ? '对比队列已满（最多 3 种）' : undefined}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                toggleCompare(record.id);
              }}
              style={{
                height: compareButtonHeight,
                padding: `0 ${comparePaddingX}px`,
                fontSize: `${compareFontSize}px`,
                gap: `${compareGap}px`,
              }}
              className={`inline-flex shrink-0 items-center rounded-full border font-semibold leading-none transition-colors ${
                selected
                  ? 'border-[#0B4F71] bg-[#0B4F71] text-white dark:border-[#38BDF8] dark:bg-[#38BDF8] dark:text-[#07131F]'
                  : compareFull
                    ? 'cursor-not-allowed border-[#E2EBF0] bg-[#F6F9FB] text-[#94A3B8] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#52667A]'
                    : 'border-[#E2EBF0] bg-white text-[#0B4F71] hover:border-[#0B4F71]/40 dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#38BDF8]'
              }`}
            >
              {selected ? (
                <Check
                  style={{ width: compareIconSize, height: compareIconSize }}
                  aria-hidden="true"
                />
              ) : (
                <>
                  <Plus
                    style={{ width: compareIconSize, height: compareIconSize }}
                    aria-hidden="true"
                  />
                  对比
                </>
              )}
            </button>
          </div>
        );
      }

      if (spec.id.startsWith('avail_')) {
        const regionKey = spec.id.slice('avail_'.length);
        const availability = record.availability[regionKey] ?? 'unknown';
        const label = AVAILABILITY_SHORT_LABELS[availability];
        return (
          <span
            className="flex w-full items-center justify-center gap-1.5"
            title={label}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${AVAILABILITY_DOT_CLASS[availability]}`}
            />
            <span className="truncate">{label}</span>
          </span>
        );
      }

      const value = spec.getValue(record);
      return (
        <span
          className={`block w-full truncate ${
            spec.align === 'center' ? 'text-center' : ''
          }`}
          title={value}
        >
          {value}
        </span>
      );
    },
    [compareIds, toggleCompare, zoom],
  );

  const columnDefs = useMemo<ColumnDef<SpeciesRecord>[]>(
    () =>
      specs.map((spec) => ({
        id: spec.id,
        accessorFn: (record) => spec.getValue(record),
        header: spec.label,
        size: spec.width,
        enableSorting: true,
        enableColumnFilter: Boolean(spec.getFilterValues),
        filterFn: (row, _columnId, filterValue) => {
          const values = Array.isArray(filterValue)
            ? (filterValue as string[])
            : [];
          return meetsColumnFilter(spec, row.original, values);
        },
        sortingFn: (rowA, rowB) =>
          compareRows(
            rowA.original,
            rowB.original,
            spec.getSortValue ?? spec.getValue,
          ),
        cell: (info) => renderCell(spec, info.row.original),
      })),
    [specs, renderCell],
  );

  const table = useReactTable<SpeciesRecord>({
    data: baseRows,
    columns: columnDefs,
    state: {
      columnFilters,
      sorting: sortingState,
      columnVisibility: visibilityState,
    },
    enableGlobalFilter: false,
    enableMultiSort: false,
    enableSortingRemoval: true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });

  const tableRows = table.getRowModel().rows;
  const rowHeight = Math.round(ROW_HEIGHT * zoom);
  const headerHeight = Math.round(HEADER_HEIGHT * zoom);
  const cellFontSize = Math.round(12 * zoom * 100) / 100;

  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
    scrollMargin: headerHeight,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, rowHeight, headerHeight]);

  const { wasDraggingRef } = useDragToScroll(scrollRef, [tableRows.length, zoom]);

  const optionsByColumn = useMemo<Record<string, ColumnFilterOption[]>>(() => {
    const result: Record<string, ColumnFilterOption[]> = {};
    for (const spec of specs) {
      if (!spec.getFilterValues) {
        continue;
      }
      const filter = spec.getFilterValues;
      const counted = baseRows.filter((record) =>
        specs.every((other) => {
          if (other.id === spec.id) {
            return true;
          }
          const values = tableState.columnFilters[other.id];
          return meetsColumnFilter(other, record, values ?? []);
        }),
      );
      const counts = new Map<string, number>();
      for (const record of counted) {
        for (const value of filter(record)) {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
      }
      const known =
        spec.optionValues ??
        uniqueStrings(species.flatMap((record) => filter(record)));
      result[spec.id] = known.map((value) => ({
        value,
        label: value,
        count: counts.get(value) ?? 0,
      }));
    }
    return result;
  }, [specs, baseRows, species, tableState.columnFilters]);

  const filterChips = useMemo(() => {
    const chips: { id: string; label: string; value: string }[] = [];
    for (const [id, values] of Object.entries(tableState.columnFilters)) {
      const spec = specMap.get(id);
      if (!spec) {
        continue;
      }
      for (const value of values) {
        chips.push({ id, label: spec.label, value });
      }
    }
    return chips;
  }, [tableState.columnFilters, specMap]);

  const activeSort = tableState.sorting[0] ?? null;

  const updateFilter = useCallback(
    (id: string, values: string[]) => {
      const next = { ...tableState.columnFilters };
      if (values.length > 0) {
        next[id] = values;
      } else {
        delete next[id];
      }
      setTableState({ columnFilters: next });
    },
    [setTableState, tableState.columnFilters],
  );

  const updateSort = useCallback(
    (id: string, direction: SortDirection | null) => {
      setTableState({
        sorting: direction ? [{ id, desc: direction === 'desc' }] : [],
      });
    },
    [setTableState],
  );

  const applyPreset = useCallback(
    (preset: TablePreset) => {
      const defaults = new Set(presetMap[preset]);
      setTableState({
        preset,
        hiddenColumns: allIds.filter((id) => !defaults.has(id)),
        columnsCustomized: false,
      });
    },
    [allIds, presetMap, setTableState],
  );

  const toggleColumn = useCallback(
    (id: string) => {
      if (id === 'name') {
        return;
      }
      const hidden = new Set(
        tableState.hiddenColumns.filter((value) => value !== 'name'),
      );
      if (hidden.has(id)) {
        hidden.delete(id);
      } else {
        hidden.add(id);
      }
      setTableState({ hiddenColumns: Array.from(hidden), columnsCustomized: true });
    },
    [setTableState, tableState.hiddenColumns],
  );

  const resetColumns = useCallback(() => {
    const defaults = new Set(presetMap[tableState.preset]);
    setTableState({
      hiddenColumns: allIds.filter((id) => !defaults.has(id)),
      columnsCustomized: false,
    });
  }, [allIds, presetMap, setTableState, tableState.preset]);

  const showAllColumns = useCallback(() => {
    setTableState({ hiddenColumns: [], columnsCustomized: true });
  }, [setTableState]);

  const clearFilters = useCallback(() => {
    setTableState({ columnFilters: {} });
  }, [setTableState]);

  const handleExport = useCallback(() => {
    const csvColumns: CsvColumnDef[] = visibleSpecs.map((spec) => ({
      id: spec.id,
      header: spec.label,
      accessor: spec.getValue,
    }));
    downloadSpeciesCsv(
      tableRows.map((row) => row.original),
      csvColumns,
    );
    if (isWeChatBrowser()) {
      setWechatCsvTipVisible(true);
    }
  }, [visibleSpecs, tableRows]);

  const customizerColumns: CustomizerColumn[] = useMemo(
    () =>
      specs.map((spec) => ({
        id: spec.id,
        label: spec.label,
        locked: spec.id === 'name',
      })),
    [specs],
  );

  const totalWidth = table
    .getVisibleLeafColumns()
    .reduce((sum, column) => sum + Math.round(column.getSize() * zoom), 0);

  const getSortDirection = (id: string): SortDirection | null => {
    if (!activeSort || activeSort.id !== id) {
      return null;
    }
    return activeSort.desc ? 'desc' : 'asc';
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div className="h-24 animate-pulse rounded-3xl bg-white/60 dark:bg-[#102030]/60" />
        <div className="mt-3 h-14 animate-pulse rounded-3xl bg-white/50 dark:bg-[#102030]/50" />
        <div className="mt-3 h-[28rem] animate-pulse rounded-3xl bg-white/50 dark:bg-[#102030]/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <p className="font-semibold">数据加载失败</p>
          <p className="mt-1 text-xs leading-5">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#0E86A8] dark:text-[#22D3EE]">
            HowFish · 全物种总表
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#0F172A] dark:text-[#F1F5F9] sm:text-2xl">
            全物种信息表
          </h1>
          <p className="mt-1 text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8] sm:text-xs">
            虚拟滚动、列缩放与横向浏览，表头多选筛选、语义排序与 UTF-8 BOM CSV 导出。
          </p>
        </div>
        <p className="rounded-full border border-[#E2EBF0] bg-white/70 px-3 py-1 text-[11px] font-medium text-[#52667A] tabular-nums dark:border-[#1E354A] dark:bg-[#102030]/70 dark:text-[#94A3B8]">
          当前显示{' '}
          <span className="font-semibold text-[#0B4F71] dark:text-[#38BDF8]">
            {tableRows.length}
          </span>{' '}
          / {species.length} 条
        </p>
      </header>

      {wechatCsvTipVisible ? (
        <div
          data-testid="wechat-csv-tip"
          role="status"
          className="mt-3 flex items-start gap-2 rounded-2xl border border-[#0B4F71]/20 bg-[#0B4F71]/[0.06] px-3 py-2.5 text-[11px] leading-5 text-[#0B4F71] dark:border-[#38BDF8]/25 dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">{WECHAT_OPEN_IN_BROWSER_TIP}</p>
          <button
            type="button"
            aria-label="关闭微信下载提示"
            onClick={() => setWechatCsvTipVisible(false)}
            className="-mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#0B4F71]/10 dark:hover:bg-[#38BDF8]/15"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <section className="mt-3 rounded-3xl border border-[#E2EBF0] bg-white/90 p-3 shadow-[0_18px_40px_-32px_rgba(11,79,113,0.45)] dark:border-[#1E354A] dark:bg-[#102030]/90 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#52667A] dark:text-[#94A3B8]"
            />
            <input
              type="text"
              value={tableState.keyword}
              onChange={(event) =>
                setTableState({ keyword: event.target.value })
              }
              placeholder="关键词过滤：中文名、英文、拼音、俗称…"
              aria-label="表格关键词过滤"
              autoComplete="off"
              spellCheck={false}
              className="hf-input h-10 pl-9 pr-9 text-xs sm:text-sm"
            />
            {tableState.keyword ? (
              <button
                type="button"
                onClick={() => setTableState({ keyword: '' })}
                aria-label="清空关键词"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#52667A] transition-colors hover:bg-[#0B4F71]/10 hover:text-[#0B4F71] dark:text-[#94A3B8]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <TableZoomControls
              zoom={zoom}
              onChange={setZoom}
              className="h-10"
            />
            <button
              type="button"
              onClick={() => setCustomizerOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E2EBF0] bg-white px-3 text-xs font-semibold text-[#0B4F71] transition-colors hover:border-[#0B4F71]/30 dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#38BDF8] dark:hover:border-[#38BDF8]/40"
            >
              ⚙️ 自定义列
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={tableRows.length === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0B4F71] px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#38BDF8] dark:text-[#07131F]"
            >
              ⬇️ 导出 CSV
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="no-scrollbar flex max-w-full gap-1.5 overflow-x-auto py-0.5">
            {(Object.keys(PRESET_LABELS) as TablePreset[]).map((preset) => {
              const isActive = tableState.preset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => applyPreset(preset)}
                  className={`hf-chip shrink-0 whitespace-nowrap ${
                    isActive ? 'hf-chip-active' : ''
                  }`}
                >
                  {PRESET_LABELS[preset]}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[#52667A] dark:text-[#94A3B8]">
            可见列 <span className="tabular-nums">{visibleIds.length}</span> /{' '}
            {allIds.length}
          </p>
        </div>

        {filterChips.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[#E2EBF0] pt-2 dark:border-[#1E354A]">
            {filterChips.map((chip) => (
              <span
                key={`${chip.id}:${chip.value}`}
                className="inline-flex items-center gap-1 rounded-full border border-[#0B4F71]/20 bg-[#0B4F71]/[0.06] py-0.5 pl-2 pr-1 text-[10px] font-medium text-[#0B4F71] dark:border-[#38BDF8]/25 dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]"
              >
                <span className="text-[#52667A] dark:text-[#94A3B8]">
                  {chip.label}：
                </span>
                {chip.value}
                <button
                  type="button"
                  aria-label={`移除筛选 ${chip.label} ${chip.value}`}
                  onClick={() =>
                    updateFilter(
                      chip.id,
                      (tableState.columnFilters[chip.id] ?? []).filter(
                        (value) => value !== chip.value,
                      ),
                    )
                  }
                  className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-[#0B4F71]/15 dark:hover:bg-[#38BDF8]/20"
                >
                  <X className="h-2.5 w-2.5" aria-hidden="true" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-[#52667A] transition-colors hover:bg-[#0B4F71]/5 hover:text-[#0B4F71] dark:text-[#94A3B8] dark:hover:text-[#38BDF8]"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              清空全部筛选
            </button>
          </div>
        ) : null}
      </section>

      {tableRows.length === 0 ? (
        <div className="mt-3 flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#E2EBF0] bg-white/60 px-5 py-16 text-center dark:border-[#1E354A] dark:bg-[#102030]/50">
          <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
            当前没有匹配的物种
          </p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-[#52667A] dark:text-[#94A3B8]">
            放宽关键词或清除部分列筛选后重试。
          </p>
          <button
            type="button"
            onClick={() => {
              setTableState({ keyword: '', columnFilters: {} });
            }}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0B4F71] px-4 text-xs font-semibold text-white dark:bg-[#38BDF8] dark:text-[#07131F]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            重置关键词与筛选
          </button>
        </div>
      ) : (
        <>
          <HorizontalScrollSyncBar
            scrollRef={scrollRef}
            deps={[totalWidth, tableRows.length, tableState.preset, zoom]}
            className="mt-3"
          />
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            role="table"
            aria-label="全物种信息表"
            aria-rowcount={tableRows.length}
            style={{
              touchAction: 'pan-x pan-y',
              WebkitOverflowScrolling: 'touch',
            }}
            className="mt-3 max-h-[calc(100dvh-15rem)] min-h-[16rem] overflow-x-auto overflow-y-auto overscroll-x-contain rounded-3xl border border-[#E2EBF0] bg-white shadow-[0_18px_40px_-32px_rgba(11,79,113,0.45)] touch-pan-x touch-pan-y dark:border-[#1E354A] dark:bg-[#102030]"
          >
          <div
            className="relative min-w-full"
            style={{ width: Math.max(totalWidth, 320) }}
          >
            <div
              role="row"
              style={{ height: headerHeight }}
              className="sticky top-0 z-30 flex border-b border-[#E2EBF0] bg-[#F0F5F8] dark:border-[#1E354A] dark:bg-[#0B1824]"
            >
              {table.getHeaderGroups()[0]?.headers.map((header) => {
                const spec = specMap.get(header.column.id);
                if (!spec) {
                  return null;
                }
                return (
                  <div
                    key={header.id}
                    role="columnheader"
                    style={{
                      width: Math.round(header.getSize() * zoom),
                      height: headerHeight,
                    }}
                    className="flex shrink-0 items-center px-1.5"
                  >
                    <ColumnHeaderFilter
                      label={spec.label}
                      options={optionsByColumn[spec.id]}
                      selected={tableState.columnFilters[spec.id] ?? []}
                      onSelectedChange={(values) =>
                        updateFilter(spec.id, values)
                      }
                      sort={getSortDirection(spec.id)}
                      onSortChange={(direction) =>
                        updateSort(spec.id, direction)
                      }
                      align={spec.align}
                    />
                  </div>
                );
              })}
            </div>

            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: 'relative',
                width: '100%',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = tableRows[virtualRow.index];
                if (!row) {
                  return null;
                }
                return (
                  <div
                    key={row.id}
                    role="row"
                    aria-rowindex={virtualRow.index + 2}
                    className="group absolute left-0 top-0 flex w-full cursor-pointer border-b border-[#E2EBF0]/70 transition-colors hover:bg-[#0B4F71]/[0.035] dark:border-[#1E354A]/70 dark:hover:bg-[#38BDF8]/[0.05]"
                    style={{
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start - headerHeight}px)`,
                    }}
                    onClick={() => {
                      if (wasDraggingRef.current) {
                        return;
                      }
                      navigate(`/species/${row.original.id}`);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const spec = specMap.get(cell.column.id);
                      return (
                        <div
                          key={cell.id}
                          role="cell"
                          style={{
                            width: Math.round(cell.column.getSize() * zoom),
                            fontSize: `${cellFontSize}px`,
                          }}
                          className={`flex h-full shrink-0 items-center px-2.5 text-[#33475B] dark:text-[#CBD5E1] ${
                            spec?.align === 'center' ? 'justify-center' : ''
                          }`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
          <HorizontalScrollSyncBar
            scrollRef={scrollRef}
            deps={[totalWidth, tableRows.length, tableState.preset, zoom]}
            className="mt-2"
          />
        </>
      )}

      <p className="mt-2 px-1 text-[10px] leading-4 text-[#94A3B8] dark:text-[#52667A]">
        点击任意行进入物种详情；返回本页时会完整保留关键词、列筛选、排序与滚动位置。
      </p>

      <ColumnCustomizer
        open={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        columns={customizerColumns}
        visibleIds={visibleIds}
        presetLabel={PRESET_LABELS[tableState.preset]}
        onToggle={toggleColumn}
        onReset={resetColumns}
        onShowAll={showAllColumns}
      />
    </div>
  );
}