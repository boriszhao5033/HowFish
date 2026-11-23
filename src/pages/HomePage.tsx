import {
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Search,
  SearchX,
  Shuffle,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { FilterDrawer } from '../components/species/FilterDrawer';
import { SpeciesCard } from '../components/species/SpeciesCard';
import { useData } from '../context/DataContext';
import {
  buildHomeRankedFeed,
  countActiveFilterDimensions,
  filterSpecies,
  isSpeciesUnavailableInRegion,
  type HomeFilterState,
} from '../services/filters';
import { matchTrapsForQuery, searchSpecies } from '../services/searchEngine';
import { useAppStore } from '../store/useAppStore';
import {
  getRegionFlag,
  type CookingTag,
} from '../types/schema';

const PAN_GRILL_TAGS: CookingTag[] = [
  '干煎/香煎',
  '盐烤/炭烤',
  '照烧/酱烤',
  '重口烤鱼',
];
const STEAM_TAGS: CookingTag[] = ['清蒸', '白灼/水煮'];
const PAGE_SIZE = 10;

interface QuickScene {
  id: string;
  label: string;
  isActive: (filter: HomeFilterState) => boolean;
  patch: (filter: HomeFilterState) => Partial<HomeFilterState>;
}

function isSubset(selected: CookingTag[], required: CookingTag[]): boolean {
  return required.every((tag) => selected.includes(tag));
}

function toggleTags(selected: CookingTag[], tags: CookingTag[]): CookingTag[] {
  if (isSubset(selected, tags)) {
    return selected.filter((tag) => !tags.includes(tag));
  }
  const next = [...selected];
  for (const tag of tags) {
    if (!next.includes(tag)) {
      next.push(tag);
    }
  }
  return next;
}

const QUICK_SCENES: QuickScene[] = [
  {
    id: 'season',
    label: '🗓️ 当季正肥',
    isActive: (filter) => filter.onlyInSeason,
    patch: (filter) => ({ onlyInSeason: !filter.onlyInSeason }),
  },
  {
    id: 'sashimi',
    label: '🍣 刺身优选',
    isActive: (filter) => filter.sashimiLevels.includes('recommended'),
    patch: (filter) => ({
      sashimiLevels: filter.sashimiLevels.includes('recommended')
        ? filter.sashimiLevels.filter((level) => level !== 'recommended')
        : [...filter.sashimiLevels, 'recommended'],
    }),
  },
  {
    id: 'pinbone',
    label: '👶 无肌间刺',
    isActive: (filter) => filter.pinBoneLevels.includes('none'),
    patch: (filter) => ({
      pinBoneLevels: filter.pinBoneLevels.includes('none')
        ? filter.pinBoneLevels.filter((level) => level !== 'none')
        : [...filter.pinBoneLevels, 'none'],
    }),
  },
  {
    id: 'pan',
    label: '🔥 香煎/烤鱼',
    isActive: (filter) => isSubset(filter.cookingTags, PAN_GRILL_TAGS),
    patch: (filter) => ({
      cookingTags: toggleTags(filter.cookingTags, PAN_GRILL_TAGS),
    }),
  },
  {
    id: 'steam',
    label: '🍲 清蒸本味',
    isActive: (filter) => isSubset(filter.cookingTags, STEAM_TAGS),
    patch: (filter) => ({
      cookingTags: toggleTags(filter.cookingTags, STEAM_TAGS),
    }),
  },
  {
    id: 'safety',
    label: '⚠️ 有安全警示',
    isActive: (filter) => filter.onlyWithSafetyAlert,
    patch: (filter) => ({ onlyWithSafetyAlert: !filter.onlyWithSafetyAlert }),
  },
];

export function HomePage() {
  const { data, searchEngine, loading, error } = useData();
  const navigate = useNavigate();

  const query = useAppStore((state) => state.homeQuery);
  const setHomeQuery = useAppStore((state) => state.setHomeQuery);
  const filter = useAppStore((state) => state.homeFilter);
  const patchHomeFilter = useAppStore((state) => state.patchHomeFilter);
  const resetHomeFilter = useAppStore((state) => state.resetHomeFilter);
  const selectedRegion = useAppStore((state) => state.selectedRegion);
  const selectedCategory = useAppStore((state) => state.selectedCategory);
  const setCompareIds = useAppStore((state) => state.setCompareIds);
  const regionEpoch = useAppStore((state) => state.regionEpoch);
  const homeFeedSeed = useAppStore((state) => state.homeFeedSeed);
  const shuffleHomeFeed = useAppStore((state) => state.shuffleHomeFeed);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const month = useMemo(() => new Date().getMonth() + 1, []);

  const filtered = useMemo(() => {
    if (!data) {
      return [];
    }
    return filterSpecies(
      data.species,
      filter,
      selectedRegion,
      data.regions,
      month,
      selectedCategory,
    );
  }, [data, filter, selectedRegion, selectedCategory, month]);

  const hits = useMemo(() => {
    if (!data || !searchEngine) {
      return [];
    }
    return searchSpecies(searchEngine, query, filtered, data.regions);
  }, [data, searchEngine, query, filtered]);

  const matchedTrap = useMemo(() => {
    if (!data) {
      return null;
    }
    return matchTrapsForQuery(query, data.traps)[0] ?? null;
  }, [data, query]);

  const trapSpecies = useMemo(() => {
    if (!data || !matchedTrap) {
      return [];
    }
    return matchedTrap.species_ids
      .map((id) => data.speciesById[id])
      .filter((item) => item !== undefined);
  }, [data, matchedTrap]);

  const activeDimensions = countActiveFilterDimensions(filter);
  const defaultMode = query.trim() === '' && activeDimensions === 0;

  const homeFeed = useMemo(() => {
    if (!data || !defaultMode) {
      return [];
    }
    return buildHomeRankedFeed(
      filtered,
      selectedRegion,
      data.regions,
      month,
      homeFeedSeed,
    );
  }, [data, defaultMode, filtered, selectedRegion, month, homeFeedSeed]);

  const orderedHits = useMemo(() => {
    if (!data || selectedRegion === 'global') {
      return hits;
    }
    return [...hits].sort((a, b) => {
      const aUnavailable = isSpeciesUnavailableInRegion(
        a.item,
        selectedRegion,
        data.regions,
      );
      const bUnavailable = isSpeciesUnavailableInRegion(
        b.item,
        selectedRegion,
        data.regions,
      );
      return Number(aUnavailable) - Number(bUnavailable);
    });
  }, [data, hits, selectedRegion]);

  const visibleHome = homeFeed.slice(0, visibleCount);
  const resultCount = defaultMode ? homeFeed.length : hits.length;
  const hasMoreHome = defaultMode && visibleCount < homeFeed.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [regionEpoch, homeFeedSeed, selectedCategory, query, filter]);

  useEffect(() => {
    if (!hasMoreHome) {
      return;
    }
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((current) =>
            Math.min(current + PAGE_SIZE, homeFeed.length),
          );
        }
      },
      { rootMargin: '240px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreHome, visibleCount, homeFeed.length]);

  const regionLabel =
    selectedRegion === 'global'
      ? '全球'
      : data?.regions.regions[selectedRegion]?.label ?? selectedRegion;

  const enterTrapCompare = () => {
    if (trapSpecies.length < 2) {
      return;
    }
    const ids = trapSpecies.slice(0, 3).map((item) => item.id);
    setCompareIds(ids);
    navigate(`/compare?ids=${ids.join(',')}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <section className="relative overflow-hidden rounded-3xl border border-[#E2EBF0] bg-white/90 p-4 shadow-[0_26px_60px_-46px_rgba(11,79,113,0.55)] dark:border-[#1E354A] dark:bg-[#102030]/90 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-[#38BDF8]/20 to-[#0E86A8]/5 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-gradient-to-tr from-[#0B4F71]/10 to-transparent blur-2xl dark:from-[#38BDF8]/10"
        />

        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#0E86A8] dark:text-[#22D3EE]">
            HowFish · 离线海产速查
          </p>
          <h1 className="mt-2 max-w-2xl text-[26px] font-semibold leading-8 tracking-tight text-[#0F172A] dark:text-[#F1F5F9] sm:text-[32px] sm:leading-10">
            5 秒认鱼，
            <span className="text-[#0B4F71] dark:text-[#38BDF8]">不被撞名坑</span>
          </h1>
          <p className="mt-2 max-w-xl text-xs leading-5 text-[#52667A] dark:text-[#94A3B8] sm:text-sm sm:leading-6">
            中文俗名、英文、拼音与招牌名菜全维秒搜；刺身安全、时令肥美、肌间刺与烹饪绝配一屏看懂。
          </p>

          <div className="relative mt-4">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#52667A] dark:text-[#94A3B8]"
            />
            <input
              type="text"
              value={query}
              onChange={(event) => setHomeQuery(event.target.value)}
              placeholder="搜中文俗名、英文、拼音或招牌名菜…"
              aria-label="搜索海产"
              autoComplete="off"
              spellCheck={false}
              className="hf-input h-12 pl-10 pr-11 shadow-[0_10px_30px_-26px_rgba(11,79,113,0.8)] sm:h-[3.25rem]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setHomeQuery('')}
                aria-label="清空搜索"
                className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#52667A] transition-colors hover:bg-[#0B4F71]/10 hover:text-[#0B4F71] dark:text-[#94A3B8] dark:hover:bg-[#38BDF8]/10 dark:hover:text-[#38BDF8]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {matchedTrap ? (
            <div
              key={matchedTrap.trap_index ?? matchedTrap.title}
              role="status"
              aria-live="polite"
              className="hf-trap-in mt-3 overflow-hidden rounded-2xl border border-red-200/80 bg-gradient-to-r from-red-50 via-amber-50 to-amber-50 p-3 dark:border-red-500/30 dark:from-red-500/10 dark:via-amber-500/10 dark:to-amber-500/5"
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-red-800 dark:text-red-200">
                    撞名防坑：{matchedTrap.title}
                  </p>
                  <p className="mt-1 line-clamp-3 text-[11px] leading-5 text-[#52667A] dark:text-[#CBD5E1]">
                    {matchedTrap.truth}
                  </p>
                  {matchedTrap.tips ? (
                    <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-red-700/80 dark:text-red-200/70">
                      {matchedTrap.tips}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={trapSpecies.length < 2}
                  onClick={enterTrapCompare}
                  title={
                    trapSpecies.length < 2
                      ? '当前离线数据缺少完整对照样本'
                      : '加入对比并进入同屏比对'
                  }
                  className="mt-0.5 hidden shrink-0 items-center gap-1 rounded-full bg-[#0B4F71] px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#38BDF8] dark:text-[#07131F] sm:inline-flex"
                >
                  一键进入真身 VS 对比
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                disabled={trapSpecies.length < 2}
                onClick={enterTrapCompare}
                className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1 rounded-xl bg-[#0B4F71] text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#38BDF8] dark:text-[#07131F] sm:hidden"
              >
                一键进入真身 VS 对比
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <div className="mt-3 flex items-center gap-2 sm:mt-4">
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto py-0.5">
          {QUICK_SCENES.map((scene) => {
            const active = scene.isActive(filter);
            return (
              <button
                key={scene.id}
                type="button"
                aria-pressed={active}
                onClick={() => patchHomeFilter(scene.patch(filter))}
                className={`hf-chip shrink-0 whitespace-nowrap ${active ? 'hf-chip-active' : ''}`}
              >
                {scene.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#E2EBF0] bg-white px-3 text-xs font-semibold text-[#0B4F71] shadow-sm transition-colors hover:border-[#0B4F71]/30 dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#38BDF8] dark:hover:border-[#38BDF8]/40"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          筛选
          {activeDimensions > 0 ? (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0B4F71] px-1 text-[9px] font-semibold text-white tabular-nums dark:bg-[#38BDF8] dark:text-[#07131F]">
              {activeDimensions}
            </span>
          ) : null}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[#0F172A] dark:text-[#F1F5F9]">
            {query.trim() ? '搜索结果' : defaultMode ? '为你推荐' : '筛选结果'}
            <span className="ml-2 text-xs font-normal text-[#52667A] dark:text-[#94A3B8]">
              当前 {month} 月 · {getRegionFlag(selectedRegion)} {regionLabel}
            </span>
          </h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[#52667A] dark:text-[#94A3B8]">
            <span>
              共 <span className="tabular-nums">{resultCount}</span> 种
              {activeDimensions > 0 ? ` · ${activeDimensions} 项筛选生效` : ''}
            </span>
            {defaultMode ? (
              <button
                type="button"
                onClick={shuffleHomeFeed}
                className="inline-flex items-center gap-1 rounded-full border border-[#E2EBF0] bg-white/80 px-2 py-0.5 text-[10px] font-medium text-[#0B4F71] transition-colors hover:border-[#0B4F71]/30 dark:border-[#1E354A] dark:bg-[#102030]/80 dark:text-[#38BDF8]"
              >
                <Shuffle className="h-3 w-3" aria-hidden="true" />
                换一批
              </button>
            ) : null}
          </div>
        </div>
        {activeDimensions > 0 ? (
          <button
            type="button"
            onClick={resetHomeFilter}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-[#52667A] transition-colors hover:bg-[#0B4F71]/5 hover:text-[#0B4F71] dark:text-[#94A3B8] dark:hover:bg-[#38BDF8]/10 dark:hover:text-[#38BDF8]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            清除筛选
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3.5">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="hf-card h-56 animate-pulse bg-white/60 dark:bg-[#102030]/60"
            />
          ))}
        </div>
      ) : error ? (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <p className="font-semibold">数据加载失败</p>
          <p className="mt-1 text-xs leading-5">{error}</p>
        </div>
      ) : resultCount === 0 ? (
        <div className="mt-3 flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#E2EBF0] bg-white/60 px-5 py-14 text-center dark:border-[#1E354A] dark:bg-[#102030]/50">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0B4F71]/5 text-[#0B4F71] dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
            <SearchX className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
            没有找到匹配的海产
          </p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-[#52667A] dark:text-[#94A3B8]">
            试试中文正式名、江浙沪/澳洲俗称、拼音全拼或首字母，或放宽筛选条件。
          </p>
          <button
            type="button"
            onClick={() => {
              setHomeQuery('');
              resetHomeFilter();
            }}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0B4F71] px-4 text-xs font-semibold text-white dark:bg-[#38BDF8] dark:text-[#07131F]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            重置搜索与筛选
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3.5">
            {defaultMode
              ? visibleHome.map((item) => (
                  <SpeciesCard key={item.id} species={item} month={month} />
                ))
              : orderedHits.map((hit) => (
                  <SpeciesCard
                    key={hit.item.id}
                    species={hit.item}
                    month={month}
                    matchSource={hit.matchSource}
                  />
                ))}
          </div>

          {hasMoreHome ? (
            <div
              ref={sentinelRef}
              className="mt-4 flex flex-col items-center gap-2"
            >
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((current) =>
                    Math.min(current + PAGE_SIZE, homeFeed.length),
                  )
                }
                className="inline-flex h-9 items-center justify-center rounded-full border border-[#E2EBF0] bg-white px-5 text-xs font-semibold text-[#0B4F71] transition-colors hover:border-[#0B4F71]/30 dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#38BDF8]"
              >
                加载更多
              </button>
              <p className="text-[10px] text-[#94A3B8]">
                向下滚动自动加载 · 已展示 {visibleHome.length} / {homeFeed.length}
              </p>
            </div>
          ) : null}
        </>
      )}

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        resultCount={resultCount}
      />
    </div>
  );
}