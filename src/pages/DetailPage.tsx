import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Link2,
  MapPin,
  NotebookPen,
  ShieldAlert,
  Sparkles,
  Tags,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { HabitatGradientBackdrop } from '../components/common/HabitatGradientBackdrop';
import { SafetyBanner } from '../components/common/SafetyBanner';
import { SashimiBadge } from '../components/common/SashimiBadge';
import { SpeciesPlaceholderSvg } from '../components/common/SpeciesPlaceholderSvg';
import { CategoryAttrsRenderer } from '../components/species/CategoryAttrsRenderer';
import { useData } from '../context/DataContext';
import { formatCommonPlaces, isSpeciesInSeason } from '../services/filters';
import { getRelatedSpecies, resolveRedirectId } from '../services/kinship';
import { USER_TAGS, useAppStore, type UserTag } from '../store/useAppStore';
import {
  AVAILABILITY_LABELS,
  CATEGORY_LABELS,
  HISTAMINE_LABELS,
  SALINITY_LABELS,
  getRegionFlag,
  getRegionalPolicyLabel,
  type Availability,
  type BivalveCategoryAttrs,
  type CephalopodCategoryAttrs,
  type CrustaceanCategoryAttrs,
  type FishCategoryAttrs,
  type GastropodCategoryAttrs,
  type HistamineRisk,
  type LoadedAppData,
  type PriceTier,
  type SourceRef,
  type SpeciesRecord,
  type TaxonCodes,
} from '../types/schema';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const INTERNAL_EXTRA_KEYS = new Set([
  'species_id',
  'legacy_id',
  'superorder',
  'order',
  'family',
  'subfamily',
  'genus',
  'pin_bone_raw',
]);

const EXTRA_ATTR_LABELS: Record<string, string> = {
  nsw_min_legal_cm: 'NSW 最低合法尺寸 (cm)',
  iucn_status: 'IUCN 保护等级',
  suffix: '品系 / 变体后缀',
  size_cm: '体长范围 (cm)',
  min_legal_cm: '最低合法尺寸 (cm)',
};

const AVAILABILITY_DOT: Record<Availability, string> = {
  common: 'bg-emerald-500 dark:bg-emerald-400',
  occasional: 'bg-amber-500 dark:bg-amber-400',
  rare_import: 'bg-sky-500 dark:bg-sky-400',
  none: 'bg-red-400 dark:bg-red-400',
  unknown: 'bg-slate-400 dark:bg-slate-500',
};

const TAG_ACTIVE_TONE: Record<UserTag, string> = {
  常买: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300',
  想试: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300',
  避雷: 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300',
};

/** Taxonomy ancestors displayed as a continuous dot-separated line (no subfamily). */
const TAXON_LEVELS: readonly { key: keyof TaxonCodes; label: string }[] = [
  { key: 'superorder', label: '总目' },
  { key: 'order', label: '目' },
  { key: 'family', label: '科' },
  { key: 'genus', label: '属' },
];

const HISTAMINE_TONE: Record<HistamineRisk, string> = {
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  medium:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  medium_high:
    'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300',
  high: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
  very_high:
    'border-red-300 bg-red-100 text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200',
};

const HISTAMINE_GUIDANCE: Record<HistamineRisk, string> = {
  low: '冷藏保鲜即可，仍建议尽快食用。',
  medium: '需全程冷链，避免常温久置与反复冻融。',
  medium_high: '青皮鱼组胺敏感，务必极鲜并保持 4°C 以下冷链。',
  high: '变质后极易累积耐热组胺，拒绝不鲜个体并全程控温。',
  very_high: '组胺中毒高风险，必须全程 4°C 以下冷链，任何脱冷个体都应丢弃。',
};

function stripParens(label: string): string {
  return label.replace(/[（(][^）)]*[）)]/g, '').trim() || label;
}

function formatExtraValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => formatExtraValue(item))
      .filter(Boolean)
      .join('、');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}

