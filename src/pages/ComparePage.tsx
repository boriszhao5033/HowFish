import {
  ArrowRight,
  Copy,
  Link2,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { SashimiBadge } from '../components/common/SashimiBadge';
import { SpeciesPlaceholderSvg } from '../components/common/SpeciesPlaceholderSvg';
import { KinshipTreeDiagram } from '../components/compare/KinshipTreeDiagram';
import { useData } from '../context/DataContext';
import {
  diagnoseKinship,
  resolveRedirectId,
  type KinshipTone,
} from '../services/kinship';
import { searchSpecies } from '../services/searchEngine';
import { useAppStore } from '../store/useAppStore';
import {
  ACIDITY_LABELS,
  AVAILABILITY_LABELS,
  CATEGORY_LABELS,
  HISTAMINE_LABELS,
  PIN_BONE_LABELS,
  SALINITY_LABELS,
  getRegionFlag,
  type FleshColorTag,
  type FishCategoryAttrs,
  type LoadedAppData,
  type SpeciesRecord,
} from '../types/schema';

const MAX_COMPARE = 3;

const KINSHIP_TONE_CLASS: Record<KinshipTone, string> = {
  purple:
    'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300',
  blue:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
  green:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  neutral:
    'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-300',
  orange:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
};

const SEVERITY_CLASS: Record<string, string> = {
  critical:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
  high:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
  medium:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  low:
    'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-300',
};

interface ComparePreset {
  ids: string[];
  label: string;
}

interface DimensionDef {
  id: string;
  label: string;
  getKey: (species: SpeciesRecord) => string;
  render: (species: SpeciesRecord) => ReactNode;
}

function fishAttrs(species: SpeciesRecord): FishCategoryAttrs | null {
  return species.category === 'FI'
    ? (species.category_attrs as FishCategoryAttrs)
    : null;
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

function parseIds(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  return uniqueIds(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

function formatMonths(months: number[]): string {
  if (months.length === 12) {
    return '全年';
  }
  if (months.length === 0) {
    return '无自然物候';
  }
  return [...months]
    .sort((a, b) => a - b)
    .map((month) => `${month}月`)
    .join(' · ');
}

function enabledRegionKeys(data: LoadedAppData): string[] {
  return Object.entries(data.regions.regions)
    .filter(([, config]) => config.enabled)
    .map(([key]) => key);
}

function taxonLabel(data: LoadedAppData, code: string | undefined): string {
  if (!code) {
    return '—';
  }
  const node = data.taxonomyByCode[code];
  if (!node) {
    return code;
  }
  return node.name_latin ? `${node.name_zh}（${node.name_latin}）` : node.name_zh;
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-lg border border-[#0B4F71]/[0.12] bg-[#0B4F71]/[0.045] px-1.5 py-0.5 text-[10px] font-medium text-[#0B4F71] dark:border-[#38BDF8]/20 dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
      {children}
    </span>
  );
}

function buildDimensions(data: LoadedAppData): DimensionDef[] {
  const regionKeyList = enabledRegionKeys(data);

  return [
    {
      id: 'lineage',
      label: '11 位谱系码与科属',
      getKey: (species) =>
        [
          species.id,
          species.taxon_codes?.family ?? '',
          species.taxon_codes?.genus ?? '',
        ].join('|'),
      render: (species) => (
        <div className="space-y-1">
          <p className="font-mono text-xs font-semibold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
            {species.id}
          </p>
          <p className="text-[11px] text-[#52667A] dark:text-[#94A3B8]">
            11 位谱系码：
            <span className="ml-1 font-mono tabular-nums">
              {species.id.slice(0, 11)}
            </span>
          </p>
          <p className="text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8]">
            科：{taxonLabel(data, species.taxon_codes?.family)}
          </p>
          <p className="text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8]">
            属：{taxonLabel(data, species.taxon_codes?.genus)}
          </p>
          <Chip>{CATEGORY_LABELS[species.category]}</Chip>
        </div>
      ),
    },
    {
      id: 'habitat',
      label: '生境盐度',
      getKey: (species) => species.habitat.salinity,
      render: (species) => (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
            {SALINITY_LABELS[species.habitat.salinity]}
          </p>
          <p className="text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8]">
            {species.habitat.detail}
          </p>
          <p className="text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8]">
            分布：{species.habitat.distribution}
          </p>
        </div>
      ),
    },
    {
      id: 'sashimi',
      label: '刺身适宜度',
      getKey: (species) => `${species.sashimi.level ?? 'null'}|${species.sashimi.note}`,
      render: (species) => (
        <div className="space-y-2">
          <SashimiBadge level={species.sashimi.level} compact />
          <p className="text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8]">
            {species.sashimi.note || '暂无补充说明'}
          </p>
        </div>
      ),
    },
    {
      id: 'safety',
      label: '安全与法规警示',
      getKey: (species) =>
        species.safety_and_legal
          .map((item) => `${item.severity}:${item.title}:${item.detail}`)
          .join('|'),
      render: (species) => (
        <ul className="space-y-1.5">
          {species.safety_and_legal.length > 0 ? (
            species.safety_and_legal.map((item, index) => (
              <li key={`${item.title}-${index}`} className="flex gap-1.5">
                <span
                  className={`mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold ${
                    SEVERITY_CLASS[item.severity ?? 'low']
                  }`}
                >
                  {item.severity === 'critical'
                    ? '严禁'
                    : item.severity === 'high'
                      ? '高风险'
                      : item.severity === 'medium'
                        ? '注意'
                        : '提示'}
                </span>
                <span className="min-w-0 text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8]">
                  {item.title}
                </span>
              </li>
            ))
          ) : (
            <li className="text-[11px] text-[#52667A] dark:text-[#94A3B8]">
              暂无安全警示
            </li>
          )}
        </ul>
      ),
    },
    {
      id: 'pinBone',
      label: '肌间刺水平',
      getKey: (species) => fishAttrs(species)?.pin_bone_level ?? 'none',
      render: (species) => {
        const level = fishAttrs(species)?.pin_bone_level ?? null;
        return (
          <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
            {level ? PIN_BONE_LABELS[level] : '—'}
          </p>
        );
      },
    },
    {
      id: 'fatAcidity',
      label: '油脂等级与酸度',
      getKey: (species) => {
        const attrs = fishAttrs(species);
        return `${attrs?.fat_level ?? 'null'}|${attrs?.acidity_level ?? 'null'}|${
          attrs?.fat_acidity_raw ?? ''
        }`;
      },
      render: (species) => {
        const attrs = fishAttrs(species);
        const fat = attrs?.fat_level ?? null;
        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#52667A] dark:text-[#94A3B8]">
                油脂
              </span>
              <span className="flex gap-0.5" aria-hidden="true">
                {Array.from({ length: 7 }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-2 w-3 rounded-full ${
                      fat !== null && index < fat
                        ? 'bg-[#0B4F71] dark:bg-[#38BDF8]'
                        : 'bg-[#E2EBF0] dark:bg-[#1E354A]'
                    }`}
                  />
                ))}
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                {fat !== null ? `${fat}/7` : '—'}
              </span>
            </div>
            <p className="text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8]">
              酸度：
              {attrs?.acidity_level
                ? ACIDITY_LABELS[attrs.acidity_level]
                : '—'}
            </p>
            {attrs?.fat_acidity_raw ? (
              <p className="text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8]">
                {attrs.fat_acidity_raw}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'histamine',
      label: '组胺风险',
      getKey: (species) => fishAttrs(species)?.histamine_risk ?? 'null',
      render: (species) => {
        const risk = fishAttrs(species)?.histamine_risk ?? null;
        const tone =
          risk === 'very_high' || risk === 'high'
            ? 'text-red-600 dark:text-red-300'
            : risk === 'medium_high' || risk === 'medium'
              ? 'text-amber-600 dark:text-amber-300'
              : 'text-emerald-600 dark:text-emerald-300';
        return (
          <p className={`text-sm font-semibold ${tone}`}>
            {risk ? `${HISTAMINE_LABELS[risk]}风险` : '—'}
          </p>
        );
      },
    },
    {
      id: 'fleshSensory',
      label: '肉质色与口感风味',
      getKey: (species) =>
        JSON.stringify({
          flesh: fishAttrs(species)?.flesh_color_tag ?? null,
          texture: species.sensory.texture_tags,
          odor: species.sensory.odor_profile,
          summary: species.sensory.summary,
        }),
      render: (species) => {
        const flesh = fishAttrs(species)?.flesh_color_tag as
          | FleshColorTag
          | null
          | undefined;
        return (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1">
              {flesh ? <Chip>{flesh}</Chip> : null}
              {species.sensory.texture_tags.map((tag) => (
                <Chip key={tag}>{tag}</Chip>
              ))}
              {species.sensory.odor_profile ? (
                <Chip>{species.sensory.odor_profile}</Chip>
              ) : null}
            </div>
            <p className="text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8]">
              {species.sensory.summary}
            </p>
          </div>
        );
      },
    },    {
      id: 'season',
      label: '应季月份（按地区）',
      getKey: (species) => JSON.stringify(species.seasonality),
      render: (species) => (
        <div className="space-y-1.5">
          {species.seasonality.year_round ? <Chip>常年稳定肥美</Chip> : null}
          {Object.entries(species.seasonality.by_group).map(
            ([groupKey, group]) => {
              const groupConfig = data.regions.season_groups[groupKey];
              return (
                <div key={groupKey} className="text-[11px] leading-5">
                  <p className="font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                    {groupConfig?.label ?? groupKey}
                  </p>
                  <p className="tabular-nums text-[#52667A] dark:text-[#94A3B8]">
                    {formatMonths(group.months)}
                  </p>
                </div>
              );
            },
          )}
        </div>
      ),
    },
    {
      id: 'aliases',
      label: '多地区俗称与可得性',
      getKey: (species) =>
        JSON.stringify({
          aliases: species.names.aliases,
          avail: species.availability,
        }),
      render: (species) => (
        <div className="space-y-1.5">
          {regionKeyList.map((regionKey) => {
            const aliases = species.names.aliases[regionKey] ?? [];
            const availability = species.availability[regionKey] ?? 'unknown';
            const label = data.regions.regions[regionKey]?.label ?? regionKey;
            return (
              <div key={regionKey} className="text-[11px] leading-5">
                <p className="font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                  {getRegionFlag(regionKey)} {label}
                  <span className="ml-1 font-normal text-[#52667A] dark:text-[#94A3B8]">
                    · {AVAILABILITY_LABELS[availability]}
                  </span>
                </p>
                <p className="text-[#52667A] dark:text-[#94A3B8]">
                  {aliases.length > 0 ? aliases.join(' · ') : '暂无俗称'}
                </p>
              </div>
            );
          })}
        </div>
      ),
    },
    {
      id: 'cooking',
      label: '主打烹饪与招牌名菜',
      getKey: (species) =>
        JSON.stringify({
          methods: species.culinary.methods,
          dishes: species.culinary.signature_dishes,
        }),
      render: (species) => {
        const signature = species.culinary.methods.filter(
          (method) => method.tier === 'signature',
        );
        const suitable = species.culinary.methods.filter(
          (method) => method.tier === 'suitable',
        );
        return (
          <div className="space-y-1.5">
            {signature.length > 0 ? (
              <p className="flex flex-wrap gap-1">
                {signature.map((method) => (
                  <span
                    key={method.tag}
                    className="rounded-lg bg-[#0B4F71] px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-[#38BDF8] dark:text-[#07131F]"
                  >
                    {method.tag}
                  </span>
                ))}
              </p>
            ) : null}
            {suitable.length > 0 ? (
              <p className="flex flex-wrap gap-1">
                {suitable.map((method) => (
                  <Chip key={method.tag}>{method.tag}</Chip>
                ))}
              </p>
            ) : null}
            {species.culinary.signature_dishes.length > 0 ? (
              <p className="text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8]">
                🍽️ {species.culinary.signature_dishes.join(' · ')}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'market',
      label: '售卖形态与参考价位',
      getKey: (species) =>
        JSON.stringify({
          forms: species.buying_guide.market_forms,
          prices: species.buying_guide.price_tier,
        }),
      render: (species) => (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {species.buying_guide.market_forms.map((form) => (
              <Chip key={form}>{form}</Chip>
            ))}
          </div>
          <p className="text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8]">
            {regionKeyList
              .map((regionKey) => {
                const price = species.buying_guide.price_tier[regionKey];
                const label =
                  data.regions.regions[regionKey]?.label ?? regionKey;
                return `${label}：${price ?? '—'}`;
              })
              .join(' · ')}
          </p>
        </div>
      ),
    },
    {
      id: 'identification',
      label: '核心辨识要点',
      getKey: (species) => species.buying_guide.identification_tips,
      render: (species) => (
        <p className="text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8]">
          {species.buying_guide.identification_tips || '暂无辨识要点'}
        </p>
      ),
    },
  ];
}

function buildPresets(data: LoadedAppData): ComparePreset[] {
  const presets: ComparePreset[] = [];
  const seen = new Set<string>();

  const add = (rawIds: string[], label: string) => {
    const ids = uniqueIds(
      rawIds.filter((id) => Boolean(data.speciesById[id])),
    ).slice(0, MAX_COMPARE);
    if (ids.length < 2) {
      return;
    }
    const key = ids.join(',');
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    presets.push({ ids, label });
  };

  add(['FI00000000002', 'FI00000000001'], '澳洲鲐 vs 日本鲭');

  for (const trap of data.traps.cross_family_traps) {
    add(trap.species_ids, trap.title);
  }

  for (const pair of data.traps.ab_pairs) {
    add(
      [pair.species_id_a, pair.species_id_b].filter(
        (id): id is string => Boolean(id),
      ),
      pair.name_zh,
    );
  }

  return presets.slice(0, 6);
}

export function ComparePage() {
  const { data, searchEngine, loading, error } = useData();
  const [searchParams, setSearchParams] = useSearchParams();

  const compareIds = useAppStore((state) => state.compareIds);
  const setCompareIds = useAppStore((state) => state.setCompareIds);
  const clearCompare = useAppStore((state) => state.clearCompare);

  const [diffOnly, setDiffOnly] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );

  const rawIds = searchParams.get('ids');

  const activeIds = useMemo(() => {
    if (!data) {
      return [];
    }
    const fromUrl = parseIds(rawIds)
      .map((id) => resolveRedirectId(id, data.redirects))
      .filter((id) => Boolean(data.speciesById[id]));
    const base =
      fromUrl.length > 0
        ? fromUrl
        : compareIds.filter((id) => Boolean(data.speciesById[id]));
    return uniqueIds(base).slice(0, MAX_COMPARE);
  }, [data, rawIds, compareIds]);

  const activeSpecies = useMemo(() => {
    if (!data) {
      return [];
    }
    return activeIds
      .map((id) => data.speciesById[id])
      .filter((species): species is SpeciesRecord => Boolean(species));
  }, [data, activeIds]);

  function replaceIds(nextKey: string) {
    if (nextKey) {
      setSearchParams({ ids: nextKey }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  useEffect(() => {
    if (!data) {
      return;
    }

    const resolvedFromUrl = parseIds(rawIds)
      .map((id) => resolveRedirectId(id, data.redirects))
      .filter((id) => Boolean(data.speciesById[id]));
    const resolvedKey = uniqueIds(resolvedFromUrl)
      .slice(0, MAX_COMPARE)
      .join(',');
    const storeKey = uniqueIds(
      compareIds.filter((id) => Boolean(data.speciesById[id])),
    )
      .slice(0, MAX_COMPARE)
      .join(',');

    if (rawIds) {
      const rawKey = parseIds(rawIds).join(',');
      if (rawKey !== resolvedKey) {
        replaceIds(resolvedKey);
        return;
      }
      if (resolvedKey !== storeKey) {
        setCompareIds(resolvedKey ? resolvedKey.split(',') : []);
      }
      return;
    }

    if (storeKey) {
      replaceIds(storeKey);
    }
  }, [data, rawIds, compareIds, setCompareIds, setSearchParams]);

  const dimensions = useMemo(
    () => (data ? buildDimensions(data) : []),
    [data],
  );
  const presets = useMemo(() => (data ? buildPresets(data) : []), [data]);

  const kinshipPairs = useMemo(() => {
    const pairs: {
      a: SpeciesRecord;
      b: SpeciesRecord;
      label: string;
      diagnosis: ReturnType<typeof diagnoseKinship>;
    }[] = [];
    for (let i = 0; i < activeSpecies.length; i += 1) {
      for (let j = i + 1; j < activeSpecies.length; j += 1) {
        const a = activeSpecies[i];
        const b = activeSpecies[j];
        pairs.push({
          a,
          b,
          label: `${String.fromCharCode(65 + i)} ↔ ${String.fromCharCode(65 + j)}`,
          diagnosis: diagnoseKinship(a.id, b.id),
        });
      }
    }
    return pairs;
  }, [activeSpecies]);

  const pickerHits = useMemo(() => {
    if (!data || !searchEngine || pickerSlot === null) {
      return [];
    }
    return searchSpecies(
      searchEngine,
      pickerQuery,
      data.species,
      data.regions,
    ).slice(0, 40);
  }, [data, searchEngine, pickerQuery, pickerSlot]);

  const visibleDimensions =
    diffOnly && activeSpecies.length > 1
      ? dimensions.filter((dimension) => {
          const keys = activeSpecies.map((species) =>
            dimension.getKey(species),
          );
          return new Set(keys).size > 1;
        })
      : dimensions;

  function commitIds(nextIds: string[]) {
    if (!data) {
      return;
    }
    const next = uniqueIds(
      nextIds.filter((id) => Boolean(data.speciesById[id])),
    ).slice(0, MAX_COMPARE);
    setCompareIds(next);
    replaceIds(next.join(','));
  }

  function openPicker(slot: number) {
    setPickerQuery('');
    setPickerSlot(slot);
  }

  function chooseSpecies(id: string) {
    if (pickerSlot === null) {
      return;
    }
    const next = [...activeIds];
    if (pickerSlot < next.length) {
      next[pickerSlot] = id;
    } else {
      next.push(id);
    }
    commitIds(next);
    setPickerSlot(null);
  }

  async function copyCompareLink() {
    if (!data) {
      return;
    }
    const ids = activeIds.join(',');
    const base = window.location.href.split('#')[0];
    const url = ids ? `${base}#/compare?ids=${ids}` : `${base}#/compare`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopyState('copied');
      } catch {
        setCopyState('failed');
      }
    }
    window.setTimeout(() => setCopyState('idle'), 2200);
  }  function loadPreset(preset: ComparePreset) {
    commitIds(preset.ids);
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-3">
        <div className="hf-card h-28 animate-pulse bg-white/60 dark:bg-[#102030]/60" />
        <div className="hf-card h-64 animate-pulse bg-white/60 dark:bg-[#102030]/60" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-6xl rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
        <p className="font-semibold">数据加载失败</p>
        <p className="mt-1 text-xs leading-5">{error}</p>
      </div>
    );
  }

  const headerGrid =
    activeSpecies.length === 3 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2';

  return (
    <div className="mx-auto w-full max-w-6xl pb-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#0E86A8] dark:text-[#22D3EE]">
            <Scale className="h-3.5 w-3.5" aria-hidden="true" />
            VS 同屏比对台
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#0F172A] dark:text-[#F1F5F9] sm:text-2xl">
            两条鱼放一起，差异一眼看清
          </h1>
        </div>
        <p className="text-[11px] text-[#52667A] dark:text-[#94A3B8]">
          已选 <span className="tabular-nums">{activeSpecies.length}</span> / 3 种
        </p>
      </div>

      <div className="sticky top-12 z-20 -mx-1 mt-3 rounded-2xl bg-[#F6F9FB]/92 px-1 pb-2 pt-1 backdrop-blur-md dark:bg-[#09131D]/92 sm:top-14">
        <div className={`grid gap-2 ${headerGrid}`}>
          {activeSpecies.map((species, index) => (
            <div
              key={species.id}
              className={`relative rounded-2xl border border-[#E2EBF0] bg-white p-2.5 shadow-[0_14px_32px_-28px_rgba(11,79,113,0.5)] dark:border-[#1E354A] dark:bg-[#102030] ${
                activeSpecies.length === 3 && index === 2
                  ? 'col-span-2 lg:col-span-1'
                  : ''
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  commitIds(activeIds.filter((id) => id !== species.id))
                }
                aria-label={`移除 ${species.names.zh_formal}`}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[#52667A] transition-colors hover:bg-red-50 hover:text-red-600 dark:text-[#94A3B8] dark:hover:bg-red-500/10 dark:hover:text-red-300"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              <Link to={`/species/${species.id}`} className="flex gap-2.5 pr-5">
                <SpeciesPlaceholderSvg
                  category={species.category}
                  fleshColor={fishAttrs(species)?.flesh_color_tag ?? null}
                  cover={species.media.cover}
                  alt={species.names.zh_formal}
                  id={species.id}
                  className="h-16 w-16 shrink-0 rounded-xl border border-[#E2EBF0]/80 dark:border-[#1E354A]/80"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-semibold leading-5 text-[#0F172A] dark:text-[#F1F5F9]">
                    {species.names.zh_formal}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[10px] italic leading-4 text-[#52667A] dark:text-[#94A3B8]">
                    {species.names.latin}
                  </p>
                  <p className="mt-0.5 font-mono text-[9px] tabular-nums text-[#52667A]/80 dark:text-[#94A3B8]/80">
                    {species.id}
                  </p>
                </div>
              </Link>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openPicker(index)}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-[#E2EBF0] bg-[#F6F9FB] px-2 text-[10px] font-semibold text-[#0B4F71] transition-colors hover:border-[#0B4F71]/30 dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#38BDF8]"
                >
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                  换一条
                </button>
                <SashimiBadge level={species.sashimi.level} compact />
              </div>
            </div>
          ))}

          {activeSpecies.length < MAX_COMPARE ? (
            <button
              type="button"
              onClick={() => openPicker(activeSpecies.length)}
              className={`${activeSpecies.length === 1 ? '' : 'col-span-2'} flex min-h-[7.5rem] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[#0B4F71]/25 bg-[#0B4F71]/[0.035] text-[#0B4F71] transition-colors hover:border-[#0B4F71]/50 hover:bg-[#0B4F71]/[0.07] dark:border-[#38BDF8]/30 dark:bg-[#38BDF8]/[0.06] dark:text-[#38BDF8] lg:col-span-1`}
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-semibold">添加物种</span>
              <span className="text-[10px] opacity-70">
                最多可同时对比 3 种
              </span>
            </button>
          ) : null}
        </div>
      </div>

      {activeSpecies.length >= 2 ? (
        <div className="mt-2 space-y-1.5">
          {kinshipPairs.map((pair) => (
            <div
              key={`${pair.a.id}-${pair.b.id}`}
              className={`flex flex-wrap items-center gap-1.5 rounded-2xl border px-3 py-2 ${
                KINSHIP_TONE_CLASS[pair.diagnosis.tone]
              }`}
            >
              <span className="text-sm" aria-hidden="true">
                {pair.diagnosis.emoji}
              </span>
              <span className="text-[10px] font-semibold opacity-70 tabular-nums">
                {pair.label}
              </span>
              <span className="text-xs font-semibold">
                {pair.diagnosis.label}
              </span>
              <span className="w-full text-[10px] leading-4 opacity-80 sm:w-auto">
                {pair.diagnosis.explanation}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {data && activeSpecies.length >= 2 ? (
        <KinshipTreeDiagram
          speciesList={activeSpecies}
          taxonomyByCode={data.taxonomyByCode}
        />
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[#E2EBF0] bg-white/80 p-2 dark:border-[#1E354A] dark:bg-[#102030]/80">
        <button
          type="button"
          role="switch"
          aria-checked={diffOnly}
          onClick={() => setDiffOnly((value) => !value)}
          className="inline-flex items-center gap-2 rounded-full px-1.5 py-1 text-[11px] font-semibold text-[#0F172A] dark:text-[#F1F5F9]"
        >
          <span
            className={`relative h-5 w-9 rounded-full transition-colors ${
              diffOnly
                ? 'bg-[#0B4F71] dark:bg-[#38BDF8]'
                : 'bg-[#E2EBF0] dark:bg-[#1E354A]'
            }`}
            aria-hidden="true"
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all dark:bg-[#09131D] ${
                diffOnly ? 'left-4' : 'left-0.5'
              }`}
            />
          </span>
          仅看差异项
        </button>

        <span className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              clearCompare();
              replaceIds('');
            }}
            disabled={activeSpecies.length === 0}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-[#E2EBF0] bg-white px-2.5 text-[11px] font-semibold text-[#52667A] transition-colors hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#94A3B8]"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            清空
          </button>
          <button
            type="button"
            onClick={() => void copyCompareLink()}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-[#0B4F71] px-2.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 dark:bg-[#38BDF8] dark:text-[#07131F]"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            {copyState === 'copied'
              ? '已复制'
              : copyState === 'failed'
                ? '复制失败'
                : '复制对比链接'}
          </button>
        </span>
      </div>

      {activeSpecies.length < 2 ? (
        <section className="mt-3 rounded-3xl border border-[#E2EBF0] bg-white p-4 dark:border-[#1E354A] dark:bg-[#102030]">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0B4F71]/10 text-[#0B4F71] dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
              <Link2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                快速载入高人气对照
              </h2>
              <p className="text-[11px] text-[#52667A] dark:text-[#94A3B8]">
                从防坑专题中动态抽取，点一下直接开比
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {presets.map((preset) => (
              <button
                key={preset.ids.join(',')}
                type="button"
                onClick={() => loadPreset(preset)}
                className="group flex items-center gap-2 rounded-2xl border border-[#E2EBF0] bg-[#F6F9FB] p-3 text-left transition-colors hover:border-[#0B4F71]/30 hover:bg-white dark:border-[#1E354A] dark:bg-[#0B1824] dark:hover:border-[#38BDF8]/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                    {preset.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                    {preset.ids
                      .map((id) => data?.speciesById[id]?.names.zh_formal ?? id)
                      .join(' vs ')}
                  </p>
                </div>
                <ArrowRight
                  className="h-3.5 w-3.5 shrink-0 text-[#52667A] transition-transform group-hover:translate-x-0.5 dark:text-[#94A3B8]"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {activeSpecies.length > 0 ? (
        <div className="mt-3 space-y-2.5">
          {visibleDimensions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-10 text-center text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              这一组物种在所有对比维度上完全一致，关掉「仅看差异项」可查看全部信息。
            </div>
          ) : (
            visibleDimensions.map((dimension) => {
              const keys = activeSpecies.map((species) =>
                dimension.getKey(species),
              );
              const divergent = new Set(keys).size > 1;
              return (
                <section
                  key={dimension.id}
                  className={`overflow-hidden rounded-3xl border ${
                    divergent
                      ? 'border-amber-200/80 bg-amber-50/35 dark:border-amber-500/25 dark:bg-amber-500/[0.06]'
                      : 'border-[#E2EBF0] bg-white dark:border-[#1E354A] dark:bg-[#102030]'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center gap-2 border-b px-3 py-2 text-center ${
                      divergent
                        ? 'border-amber-200/70 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/10'
                        : 'border-[#E2EBF0] bg-[#0B4F71]/[0.035] dark:border-[#1E354A] dark:bg-[#38BDF8]/[0.06]'
                    }`}
                  >
                    <h2 className="text-[11px] font-semibold tracking-wide text-[#0B4F71] dark:text-[#38BDF8]">
                      {dimension.label}
                    </h2>
                    {divergent ? (
                      <span className="rounded-full border border-amber-200 bg-white/70 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                        有差异
                      </span>
                    ) : null}
                  </div>

                  <div
                    className={`grid gap-2 p-2 ${
                      activeSpecies.length === 1
                        ? 'grid-cols-1'
                        : activeSpecies.length === 2
                          ? 'grid-cols-2'
                          : 'grid-cols-2 lg:grid-cols-3'
                    }`}
                  >
                    {activeSpecies.map((species, index) => (
                      <div
                        key={species.id}
                        className={`rounded-2xl border p-2.5 ${
                          divergent
                            ? 'border-amber-200/70 bg-white/90 dark:border-amber-500/20 dark:bg-[#102030]/90'
                            : 'border-[#E2EBF0]/80 bg-white/70 dark:border-[#1E354A]/80 dark:bg-[#0B1824]/60'
                        } ${
                          activeSpecies.length === 3 && index === 2
                            ? 'col-span-2 lg:col-span-1'
                            : ''
                        }`}
                      >
                        <p className="mb-1.5 line-clamp-1 text-[10px] font-semibold text-[#52667A] dark:text-[#94A3B8]">
                          {String.fromCharCode(65 + index)} ·{' '}
                          {species.names.zh_formal}
                        </p>
                        {dimension.render(species)}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      ) : null}

      {pickerSlot !== null && data ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="选择要对比的物种"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-0 py-0 sm:items-center sm:p-4"
          onClick={() => setPickerSlot(null)}
        >
          <div
            className="glass-panel flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E2EBF0] px-4 py-3 dark:border-[#1E354A]">
              <div>
                <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                  {pickerSlot < activeSpecies.length ? '换一条' : '添加物种'}
                </p>
                <p className="text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                  搜索中文、拼音、英文或招牌名菜
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerSlot(null)}
                aria-label="关闭选择器"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#52667A] hover:bg-[#0B4F71]/10 dark:text-[#94A3B8] dark:hover:bg-[#38BDF8]/10"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="border-b border-[#E2EBF0] p-3 dark:border-[#1E354A]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#52667A] dark:text-[#94A3B8]"
                  aria-hidden="true"
                />
                <input
                  autoFocus
                  type="text"
                  value={pickerQuery}
                  onChange={(event) => setPickerQuery(event.target.value)}
                  placeholder="输入关键词…"
                  aria-label="搜索要对比的物种"
                  className="hf-input h-10 pl-9 pr-3 text-xs"
                />
              </div>
            </div>

            <div className="safe-bottom min-h-0 flex-1 overflow-y-auto p-2">
              {pickerHits.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-[#52667A] dark:text-[#94A3B8]">
                  没有匹配的物种，换个关键词试试。
                </p>
              ) : (
                <ul className="space-y-1">
                  {pickerHits.map((hit) => {
                    const disabled =
                      activeIds.includes(hit.item.id) &&
                      activeIds[pickerSlot] !== hit.item.id;
                    return (
                      <li key={hit.item.id}>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => chooseSpecies(hit.item.id)}
                          className="flex w-full items-center gap-2.5 rounded-2xl border border-transparent px-2.5 py-2 text-left transition-colors hover:border-[#0B4F71]/20 hover:bg-[#0B4F71]/[0.045] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:border-[#38BDF8]/25 dark:hover:bg-[#38BDF8]/[0.08]"
                        >
                          <SpeciesPlaceholderSvg
                            category={hit.item.category}
                            fleshColor={
                              fishAttrs(hit.item)?.flesh_color_tag ?? null
                            }
                            cover={hit.item.media.cover}
                            alt={hit.item.names.zh_formal}
                            id={hit.item.id}
                            className="h-10 w-10 shrink-0 rounded-xl border border-[#E2EBF0]/80 dark:border-[#1E354A]/80"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                              {hit.item.names.zh_formal}
                            </span>
                            <span className="block truncate text-[10px] italic text-[#52667A] dark:text-[#94A3B8]">
                              {hit.item.names.latin}
                            </span>
                            {hit.matchSource ? (
                              <span className="mt-0.5 block truncate text-[9px] text-[#0E86A8] dark:text-[#22D3EE]">
                                {hit.matchSource}
                              </span>
                            ) : null}
                          </span>
                          <SashimiBadge level={hit.item.sashimi.level} compact />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}