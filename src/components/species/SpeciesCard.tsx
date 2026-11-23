import { Check, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useData } from '../../context/DataContext';
import {
  formatCommonPlaces,
  isFreshYearRound,
  isPreservedYearRound,
  isSpeciesInSeason,
  isSpeciesUnavailableInRegion,
} from '../../services/filters';
import { useAppStore } from '../../store/useAppStore';
import {
  CATEGORY_LABELS,
  type FishCategoryAttrs,
  type SashimiLevel,
  type SpeciesRecord,
  type TaxonomyNode,
} from '../../types/schema';
import { SpeciesPlaceholderSvg } from '../common/SpeciesPlaceholderSvg';

interface SpeciesCardProps {
  species: SpeciesRecord;
  month: number;
  matchSource?: string;
  seasonNote?: string;
}

const SASHIMI_TEXT: Record<
  SashimiLevel,
  { label: string; className: string }
> = {
  recommended: {
    label: '推荐生食',
    className: 'text-emerald-600 dark:text-emerald-300',
  },
  conditional: {
    label: '有条件生食',
    className: 'text-amber-600 dark:text-amber-300',
  },
  traditional_not_recommended: {
    label: '有传统·不推荐',
    className: 'text-orange-600 dark:text-orange-300',
  },
  not_recommended: {
    label: '常规熟食',
    className: 'text-slate-500 dark:text-slate-300',
  },
  forbidden: {
    label: '严禁生食',
    className: 'text-red-600 dark:text-red-300',
  },
};

function fishAttrs(species: SpeciesRecord): FishCategoryAttrs | null {
  return species.category === 'FI'
    ? (species.category_attrs as FishCategoryAttrs)
    : null;
}

function signatureTags(species: SpeciesRecord): string[] {
  const tags: string[] = [];
  for (const method of species.culinary.methods) {
    if (method.tier === 'signature' && !tags.includes(method.tag)) {
      tags.push(method.tag);
    }
  }
  return tags.slice(0, 2);
}

function taxonomyLabel(
  species: SpeciesRecord,
  taxonomyByCode: Record<string, TaxonomyNode>,
): string {
  const parts: string[] = [CATEGORY_LABELS[species.category]];
  const codes = species.taxon_codes;
  const extra = species.extra_attrs as Record<string, unknown>;
  const entries: Array<[string | undefined, string]> = [
    [codes?.order, 'order'],
    [codes?.family, 'family'],
    [codes?.genus, 'genus'],
  ];

  for (const [code, key] of entries) {
    const node = code ? taxonomyByCode[code] : undefined;
    const fallback = extra[key];
    const name =
      node?.name_zh ?? (typeof fallback === 'string' ? fallback : undefined);
    if (name && !parts.includes(name)) {
      parts.push(name);
    }
  }

  return parts.join(' · ');
}