function prettyExtraKey(key: string): string {
  const known = EXTRA_ATTR_LABELS[key];
  if (known) {
    return known;
  }
  return key
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function sourceLabel(source: SourceRef): string {
  if (source.title && source.title.trim()) {
    return source.title.trim();
  }
  if (source.url) {
    try {
      return new URL(source.url).hostname;
    } catch {
      return source.url;
    }
  }
  return '来源';
}

function fallbackCopyText(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(textarea);
  return copied;
}

interface TaxonomySegment {
  key: string;
  label: string;
  name: string;
  code?: string;
}

function buildTaxonomySegments(
  species: SpeciesRecord,
  data: LoadedAppData,
): TaxonomySegment[] {
  const segments: TaxonomySegment[] = [
    {
      key: 'category',
      label: '大类',
      name: CATEGORY_LABELS[species.category],
    },
  ];

  const codes = species.taxon_codes;
  if (codes) {
    for (const level of TAXON_LEVELS) {
      const code = codes[level.key];
      if (!code) {
        continue;
      }
      const node = data.taxonomyByCode[code];
      const fallback = species.extra_attrs[level.key];
      const rawName =
        node?.name_zh ??
        (typeof fallback === 'string' && fallback.trim() ? fallback : code);
      segments.push({
        key: level.key,
        label: level.label,
        code,
        name: stripParens(rawName),
      });
    }
  }

  segments.push({
    key: 'species',
    label: '种',
    name: stripParens(species.names.zh_formal),
  });
  return segments;
}
interface SectionCardProps {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}

function SectionCard({
  id,
  title,
  description,
  icon: Icon,
  children,
  className = '',
}: SectionCardProps) {
  return (
    <section id={id} className={`hf-card p-4 sm:p-5 ${className}`}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0B4F71]/[0.08] text-[#0B4F71] dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-[#0F172A] dark:text-[#F1F5F9]">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-4 text-[#52667A] dark:text-[#94A3B8]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function CompareButton({ id }: { id: string }) {
  const compareIds = useAppStore((state) => state.compareIds);
  const toggleCompare = useAppStore((state) => state.toggleCompare);
  const selected = compareIds.includes(id);
  const full = !selected && compareIds.length >= 3;

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={full}
      onClick={() => toggleCompare(id)}
      title={
        full
          ? '对比队列已满（最多 3 种）'
          : selected
            ? '从对比队列移除'
            : '加入对比队列'
      }
      className={`inline-flex h-7 shrink-0 items-center justify-center rounded-full border px-2.5 text-[10px] font-semibold transition-colors ${
        selected
          ? 'border-[#0B4F71] bg-[#0B4F71] text-white dark:border-[#38BDF8] dark:bg-[#38BDF8] dark:text-[#07131F]'
          : full
            ? 'cursor-not-allowed border-[#E2EBF0] bg-[#F6F9FB] text-[#94A3B8] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#52667A]'
            : 'border-[#E2EBF0] bg-white text-[#0B4F71] hover:border-[#0B4F71]/40 hover:bg-[#0B4F71]/5 dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#38BDF8] dark:hover:border-[#38BDF8]/40'
      }`}
    >
      {selected ? '已加入' : '+ 对比'}
    </button>
  );
}

function RelatedStripCard({
  item,
  relation,
}: {
  item: SpeciesRecord;
  relation: string;
}) {
  const attrs =
    item.category === 'FI' ? (item.category_attrs as FishCategoryAttrs) : null;

  return (
    <div className="flex w-[16.5rem] shrink-0 flex-col rounded-2xl border border-[#E2EBF0] bg-white/80 p-3 dark:border-[#1E354A] dark:bg-[#102030]/70">
      <Link
        to={`/species/${item.id}`}
        className="group flex min-w-0 items-start gap-2.5 outline-none"
      >
        <SpeciesPlaceholderSvg
          category={item.category}
          fleshColor={attrs?.flesh_color_tag ?? null}
          cover={item.media.cover}
          alt={item.names.zh_formal}
          id={item.id}
          className="h-12 w-12 shrink-0 rounded-xl border border-[#E2EBF0] dark:border-[#1E354A]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <span className="rounded-full border border-[#0B4F71]/15 bg-[#0B4F71]/[0.06] px-1.5 py-0.5 text-[9px] font-semibold text-[#0B4F71] dark:border-[#38BDF8]/20 dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
              {relation}
            </span>
            <SashimiBadge level={item.sashimi.level} compact />
          </div>
          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-4 text-[#0F172A] group-hover:text-[#0B4F71] dark:text-[#F1F5F9] dark:group-hover:text-[#38BDF8]">
            {item.names.zh_formal}
          </p>
          <p className="mt-0.5 line-clamp-1 text-[10px] italic leading-4 text-[#52667A] dark:text-[#94A3B8]">
            {item.names.latin}
          </p>
        </div>
      </Link>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#E2EBF0] pt-2 dark:border-[#1E354A]">
        <Link
          to={`/species/${item.id}`}
          className="text-[10px] font-medium text-[#0B4F71] dark:text-[#38BDF8]"
        >
          查看详情 →
        </Link>
        <CompareButton id={item.id} />
      </div>
    </div>
  );
}

function MonthGrid({
  months,
  currentMonth,
}: {
  months: number[];
  currentMonth: number;
}) {
  return (
    <div
      className="mt-2 grid grid-cols-12 gap-0.5 sm:gap-1"
      role="list"
      aria-label="1 至 12 月时令日历"
    >
      {MONTHS.map((month) => {
        const active = months.includes(month);
        const current = month === currentMonth;
        return (
          <div
            key={month}
            role="listitem"
            title={`${month} 月${active ? ' · 当季正肥' : ''}`}
            className={`flex h-9 min-w-0 flex-col items-center justify-center rounded-lg border text-[10px] font-medium tabular-nums ${
              active
                ? 'border-[#0B4F71] bg-[#0B4F71] text-white dark:border-[#38BDF8] dark:bg-[#38BDF8] dark:text-[#07131F]'
                : 'border-[#E2EBF0] bg-[#F6F9FB] text-[#52667A] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#94A3B8]'
            } ${
              current
                ? 'ring-2 ring-[#0E86A8] ring-offset-1 ring-offset-white dark:ring-[#22D3EE] dark:ring-offset-[#102030]'
                : ''
            }`}
          >
            <span>{month}</span>
            <span
              className={`mt-0.5 h-1 w-1 rounded-full ${
                active ? 'bg-white/80 dark:bg-[#07131F]/70' : 'bg-transparent'
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}

function RelativesStrip({
  title,
  items,
  relation,
}: {
  title: string;
  items: SpeciesRecord[];
  relation: string;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <h3 className="text-[11px] font-semibold tracking-wide text-[#0E86A8] dark:text-[#22D3EE]">
          {title}
        </h3>
        <span className="text-[10px] text-[#52667A] dark:text-[#94A3B8]">
          横向滑动查看更多 →
        </span>
      </div>
      <div className="no-scrollbar mt-2 flex gap-2.5 overflow-x-auto pb-2">
        {items.map((item) => (
          <RelatedStripCard key={item.id} item={item} relation={relation} />
        ))}
      </div>
    </div>
  );
}

function FishHistaminePanel({ risk }: { risk: HistamineRisk | null | undefined }) {
  if (!risk) {
    return (
      <p className="text-xs leading-5 text-[#52667A] dark:text-[#94A3B8]">
        暂无组胺风险评估。
      </p>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${HISTAMINE_TONE[risk]}`}
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          组胺风险 · {HISTAMINE_LABELS[risk]}
        </span>
      </div>
      <p className="mt-2 rounded-2xl border border-[#E2EBF0] bg-[#F8FBFD]/70 p-3 text-xs leading-6 text-[#0F172A] dark:border-[#1E354A] dark:bg-[#0B1824]/50 dark:text-[#E2E8F0]">
        {HISTAMINE_GUIDANCE[risk]}
      </p>
    </div>
  );
}

function nonFishFreshnessInfo(species: SpeciesRecord): {
  label: string;
  text: string;
} {
  switch (species.category) {
    case 'CR': {
      const attrs = species.category_attrs as CrustaceanCategoryAttrs;
      return {
        label: '氧化 / 黑变风险',
        text:
          (attrs.oxidation_risk ?? '').trim() ||
          '甲壳类死后易黑变，需低温湿润保存并尽快烹饪。',
      };
    }
    case 'BI': {
      const attrs = species.category_attrs as BivalveCategoryAttrs;
      return {
        label: '鲜度 / 生物毒素风险',
        text:
          (attrs.biotoxin_risk ?? '').trim() ||
          '双壳贝类须活体保鲜、充分吐沙，并留意赤潮毒素公告。',
      };
    }
    case 'CE': {
      const attrs = species.category_attrs as CephalopodCategoryAttrs;
      return {
        label: '鲜度 / 失水收缩',
        text:
          (attrs.water_shrinkage ?? '').trim() ||
          '头足类需全程低温，避免反复冻融导致失水与风味流失。',
      };
    }
    case 'GA': {
      const attrs = species.category_attrs as GastropodCategoryAttrs;
      return {
        label: '鲜度 / 内脏处理',
        text:
          (attrs.slime_cleaning ?? '').trim() ||
          '腹足类需活体保鲜并彻底清洗黏液，内脏按品种谨慎处理。',
      };
    }
    default:
      return {
        label: '鲜度提醒',
        text: '非鱼类海产请全程冷链并尽快食用。',
      };
  }
}

function NonFishFreshnessPanel({ species }: { species: SpeciesRecord }) {
  const info = nonFishFreshnessInfo(species);
  return (
    <div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
        {CATEGORY_LABELS[species.category]}鲜度提醒
      </span>
      <p className="mt-2 rounded-2xl border border-[#E2EBF0] bg-[#F8FBFD]/70 p-3 text-xs leading-6 text-[#0F172A] dark:border-[#1E354A] dark:bg-[#0B1824]/50 dark:text-[#E2E8F0]">
        <span className="font-semibold">{info.label}：</span>
        {info.text}
      </p>
    </div>
  );
}
export function DetailPage() {
  const { data, loading, error } = useData();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const rawId = id ?? '';
  const canonicalId = data ? resolveRedirectId(rawId, data.redirects) : rawId;

  useEffect(() => {
    if (data && rawId && canonicalId !== rawId) {
      navigate(`/species/${canonicalId}`, { replace: true });
    }
  }, [data, rawId, canonicalId, navigate]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl" aria-busy="true">
        <div className="hf-card h-72 animate-pulse bg-white/60 dark:bg-[#102030]/60" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="hf-card h-32 animate-pulse bg-white/60 dark:bg-[#102030]/60" />
          <div className="hf-card h-32 animate-pulse bg-white/60 dark:bg-[#102030]/60" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
        <p className="text-sm font-semibold">数据加载失败</p>
        <p className="mt-1 text-xs leading-5">{error}</p>
        <Link
          to="/"
          className="mt-4 inline-flex h-9 items-center rounded-full bg-[#0B4F71] px-4 text-xs font-semibold text-white dark:bg-[#38BDF8] dark:text-[#07131F]"
        >
          返回速查首页
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center rounded-3xl border border-dashed border-[#E2EBF0] bg-white/60 px-5 py-16 text-center dark:border-[#1E354A] dark:bg-[#102030]/50">
        <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
          离线数据尚未就绪
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex h-9 items-center rounded-full bg-[#0B4F71] px-4 text-xs font-semibold text-white dark:bg-[#38BDF8] dark:text-[#07131F]"
        >
          返回速查首页
        </Link>
      </div>
    );
  }

  const species = data.speciesById[canonicalId] ?? null;

  if (!species) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center rounded-3xl border border-dashed border-[#E2EBF0] bg-white/60 px-5 py-16 text-center dark:border-[#1E354A] dark:bg-[#102030]/50">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0B4F71]/[0.07] text-2xl dark:bg-[#38BDF8]/10"
        >
          🐟
        </span>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-[#0F172A] dark:text-[#F1F5F9]">
          未找到该物种
        </h1>
        <p className="mt-1 max-w-md text-xs leading-5 text-[#52667A] dark:text-[#94A3B8]">
          物种 ID{' '}
          <span className="font-mono text-[11px] tabular-nums text-[#0B4F71] dark:text-[#38BDF8]">
            {canonicalId || '—'}
          </span>{' '}
          不在当前离线数据中，可能已被合并或重命名。
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex h-10 items-center rounded-full bg-[#0B4F71] px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90 dark:bg-[#38BDF8] dark:text-[#07131F]"
        >
          返回速查首页
        </Link>
      </div>
    );
  }

  return <DetailContent data={data} species={species} />;
}

interface DetailContentProps {
  data: LoadedAppData;
  species: SpeciesRecord;
}

export function DetailContent({ data, species }: DetailContentProps) {
  const navigate = useNavigate();

  const favorites = useAppStore((state) => state.favorites);
  const compareIds = useAppStore((state) => state.compareIds);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const toggleCompare = useAppStore((state) => state.toggleCompare);
  const setCompareIds = useAppStore((state) => state.setCompareIds);
  const selectedRegion = useAppStore((state) => state.selectedRegion);
  const userTags = useAppStore((state) => state.userTags);
  const toggleUserTag = useAppStore((state) => state.toggleUserTag);
  const setUserNote = useAppStore((state) => state.setUserNote);

  const [copied, setCopied] = useState(false);
  const [noteDraft, setNoteDraft] = useState(
    () => useAppStore.getState().userNotes[species.id] ?? '',
  );
  const [noteSaved, setNoteSaved] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  const copyTimerRef = useRef<number | null>(null);
  const noteTimerRef = useRef<number | null>(null);
  const lastSpeciesIdRef = useRef<string | null>(null);

  const month = new Date().getMonth() + 1;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const previousId = lastSpeciesIdRef.current;
    if (previousId !== null && previousId !== species.id) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    lastSpeciesIdRef.current = species.id;
  }, [species.id]);

  useEffect(() => {
    setNoteDraft(useAppStore.getState().userNotes[species.id] ?? '');
    setNoteSaved(false);
    setSourcesExpanded(false);
    setCopied(false);
    if (noteTimerRef.current !== null) {
      window.clearTimeout(noteTimerRef.current);
      noteTimerRef.current = null;
    }
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
  }, [species.id]);

  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      if (noteTimerRef.current !== null) {
        window.clearTimeout(noteTimerRef.current);
      }
    },
    [],
  );

  const isFavorite = favorites.includes(species.id);
  const isComparing = compareIds.includes(species.id);
  const compareFull = !isComparing && compareIds.length >= 3;
  const tags = userTags[species.id] ?? [];

  const taxonomySegments = buildTaxonomySegments(species, data);
  const inSeason = isSpeciesInSeason(
    species,
    month,
    selectedRegion,
    data.regions,
    false,
  );
  const commonPlaces = formatCommonPlaces(species, data.regions);

  const fishAttrs =
    species.category === 'FI'
      ? (species.category_attrs as FishCategoryAttrs)
      : null;

  const { abSiblings, sameGenus, sameFamily } = getRelatedSpecies(
    species,
    data.species,
  );
  const relatedTraps = data.traps.cross_family_traps.filter((trap) =>
    trap.species_ids.includes(species.id),
  );

  const selectedRegionLabel =
    selectedRegion === 'global'
      ? '全球'
      : (data.regions.regions[selectedRegion]?.label ?? selectedRegion);
  const activeSeasonGroupKey =
    selectedRegion === 'global'
      ? null
      : (data.regions.regions[selectedRegion]?.season_group ?? null);

  const seasonGroups = Object.entries(species.seasonality.by_group).map(
    ([key, entry]) => ({
      key,
      label: data.regions.season_groups[key]?.label ?? key,
      months: entry.months,
      freshYearRound: entry.fresh_year_round === true,
      preservedYearRound: entry.preserved_year_round === true,
      note: entry.note,
      active: key === activeSeasonGroupKey,
    }),
  );

  const priceEntries: {
    key: string;
    label: string;
    flag: string;
    tier: PriceTier;
  }[] = [];
  const seenPriceGroups = new Set<string>();
  for (const config of Object.values(data.regions.regions)) {
    if (!config.enabled || seenPriceGroups.has(config.price_group)) {
      continue;
    }
    const tier = species.buying_guide.price_tier[config.price_group];
    if (!tier) {
      continue;
    }
    seenPriceGroups.add(config.price_group);
    priceEntries.push({
      key: config.price_group,
      label: stripParens(
        data.regions.season_groups[config.price_group]?.label ??
          config.price_group,
      ),
      flag: getRegionFlag(config.price_group),
      tier,
    });
  }
  for (const [group, tier] of Object.entries(species.buying_guide.price_tier)) {
    if (seenPriceGroups.has(group)) {
      continue;
    }
    priceEntries.push({
      key: group,
      label: stripParens(data.regions.season_groups[group]?.label ?? group),
      flag: getRegionFlag(group),
      tier,
    });
  }

  const aliasRows: {
    key: string;
    label: string;
    flag: string;
    availability: Availability;
    aliases: string[];
    active: boolean;
  }[] = [];
  for (const [key, config] of Object.entries(data.regions.regions)) {
    if (!config.enabled) {
      continue;
    }
    aliasRows.push({
      key,
      label: config.label,
      flag: getRegionFlag(key),
      availability: species.availability[key] ?? 'unknown',
      aliases: species.names.aliases[key] ?? [],
      active: selectedRegion === key,
    });
  }
  const otherAliases = species.names.aliases.other;
  if (otherAliases && otherAliases.length > 0) {
    aliasRows.push({
      key: 'other',
      label: '其他地区',
      flag: '📍',
      availability: species.availability.other ?? 'unknown',
      aliases: otherAliases,
      active: false,
    });
  }

  const signatureTags = Array.from(
    new Set(
      species.culinary.methods
        .filter((method) => method.tier === 'signature')
        .map((method) => method.tag),
    ),
  );
  const suitableTags = Array.from(
    new Set(
      species.culinary.methods
        .filter((method) => method.tier === 'suitable')
        .map((method) => method.tag),
    ),
  );

  const customExtraEntries = Object.entries(species.extra_attrs).filter(
    ([key, value]) =>
      !INTERNAL_EXTRA_KEYS.has(key) && Boolean(formatExtraValue(value)),
  );

  const sources = (species.provenance?.sources ?? []).filter(
    (source) => Boolean(source.title || source.url),
  );
  const updatedAt = species.provenance.updated_at
    ? new Date(species.provenance.updated_at).toLocaleDateString('zh-CN')
    : '';
  const hasRelatedContent =
    abSiblings.length > 0 ||
    relatedTraps.length > 0 ||
    sameGenus.length > 0 ||
    sameFamily.length > 0;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handleCopy = async () => {
    const text = window.location.href;
    let copiedOk = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        copiedOk = true;
      } else {
        copiedOk = fallbackCopyText(text);
      }
    } catch {
      copiedOk = fallbackCopyText(text);
    }
    setCopied(copiedOk);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const handleNoteChange = (value: string) => {
    setNoteDraft(value);
    setUserNote(species.id, value);
    setNoteSaved(true);
    if (noteTimerRef.current !== null) {
      window.clearTimeout(noteTimerRef.current);
    }
    noteTimerRef.current = window.setTimeout(() => {
      setNoteSaved(false);
    }, 1800);
  };

  const startCompare = (ids: string[]) => {
    const unique = Array.from(
      new Set(ids.filter((item) => Boolean(data.speciesById[item]))),
    ).slice(0, 3);
    if (unique.length < 2) {
      return;
    }
    setCompareIds(unique);
    navigate(`/compare?ids=${unique.join(',')}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* 1. Hero: basic information + continuous taxonomy + season badge. */}
      <section className="relative isolate overflow-hidden rounded-3xl border border-white/10 shadow-[0_28px_70px_-50px_rgba(4,34,47,0.85)]">
        <HabitatGradientBackdrop active={species.habitat.salinity} />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#041F2E]/35 via-transparent to-transparent dark:from-[#020B12]/40"
        />

        <div className="relative z-10 p-4 sm:p-6">
          {inSeason ? (
            <span
              data-testid="season-badge"
              className="absolute right-4 top-4 z-20 inline-flex h-8 items-center gap-1 rounded-full border border-emerald-300/70 bg-emerald-400/20 px-2.5 text-[11px] font-semibold text-emerald-50 shadow-[0_6px_18px_-8px_rgba(16,185,129,0.7)] backdrop-blur-sm"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-emerald-300"
              />
              当季
            </span>
          ) : null}

          <div
            className={`flex flex-wrap items-center gap-2 ${
              inSeason ? 'pr-24 sm:pr-28' : ''
            }`}
          >
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 text-[11px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              返回
            </button>

            <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                aria-pressed={isFavorite}
                onClick={() => toggleFavorite(species.id)}
                className={`inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold backdrop-blur-sm transition-colors ${
                  isFavorite
                    ? 'border-amber-300/70 bg-amber-300/20 text-amber-50'
                    : 'border-white/25 bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {isFavorite ? '★ 已收藏' : '⭐ 收藏'}
              </button>

              <button
                type="button"
                aria-pressed={isComparing}
                disabled={compareFull}
                onClick={() => toggleCompare(species.id)}
                title={compareFull ? '对比队列已满（最多 3 种）' : undefined}
                className={`inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold backdrop-blur-sm transition-colors ${
                  isComparing
                    ? 'border-sky-300/70 bg-sky-300/20 text-sky-50'
                    : compareFull
                      ? 'cursor-not-allowed border-white/15 bg-white/5 text-white/45'
                      : 'border-white/25 bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {isComparing ? '✓ 已加入对比' : '⚖️ 加入对比'}
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleCopy();
                }}
                className={`inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold backdrop-blur-sm transition-colors ${
                  copied
                    ? 'border-emerald-300/70 bg-emerald-300/20 text-emerald-50'
                    : 'border-white/25 bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {copied ? '✓ 已复制' : '🔗 复制分享链接'}
              </button>
            </div>
          </div>

          <div className="mt-5 min-w-0 max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/65">
              HowFish · 物种档案
            </p>
            <h1 className="mt-1.5 break-words text-[26px] font-semibold leading-8 tracking-tight text-white sm:text-4xl sm:leading-tight">
              {species.names.zh_formal}
            </h1>
            <p className="mt-1.5 break-words text-sm font-medium leading-5 text-white/90">
              {species.names.en_standard}
            </p>
            <p className="mt-0.5 break-words text-xs italic leading-5 text-white/70">
              {species.names.latin}
            </p>

            <nav
              aria-label="生物分类谱系"
              data-testid="taxonomy-line"
              className="mt-2.5 flex flex-wrap items-center text-[11px] leading-5 text-white/85"
            >
              {taxonomySegments.map((segment, index) => (
                <span key={segment.key} className="inline-flex items-center">
                  {index > 0 ? (
                    <span
                      aria-hidden="true"
                      className="whitespace-pre px-0.5 text-white/45"
                    >
                      {' · '}
                    </span>
                  ) : null}
                  {segment.code ? (
                    <Link
                      to={`/atlas?focus=${segment.code}`}
                      title={`${segment.label} · ${segment.name}`}
                      className="whitespace-nowrap rounded px-0.5 underline-offset-2 transition-colors hover:text-white hover:underline"
                    >
                      {segment.name}
                    </Link>
                  ) : (
                    <span
                      className={
                        segment.key === 'species'
                          ? 'whitespace-nowrap font-semibold text-white'
                          : 'whitespace-nowrap'
                      }
                    >
                      {segment.name}
                    </span>
                  )}
                </span>
              ))}
            </nav>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                {SALINITY_LABELS[species.habitat.salinity]}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1 text-xs leading-5 text-white/85">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="break-words">{species.habitat.detail}</span>
              </span>
              <span
                title="谱系 ID"
                className="shrink-0 font-mono text-[10px] tabular-nums tracking-wide text-white/60"
              >
                {species.id}
              </span>
            </div>

            <div className="mt-2.5 flex flex-col gap-1 rounded-2xl border border-white/15 bg-[#041F2E]/20 px-3 py-2 text-[11px] leading-5 text-white/80 backdrop-blur-sm sm:flex-row sm:items-center sm:gap-2">
              <span className="shrink-0 font-semibold text-white/90">
                分布地点概览
              </span>
              <span className="inline-flex w-fit items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 font-medium text-white">
                {commonPlaces}
              </span>
              <p className="line-clamp-2 min-w-0 flex-1 text-white/75">
                {species.habitat.distribution}
              </p>
            </div>
          </div>
        </div>
      </section>
      <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
        {/* 2. Appearance & identification. */}
        <SectionCard
          id="section-appearance"
          title="外观和辨识"
          description="视觉展示与鱼市识别要点"
          icon={Sparkles}
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-start">
            <div className="space-y-2">
              <SpeciesPlaceholderSvg
                category={species.category}
                fleshColor={fishAttrs?.flesh_color_tag ?? null}
                cover={species.media.cover}
                alt={species.names.zh_formal}
                id={species.id}
                className="h-56 w-full rounded-2xl border border-[#E2EBF0] dark:border-[#1E354A]"
              />
              {species.media.diagram ? (
                <img
                  src={species.media.diagram}
                  alt={`${species.names.zh_formal} 辨识示意图`}
                  loading="lazy"
                  decoding="async"
                  className="w-full rounded-2xl border border-[#E2EBF0] object-cover dark:border-[#1E354A]"
                />
              ) : null}
              {species.media.credit ? (
                <p className="text-[10px] leading-4 text-[#52667A] dark:text-[#94A3B8]">
                  图片来源：{species.media.credit}
                </p>
              ) : null}
            </div>

            <div className="min-w-0">
              <h3 className="text-[11px] font-semibold tracking-wide text-[#0E86A8] dark:text-[#22D3EE]">
                辨识要点
              </h3>
              <p className="mt-1.5 whitespace-pre-line rounded-2xl border border-[#E2EBF0] bg-[#F8FBFD]/70 p-3 text-xs leading-6 text-[#0F172A] dark:border-[#1E354A] dark:bg-[#0B1824]/50 dark:text-[#E2E8F0]">
                {species.buying_guide.identification_tips || '暂无辨识要点'}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* 3. Distribution. */}
        <SectionCard
          id="section-distribution"
          title="分布地区"
          description="自然分布水域与各市场俗称 / 常见度矩阵"
          icon={Tags}
        >
          <div className="rounded-2xl border border-[#E2EBF0] bg-[#F8FBFD]/70 p-3 dark:border-[#1E354A] dark:bg-[#0B1824]/50">
            <h3 className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-[#0E86A8] dark:text-[#22D3EE]">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              自然分布
            </h3>
            <p className="mt-1 text-xs leading-6 text-[#0F172A] dark:text-[#E2E8F0]">
              {species.habitat.distribution || '暂无自然分布记录'}
            </p>
          </div>

          <div className="mt-3 space-y-2">
            {aliasRows.map((row) => (
              <div
                key={row.key}
                className={`flex flex-col gap-2 rounded-2xl border p-3 transition-colors sm:flex-row sm:items-start sm:justify-between ${
                  row.active
                    ? 'border-[#0B4F71]/35 bg-[#0B4F71]/[0.05] dark:border-[#38BDF8]/35 dark:bg-[#38BDF8]/[0.06]'
                    : 'border-[#E2EBF0] bg-[#F8FBFD]/70 dark:border-[#1E354A] dark:bg-[#0B1824]/50'
                }`}
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span aria-hidden="true" className="text-base leading-5">
                    {row.flag}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                        {row.label}
                      </span>
                      {row.active ? (
                        <span className="rounded-full bg-[#0B4F71] px-1.5 py-0.5 text-[9px] font-semibold text-white dark:bg-[#38BDF8] dark:text-[#07131F]">
                          当前定位
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${AVAILABILITY_DOT[row.availability]}`}
                      />
                      <span className="text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                        {AVAILABILITY_LABELS[row.availability]}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex min-w-0 flex-wrap gap-1.5 sm:max-w-[60%] sm:justify-end">
                  {row.aliases.length > 0 ? (
                    row.aliases.map((alias) => (
                      <span
                        key={alias}
                        className="max-w-full truncate rounded-full border border-[#E2EBF0] bg-white px-2 py-0.5 text-[10px] font-medium text-[#52667A] dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#94A3B8]"
                        title={alias}
                      >
                        {alias}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                      暂无俗称记录
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 4. Seasonality. */}
        <SectionCard
          id="section-seasonality"
          title="当季"
          description={`1–12 月时令日历 · 当前定位：${selectedRegionLabel}`}
          icon={CalendarDays}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full border border-[#0E86A8]/20 bg-[#0E86A8]/[0.07] px-2.5 py-1 text-[10px] font-semibold tabular-nums text-[#0E86A8] dark:border-[#22D3EE]/25 dark:bg-[#22D3EE]/10 dark:text-[#22D3EE]">
              当前 {month} 月
            </span>
            <span className="inline-flex items-center rounded-full border border-[#E2EBF0] bg-[#F6F9FB] px-2.5 py-1 text-[10px] font-medium text-[#52667A] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#94A3B8]">
              {getRegionFlag(selectedRegion)} {selectedRegionLabel}
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {seasonGroups.length > 0 ? (
              seasonGroups.map((group) => (
                <div
                  key={group.key}
                  className={`rounded-2xl border p-3 ${
                    group.active
                      ? 'border-[#0B4F71]/35 bg-[#0B4F71]/[0.05] dark:border-[#38BDF8]/35 dark:bg-[#38BDF8]/[0.06]'
                      : 'border-[#E2EBF0] bg-[#F8FBFD]/70 dark:border-[#1E354A] dark:bg-[#0B1824]/50'
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                        {group.label}
                      </p>
                      {group.active ? (
                        <span className="rounded-full bg-[#0B4F71] px-1.5 py-0.5 text-[9px] font-semibold text-white dark:bg-[#38BDF8] dark:text-[#07131F]">
                          当前定位
                        </span>
                      ) : null}
                    </div>
                    <span className="text-[10px] tabular-nums text-[#52667A] dark:text-[#94A3B8]">
                      {group.months.length > 0
                        ? `${group.months.length} 个月当季`
                        : '暂无当季月份'}
                    </span>
                  </div>

                  <MonthGrid months={group.months} currentMonth={month} />

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {group.months.length > 0 ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                        鲜食当季
                      </span>
                    ) : null}
                    {group.freshYearRound ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                        全年鲜食供应
                      </span>
                    ) : null}
                    {group.preservedYearRound ? (
                      <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
                        全年冻品/制品供应
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8]">
                    {group.note || '暂无该地区时令说明'}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs leading-5 text-[#52667A] dark:text-[#94A3B8]">
                暂无时令数据
              </p>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <h3 className="text-[11px] font-semibold tracking-wide text-[#0E86A8] dark:text-[#22D3EE]">
                常见售卖形态
              </h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {species.buying_guide.market_forms.length > 0 ? (
                  species.buying_guide.market_forms.map((form) => (
                    <span
                      key={form}
                      className="inline-flex items-center rounded-full border border-[#E2EBF0] bg-white px-2.5 py-1 text-[10px] font-medium text-[#52667A] dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#94A3B8]"
                    >
                      {form}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                    暂无售卖形态数据
                  </span>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold tracking-wide text-[#0E86A8] dark:text-[#22D3EE]">
                各地区参考价位
              </h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {priceEntries.length > 0 ? (
                  priceEntries.map((entry) => (
                    <span
                      key={entry.key}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#E2EBF0] bg-white px-2.5 py-1 text-[10px] font-medium text-[#52667A] dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#94A3B8]"
                    >
                      <span>
                        {entry.flag} {entry.label}
                      </span>
                      <span className="font-semibold tabular-nums text-[#0B4F71] dark:text-[#38BDF8]">
                        {entry.tier}
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                    暂无价位数据
                  </span>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
        {/* 5. Notes & remarks: safety alerts first, then extras and sources. */}
        <SectionCard
          id="section-notes-remarks"
          title="备注"
          description="安全法规警示、特殊备注、扩展属性与数据来源"
          icon={BookOpen}
        >
          <SafetyBanner items={species.safety_and_legal} />

          {species.special_notes.trim() ? (
            <div className="mt-3">
              <h3 className="text-[11px] font-semibold tracking-wide text-[#0E86A8] dark:text-[#22D3EE]">
                特殊备注
              </h3>
              <p className="mt-1.5 whitespace-pre-line rounded-2xl border border-[#E2EBF0] bg-[#F8FBFD]/70 p-3 text-xs leading-6 text-[#0F172A] dark:border-[#1E354A] dark:bg-[#0B1824]/50 dark:text-[#E2E8F0]">
                {species.special_notes}
              </p>
            </div>
          ) : null}

          {customExtraEntries.length > 0 ? (
            <div className="mt-3">
              <h3 className="text-[11px] font-semibold tracking-wide text-[#0E86A8] dark:text-[#22D3EE]">
                动态扩展属性
              </h3>
              <dl className="mt-1.5 grid gap-2 sm:grid-cols-2">
                {customExtraEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-[#E2EBF0] bg-white/75 px-2.5 py-2 dark:border-[#1E354A] dark:bg-[#102030]/60"
                  >
                    <dt className="text-[10px] font-medium tracking-wide text-[#52667A] dark:text-[#94A3B8]">
                      {prettyExtraKey(key)}
                    </dt>
                    <dd className="mt-0.5 break-words text-xs font-semibold leading-5 text-[#0F172A] dark:text-[#F1F5F9]">
                      {formatExtraValue(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {sources.length > 0 ? (
            <div className="mt-4 border-t border-[#E2EBF0] pt-3 dark:border-[#1E354A]">
              <button
                type="button"
                aria-expanded={sourcesExpanded}
              onClick={() => setSourcesExpanded((value) => !value)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="text-[11px] font-semibold tracking-wide text-[#0E86A8] dark:text-[#22D3EE]">
                数据来源 · {sources.length} 条
              </span>
              <span className="flex items-center gap-2 text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                <span>
                  置信度 · {species.provenance.confidence}
                  {updatedAt ? ` · 更新 ${updatedAt}` : ''}
                </span>
                {sourcesExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </span>
            </button>

            {sourcesExpanded ? (
              sources.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sources.map((source, index) => {
                    const label = sourceLabel(source);
                    const baseClass =
                      'inline-flex max-w-[16rem] items-center gap-1 rounded-full border border-[#E2EBF0] bg-white px-2.5 py-1 text-[10px] font-medium text-[#52667A] dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#94A3B8]';
                    if (!source.url) {
                      return (
                        <span key={`${label}-${index}`} className={baseClass}>
                          {label}
                        </span>
                      );
                    }
                    return (
                      <a
                        key={`${label}-${index}`}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        title={source.url}
                        className={`${baseClass} transition-colors hover:border-[#0B4F71]/30 hover:text-[#0B4F71] dark:hover:border-[#38BDF8]/40 dark:hover:text-[#38BDF8]`}
                      >
                        <ExternalLink
                          className="h-3 w-3 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">{label}</span>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                  暂无来源记录
                </p>
              )
              ) : null}
            </div>
          ) : null}
        </SectionCard>

        {/* 6. Pin bones / sensory sketch / flesh colour. */}
        <SectionCard
          id="section-sensory"
          title="肌间刺 / 感官速写 / 肉色"
          description="单列纵向关键指标与感官速写"
          icon={Activity}
        >
          <CategoryAttrsRenderer species={species} />

          <div className="mt-4 border-t border-[#E2EBF0] pt-3 dark:border-[#1E354A]">
            <h3 className="text-[11px] font-semibold tracking-wide text-[#0E86A8] dark:text-[#22D3EE]">
              感官速写
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {species.sensory.texture_tags.length > 0 ? (
                species.sensory.texture_tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full border border-[#E2EBF0] bg-white/80 px-2 py-0.5 text-[10px] font-medium text-[#52667A] dark:border-[#1E354A] dark:bg-[#102030]/70 dark:text-[#94A3B8]"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                  暂无口感标签
                </span>
              )}
            </div>
            {species.sensory.odor_profile ? (
              <span className="mt-1.5 inline-flex items-center rounded-full border border-[#0E86A8]/20 bg-[#0E86A8]/[0.07] px-2 py-0.5 text-[10px] font-medium text-[#0E86A8] dark:border-[#22D3EE]/25 dark:bg-[#22D3EE]/10 dark:text-[#22D3EE]">
                气味 · {species.sensory.odor_profile}
              </span>
            ) : null}
            <p className="mt-1.5 text-xs leading-6 text-[#52667A] dark:text-[#94A3B8]">
              {species.sensory.summary || '暂无感官总结'}
            </p>
          </div>
        </SectionCard>

        {/* 7. Culinary methods. */}
        <SectionCard
          id="section-culinary"
          title="烹饪方式"
          description="主打绝配、常规可行、标志性名菜与备菜要点"
          icon={Utensils}
        >
          <div className="space-y-3">
            <div>
              <h3 className="text-[11px] font-semibold tracking-wide text-[#0E86A8] dark:text-[#22D3EE]">
                主打绝配 · Signature
              </h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {signatureTags.length > 0 ? (
                  signatureTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-[#0B4F71] px-2.5 py-1 text-[10px] font-semibold text-white dark:bg-[#38BDF8] dark:text-[#07131F]"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                    暂无主打做法
                  </span>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold tracking-wide text-[#0E86A8] dark:text-[#22D3EE]">
                常规可行 · Suitable
              </h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {suitableTags.length > 0 ? (
                  suitableTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full border border-[#0B4F71]/30 px-2.5 py-1 text-[10px] font-semibold text-[#0B4F71] dark:border-[#38BDF8]/40 dark:text-[#38BDF8]"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                    暂无常规做法
                  </span>
                )}
              </div>
            </div>

            {species.culinary.signature_dishes.length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-[#FFF9EC] to-amber-50/40 p-3 dark:border-amber-500/25 dark:from-amber-500/10 dark:via-amber-500/5 dark:to-transparent">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-amber-800 dark:text-amber-200">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  标志性名菜 / 特产制品
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {species.culinary.signature_dishes.map((dish) => (
                    <span
                      key={dish}
                      className="inline-flex items-center rounded-full border border-amber-300/60 bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100"
                    >
                      {dish}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <h3 className="text-[11px] font-semibold tracking-wide text-[#0E86A8] dark:text-[#22D3EE]">
                实战烹饪指南
              </h3>
              <p className="mt-1.5 whitespace-pre-line rounded-2xl border border-[#E2EBF0] bg-[#F8FBFD]/70 p-3 text-xs leading-6 text-[#0F172A] dark:border-[#1E354A] dark:bg-[#0B1824]/50 dark:text-[#E2E8F0]">
                {species.culinary.cooking_guide || '暂无烹饪指南'}
              </p>
            </div>

            <div>
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-[#0E86A8] dark:text-[#22D3EE]">
                <span aria-hidden="true">🔪</span> 备菜预处理要点
              </h3>
              {species.prep_tips.length > 0 ? (
                <ul className="mt-1.5 grid gap-2 sm:grid-cols-2">
                  {species.prep_tips.map((tip, index) => (
                    <li
                      key={`${index}-${tip}`}
                      className="flex items-start gap-2 rounded-xl border border-[#E2EBF0] bg-white/75 px-2.5 py-2 dark:border-[#1E354A] dark:bg-[#102030]/60"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <span className="text-xs leading-5 text-[#0F172A] dark:text-[#E2E8F0]">
                        {tip}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-xs text-[#52667A] dark:text-[#94A3B8]">
                  暂无备菜要点
                </p>
              )}
            </div>
          </div>
        </SectionCard>
        {/* 8. Histamine risk. */}
        <SectionCard
          id="section-histamine"
          title="组胺风险"
          description="组胺风险分级与冷链处理建议"
          icon={ShieldAlert}
        >
          {species.category === 'FI' ? (
            <FishHistaminePanel risk={fishAttrs?.histamine_risk ?? null} />
          ) : (
            <NonFishFreshnessPanel species={species} />
          )}
        </SectionCard>

        {/* 9. Sashimi evaluation. */}
        <SectionCard
          id="section-sashimi"
          title="刺身评价"
          description="5 档生食安全评级与完整说明"
          icon={Sparkles}
        >
          <div className="flex flex-wrap items-center gap-2">
            {species.sashimi.level ? (
              <SashimiBadge level={species.sashimi.level} />
            ) : (
              <span className="inline-flex items-center rounded-full border border-[#E2EBF0] bg-[#F6F9FB] px-2.5 py-1 text-xs font-medium text-[#52667A] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#94A3B8]">
                未评级
              </span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-line rounded-2xl border border-[#E2EBF0] bg-[#F8FBFD]/70 p-3 text-xs leading-6 text-[#0F172A] dark:border-[#1E354A] dark:bg-[#0B1824]/50 dark:text-[#E2E8F0]">
            {species.sashimi.note || '暂无补充说明'}
          </p>
          {Object.keys(species.sashimi.regional_policies ?? {}).length > 0 ? (
            <div className="mt-3" data-testid="sashimi-regional-policies">
              <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-[#52667A] dark:text-[#94A3B8]">
                地区生食政策与法规
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {Object.entries(species.sashimi.regional_policies ?? {}).map(
                  ([regionKey, policy]) => {
                    const active =
                      selectedRegion !== 'global' &&
                      (selectedRegion === regionKey ||
                        selectedRegion.startsWith(regionKey) ||
                        regionKey.startsWith(selectedRegion));
                    return (
                      <div
                        key={regionKey}
                        data-active={active ? 'true' : 'false'}
                        className={`rounded-xl border px-2.5 py-2 text-[11px] leading-5 transition-colors ${
                          active
                            ? 'border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-400/50 dark:bg-orange-500/15 dark:text-orange-200'
                            : 'border-[#E2EBF0] bg-white/70 text-[#33475B] dark:border-[#1E354A] dark:bg-[#102030]/60 dark:text-[#CBD5E1]'
                        }`}
                      >
                        <span className="mr-1 font-semibold">
                          {getRegionFlag(regionKey)}{' '}
                          {getRegionalPolicyLabel(regionKey)}
                        </span>
                        {active ? (
                          <span className="ml-1 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-orange-700 dark:text-orange-300">
                            当前定位
                          </span>
                        ) : null}
                        <p className="mt-1">{policy}</p>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          ) : null}
        </SectionCard>

        {/* 10. Personal notes. */}
        <SectionCard
          id="section-personal-notes"
          title="笔记"
          description="本地私密保存 · 自动同步到本机 LocalStorage"
          icon={NotebookPen}
        >
          <div className="flex flex-wrap gap-1.5">
            {USER_TAGS.map((tag) => {
              const active = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleUserTag(species.id, tag)}
                  className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
                    active
                      ? TAG_ACTIVE_TONE[tag]
                      : 'border-[#E2EBF0] bg-white text-[#52667A] hover:border-[#0B4F71]/30 hover:text-[#0B4F71] dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#94A3B8] dark:hover:border-[#38BDF8]/40 dark:hover:text-[#38BDF8]'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            <textarea
              value={noteDraft}
              onChange={(event) => handleNoteChange(event.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="记录这批货的鲜度、摊位、价格或家人的口味反馈…"
              aria-label="个人鱼市笔记"
              className="hf-input min-h-[6.5rem] resize-y p-3 text-sm leading-6"
            />
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                仅保存在本机，不会上传
              </span>
              <span
                aria-live="polite"
                className={`inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 transition-opacity dark:text-emerald-400 ${
                  noteSaved ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <Check className="h-3 w-3" aria-hidden="true" />
                已自动保存
              </span>
            </div>
          </div>
        </SectionCard>

        {/* 11. Related recommendations. */}
        <SectionCard
          id="section-related"
          title="关联推荐"
          description="同种兄弟品系、跨科撞名陷阱与同属同科平替"
          icon={Link2}
        >
          {abSiblings.length > 0 ? (
            <div className="space-y-2">
              {abSiblings.map((sibling) => (
                <div
                  key={sibling.id}
                  className="rounded-2xl border border-[#0B4F71]/20 bg-gradient-to-r from-[#0B4F71]/[0.06] to-transparent p-3 dark:border-[#38BDF8]/25 dark:from-[#38BDF8]/10"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0E86A8] dark:text-[#22D3EE]">
                        同种兄弟品系对照
                      </p>
                      <Link
                        to={`/species/${sibling.id}`}
                        className="mt-0.5 block break-words text-sm font-semibold text-[#0B4F71] dark:text-[#38BDF8]"
                      >
                        {sibling.names.zh_formal}
                      </Link>
                      <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-[#52667A] dark:text-[#94A3B8]">
                        {sibling.names.en_standard} · {sibling.names.latin}
                      </p>
                      {sibling.special_notes ? (
                        <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#52667A] dark:text-[#94A3B8]">
                          {sibling.special_notes}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Link
                        to={`/species/${sibling.id}`}
                        className="inline-flex h-8 items-center rounded-full border border-[#0B4F71]/20 bg-white/70 px-3 text-[10px] font-semibold text-[#0B4F71] dark:border-[#38BDF8]/25 dark:bg-[#102030]/70 dark:text-[#38BDF8]"
                      >
                        查看详情 →
                      </Link>
                      <button
                        type="button"
                        onClick={() => startCompare([species.id, sibling.id])}
                        className="inline-flex h-8 items-center rounded-full bg-[#0B4F71] px-3 text-[10px] font-semibold text-white transition-opacity hover:opacity-90 dark:bg-[#38BDF8] dark:text-[#07131F]"
                      >
                        ⚖️ 一键 VS 对比
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {relatedTraps.length > 0 ? (
            <div className={`space-y-2 ${abSiblings.length > 0 ? 'mt-3' : ''}`}>
              {relatedTraps.map((trap) => {
                const trapIds = Array.from(
                  new Set(
                    trap.species_ids.filter((item) =>
                      Boolean(data.speciesById[item]),
                    ),
                  ),
                ).slice(0, 3);
                return (
                  <div
                    key={`${trap.title}-${trap.trap_index ?? 0}`}
                    className="rounded-2xl border border-red-200 bg-red-50/80 p-3 dark:border-red-500/30 dark:bg-red-500/10"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300">
                        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold leading-5 text-red-800 dark:text-red-200">
                          跨科撞名陷阱 · {trap.title}
                        </p>
                        <p className="mt-1 line-clamp-3 text-[11px] leading-5 text-red-900/80 dark:text-red-100/80">
                          {trap.truth}
                        </p>
                        {trap.tips ? (
                          <p className="mt-1 text-[10px] leading-4 text-red-700/80 dark:text-red-200/70">
                            {trap.tips}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          disabled={trapIds.length < 2}
                          onClick={() => startCompare(trapIds)}
                          className="mt-2 inline-flex h-8 items-center gap-1 rounded-full bg-red-600 px-3 text-[10px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-red-500"
                        >
                          ⚖️ 一键真身 VS 对比
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <RelativesStrip
            title="同属近亲 · sameGenus"
            items={sameGenus}
            relation="同属兄弟"
          />
          <RelativesStrip
            title="同科近亲 · sameFamily"
            items={sameFamily}
            relation="同科近亲"
          />

          {!hasRelatedContent ? (
            <p className="text-xs leading-5 text-[#52667A] dark:text-[#94A3B8]">
              暂无关联推荐
            </p>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}