export function SpeciesCard({
  species,
  month,
  matchSource,
  seasonNote,
}: SpeciesCardProps) {
  const { data } = useData();
  const selectedRegion = useAppStore((state) => state.selectedRegion);
  const compareIds = useAppStore((state) => state.compareIds);
  const toggleCompare = useAppStore((state) => state.toggleCompare);

  const regions = data?.regions;
  const unavailable = regions
    ? isSpeciesUnavailableInRegion(species, selectedRegion, regions)
    : false;
  const inSeason =
    regions && !unavailable
      ? isSpeciesInSeason(species, month, selectedRegion, regions, false)
      : false;

  const regionConfig =
    regions && selectedRegion !== 'global'
      ? regions.regions[selectedRegion]
      : undefined;
  const localAvailability =
    selectedRegion !== 'global' ? species.availability[selectedRegion] : undefined;
  const localPreservedNote =
    regionConfig &&
    localAvailability === 'rare_import' &&
    isPreservedYearRound(species, regionConfig.season_group) &&
    !isFreshYearRound(species, regionConfig.season_group)
      ? '全年冻品/制品'
      : null;

  const placesText = regions
    ? localPreservedNote ?? formatCommonPlaces(species, regions)
    : '—';
  const taxonomy = data
    ? taxonomyLabel(species, data.taxonomyByCode)
    : CATEGORY_LABELS[species.category];
  const cooking = signatureTags(species);
  const sashimi = species.sashimi.level ? SASHIMI_TEXT[species.sashimi.level] : null;
  const attrs = fishAttrs(species);

  const selected = compareIds.includes(species.id);
  const compareFull = !selected && compareIds.length >= 3;

  return (
    <article
      className={`hf-card group relative flex items-stretch justify-between gap-2 p-2.5 transition-all duration-200 ${
        unavailable
          ? 'opacity-60 saturate-[0.35] hover:opacity-85'
          : 'hover:-translate-y-0.5 hover:border-[#0B4F71]/25 hover:shadow-[0_24px_50px_-34px_rgba(11,79,113,0.55)] dark:hover:border-[#38BDF8]/30'
      }`}
    >
      <Link
        to={`/species/${species.id}`}
        aria-label={`查看 ${species.names.zh_formal} 详情`}
        className="flex min-w-0 flex-1 flex-col justify-between gap-1 outline-none"
      >
        <div className="min-w-0">
          <h3 className="line-clamp-1 text-[13px] font-semibold leading-snug tracking-tight text-[#0F172A] group-hover:text-[#0B4F71] dark:text-[#F1F5F9] dark:group-hover:text-[#38BDF8]">
            {species.names.zh_formal}
          </h3>
          <p className="mt-0.5 truncate text-[10px] leading-tight text-[#52667A] dark:text-[#94A3B8]">
            {species.names.en_standard}
          </p>

          <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 font-mono text-[10px] font-medium tabular-nums text-[#0B4F71]/80 dark:text-[#38BDF8]/80">
              {species.id}
            </span>
            <span
              title={taxonomy}
              className="min-w-0 flex-1 truncate text-[10px] leading-4 text-[#52667A] dark:text-[#94A3B8]"
            >
              {taxonomy}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <p className="truncate text-[10px] leading-4 text-[#52667A] dark:text-[#94A3B8]">
            <span className="text-[#94A3B8] dark:text-[#64748B]">常见地点</span>{' '}
            {placesText}
            {cooking.length > 0 ? (
              <>
                <span className="px-1 text-[#94A3B8] dark:text-[#64748B]">·</span>
                <span className="text-[#94A3B8] dark:text-[#64748B]">做法</span>{' '}
                {cooking.join(' / ')}
              </>
            ) : null}
            {sashimi ? (
              <>
                <span className="px-1 text-[#94A3B8] dark:text-[#64748B]">·</span>
                <span className="text-[#94A3B8] dark:text-[#64748B]">生食</span>{' '}
                <span className={`font-medium ${sashimi.className}`}>
                  {sashimi.label}
                </span>
              </>
            ) : null}
          </p>

          {matchSource ? (
            <p
              title={matchSource}
              className="mt-0.5 line-clamp-1 text-[9px] leading-4 text-[#0B4F71]/70 dark:text-[#38BDF8]/70"
            >
              {matchSource}
            </p>
          ) : seasonNote ? (
            <p className="mt-0.5 line-clamp-1 text-[9px] leading-4 text-[#52667A] dark:text-[#94A3B8]">
              {seasonNote}
            </p>
          ) : null}
        </div>
      </Link>

      <div className="flex shrink-0 flex-col items-end justify-between gap-1.5">
        {unavailable ? (
          <span className="inline-flex items-center whitespace-nowrap rounded-full border border-amber-200 bg-amber-50/95 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
            定位地区无分布
          </span>
        ) : inSeason ? (
          <span className="inline-flex items-center whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50/95 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
            当季
          </span>
        ) : (
          <span aria-hidden="true" className="h-4" />
        )}

        <Link
          to={`/species/${species.id}`}
          aria-label={`查看 ${species.names.zh_formal} 图片详情`}
          className="block"
        >
          <div
            data-testid="species-card-thumb"
            className="h-11 w-11 overflow-hidden rounded-xl border border-[#E2EBF0]/80 sm:h-12 sm:w-12 dark:border-[#1E354A]/80"
          >
            <SpeciesPlaceholderSvg
              category={species.category}
              fleshColor={attrs?.flesh_color_tag ?? null}
              cover={species.media.cover}
              alt={species.names.zh_formal}
              id={species.id}
              className="h-full w-full"
            />
          </div>
        </Link>

        <button
          type="button"
          aria-pressed={selected}
          disabled={compareFull}
          title={
            compareFull
              ? '对比队列已满（最多 3 种）'
              : selected
                ? '已加入对比'
                : '+ 对比'
          }
          onClick={() => toggleCompare(species.id)}
          className={`inline-flex h-6 items-center gap-0.5 rounded-full border px-2 text-[10px] font-semibold transition-colors ${
            selected
              ? 'border-[#0B4F71] bg-[#0B4F71] text-white dark:border-[#38BDF8] dark:bg-[#38BDF8] dark:text-[#07131F]'
              : compareFull
                ? 'cursor-not-allowed border-[#E2EBF0] bg-[#F6F9FB] text-[#94A3B8] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#52667A]'
                : 'border-[#E2EBF0] bg-white text-[#0B4F71] hover:border-[#0B4F71]/40 hover:bg-[#0B4F71]/5 dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#38BDF8] dark:hover:border-[#38BDF8]/40'
          }`}
        >
          {selected ? (
            <Check className="h-3 w-3" aria-hidden="true" />
          ) : (
            <>
              <Plus className="h-3 w-3" aria-hidden="true" />
              对比
            </>
          )}
        </button>
      </div>
    </article>
  );
}
