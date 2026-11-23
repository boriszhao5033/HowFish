import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Dices,
  Fish,
  Flame,
  LayoutGrid,
  MapPin,
  Plus,
  Snowflake,
  Soup,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { SashimiBadge } from '../components/common/SashimiBadge';
import { SpeciesPlaceholderSvg } from '../components/common/SpeciesPlaceholderSvg';
import { SpeciesCard } from '../components/species/SpeciesCard';
import { useData } from '../context/DataContext';
import {
  buildRafflePool,
  isFreshInSeasonForGroup,
  isFreshYearRound,
  isPreservedYearRound,
  isSpeciesUnavailableInRegion,
  pickWeightedRaffleSpecies,
  type RaffleEntry,
} from '../services/filters';
import { useAppStore } from '../store/useAppStore';
import {
  getRegionFlag,
  type CookingTag,
  type FishCategoryAttrs,
  type Hemisphere,
  type SpeciesRecord,
} from '../types/schema';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const ROLL_STEP_MS = 60;
const ROLL_TICKS = 10;

const PAN_GRILL_TAGS: readonly CookingTag[] = [
  '干煎/香煎',
  '盐烤/炭烤',
  '照烧/酱烤',
  '重口烤鱼',
  '油炸/酥炸',
];
const STEAM_TAGS: readonly CookingTag[] = ['清蒸', '白灼/水煮'];
const BRAISE_TAGS: readonly CookingTag[] = [
  '红烧/酱焖',
  '酱油水/豆酱焖',
  '炖汤/煲粥',
  '酸菜/水煮辣味',
];

const RAFFLE_REASON_LABELS: Record<RaffleEntry['reason'], string> = {
  fresh_season: '本月鲜食当季',
  fresh_year_round: '全年稳定鲜食',
  preserved_year_round: '全年冻品/制品供应',
};

type SceneId = 'all' | 'sashimi' | 'grill' | 'steam';

const SCENES: { id: SceneId; label: string; icon: LucideIcon }[] = [
  { id: 'all', label: '全部当季', icon: LayoutGrid },
  { id: 'sashimi', label: '刺身适宜', icon: Fish },
  { id: 'grill', label: '煎烤爆油', icon: Flame },
  { id: 'steam', label: '清蒸本味', icon: Soup },
];

interface DicePrefs {
  pinboneFree: boolean;
  sashimi: boolean;
  steam: boolean;
  grill: boolean;
  braise: boolean;
  cheap: boolean;
}

const DEFAULT_PREFS: DicePrefs = {
  pinboneFree: false,
  sashimi: false,
  steam: false,
  grill: false,
  braise: false,
  cheap: false,
};

interface DicePrefMeta {
  key: keyof DicePrefs;
  label: string;
}

const DICE_PREF_META: DicePrefMeta[] = [
  { key: 'pinboneFree', label: '无肌间刺' },
  { key: 'sashimi', label: '想吃刺身' },
  { key: 'steam', label: '清蒸本味' },
  { key: 'grill', label: '香煎/烤鱼' },
  { key: 'braise', label: '红烧/炖汤' },
  { key: 'cheap', label: '平价 ($–$$)' },
];

interface SeasonGroupView {
  key: string;
  label: string;
  hemisphere: Hemisphere;
  regionKey: string | null;
}

function fishAttrs(species: SpeciesRecord): FishCategoryAttrs | null {
  return species.category === 'FI'
    ? (species.category_attrs as FishCategoryAttrs)
    : null;
}

function stripParens(label: string): string {
  const stripped = label.replace(/[（(][^）)]*[）)]/g, '').trim();
  return stripped || label;
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

function hasAnyMethod(
  species: SpeciesRecord,
  tags: readonly CookingTag[],
): boolean {
  return species.culinary.methods.some((method) => tags.includes(method.tag));
}

function isPinBoneFree(species: SpeciesRecord): boolean {
  if (species.category !== 'FI') {
    return true;
  }
  return (fishAttrs(species)?.pin_bone_level ?? null) === 'none';
}

function isCheap(species: SpeciesRecord, priceGroup: string | null): boolean {
  if (priceGroup) {
    const tier = species.buying_guide.price_tier[priceGroup];
    return tier === '$' || tier === '$$';
  }
  return Object.values(species.buying_guide.price_tier).some(
    (tier) => tier === '$' || tier === '$$',
  );
}

function noteForGroup(species: SpeciesRecord, groupKey: string | null): string {
  if (groupKey) {
    return species.seasonality.by_group[groupKey]?.note ?? '';
  }
  for (const group of Object.values(species.seasonality.by_group)) {
    if (group.note) {
      return group.note;
    }
  }
  return '';
}

function noteForMonth(species: SpeciesRecord, month: number): string {
  for (const group of Object.values(species.seasonality.by_group)) {
    if (group.months.includes(month)) {
      return group.note;
    }
  }
  return noteForGroup(species, null);
}

function seasonalNote(species: SpeciesRecord, groupKey: string): string {
  const note = noteForGroup(species, groupKey);
  const preservedOnly =
    isPreservedYearRound(species, groupKey) &&
    !isFreshYearRound(species, groupKey);
  if (!preservedOnly) {
    return note;
  }
  return note ? `${note} · 全年冻品/制品` : '全年冻品/制品';
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-[11px] font-medium text-[#52667A] dark:text-[#94A3B8]"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked
            ? 'bg-[#0B4F71] dark:bg-[#38BDF8]'
            : 'bg-[#C9D9E2] dark:bg-[#1E354A]'
        }`}
      >
        <span
          className={`absolute h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[1.15rem]' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span>{label}</span>
    </button>
  );
}

function matchesScene(species: SpeciesRecord, scene: SceneId): boolean {
  if (scene === 'all') {
    return true;
  }
  if (scene === 'sashimi') {
    return (
      species.sashimi.level === 'recommended' ||
      species.sashimi.level === 'conditional'
    );
  }
  if (scene === 'grill') {
    const fat = fishAttrs(species)?.fat_level ?? null;
    return (
      (typeof fat === 'number' && fat >= 7) ||
      hasAnyMethod(species, PAN_GRILL_TAGS)
    );
  }
  return hasAnyMethod(species, STEAM_TAGS);
}
function sortSeasonalRecords(
  records: SpeciesRecord[],
  groupKey: string,
  month: number,
): SpeciesRecord[] {
  return [...records].sort((a, b) => {
    const aStrict = isFreshInSeasonForGroup(a, groupKey, month) ? 0 : 1;
    const bStrict = isFreshInSeasonForGroup(b, groupKey, month) ? 0 : 1;
    if (aStrict !== bStrict) {
      return aStrict - bStrict;
    }
    return a.id.localeCompare(b.id);
  });
}

export function SeasonalPage() {
  const { data, loading, error } = useData();
  const selectedRegion = useAppStore((state) => state.selectedRegion);
  const setSelectedRegion = useAppStore((state) => state.setSelectedRegion);
  const compareIds = useAppStore((state) => state.compareIds);
  const toggleCompare = useAppStore((state) => state.toggleCompare);
  const regionEpoch = useAppStore((state) => state.regionEpoch);

  const systemMonth = useMemo(() => new Date().getMonth() + 1, []);
  const [month, setMonth] = useState(systemMonth);
  const [includeFreshYearRound, setIncludeFreshYearRound] = useState(false);
  const [scene, setScene] = useState<SceneId>('all');
  const [onlyInSeason, setOnlyInSeason] = useState(true);
  const [prefs, setPrefs] = useState<DicePrefs>(DEFAULT_PREFS);

  const [rolling, setRolling] = useState(false);
  const [rollingSpecies, setRollingSpecies] = useState<SpeciesRecord | null>(null);
  const [drawn, setDrawn] = useState<SpeciesRecord | null>(null);
  const [drawnIds, setDrawnIds] = useState<string[]>([]);
  const rollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (rollTimerRef.current !== null) {
      window.clearInterval(rollTimerRef.current);
      rollTimerRef.current = null;
    }
    setRolling(false);
    setRollingSpecies(null);
    setDrawn(null);
    setDrawnIds([]);
  }, [regionEpoch]);

  useEffect(() => {
    return () => {
      if (rollTimerRef.current !== null) {
        window.clearInterval(rollTimerRef.current);
      }
    };
  }, []);

  const seasonGroups = useMemo<SeasonGroupView[]>(() => {
    if (!data) {
      return [];
    }
    return Object.entries(data.regions.season_groups).map(([key, config]) => {
      const match = Object.entries(data.regions.regions).find(
        ([, region]) => region.enabled && region.season_group === key,
      );
      return {
        key,
        label: config.label,
        hemisphere: config.hemisphere,
        regionKey: match?.[0] ?? null,
      };
    });
  }, [data]);

  const regionConfig =
    data && selectedRegion !== 'global'
      ? data.regions.regions[selectedRegion] ?? null
      : null;
  const selectedGroupKey = regionConfig?.season_group ?? null;
  const priceGroup = regionConfig?.price_group ?? null;
  const regionLabel = regionConfig?.label ?? selectedRegion;

  const globalGroups = useMemo(() => {
    if (!data) {
      return [];
    }
    return seasonGroups.map((group) => ({
      ...group,
      records: sortSeasonalRecords(
        data.species.filter(
          (record) =>
            (isFreshInSeasonForGroup(record, group.key, month) ||
              (includeFreshYearRound && isFreshYearRound(record, group.key))) &&
            matchesScene(record, scene),
        ),
        group.key,
        month,
      ),
    }));
  }, [data, seasonGroups, month, includeFreshYearRound, scene]);

  const localAvailableRecords = useMemo(() => {
    if (!data || !selectedGroupKey) {
      return [];
    }
    return data.species.filter(
      (record) =>
        !isSpeciesUnavailableInRegion(record, selectedRegion, data.regions),
    );
  }, [data, selectedGroupKey, selectedRegion]);

  const localStrictRecords = useMemo(() => {
    if (!selectedGroupKey) {
      return [];
    }
    return sortSeasonalRecords(
      localAvailableRecords.filter(
        (record) =>
          isFreshInSeasonForGroup(record, selectedGroupKey, month) &&
          matchesScene(record, scene),
      ),
      selectedGroupKey,
      month,
    );
  }, [localAvailableRecords, selectedGroupKey, month, scene]);

  const localRecords = useMemo(() => {
    if (!selectedGroupKey) {
      return [];
    }
    return sortSeasonalRecords(
      localAvailableRecords.filter(
        (record) =>
          (isFreshInSeasonForGroup(record, selectedGroupKey, month) ||
            (includeFreshYearRound &&
              isFreshYearRound(record, selectedGroupKey))) &&
          matchesScene(record, scene),
      ),
      selectedGroupKey,
      month,
    );
  }, [
    localAvailableRecords,
    selectedGroupKey,
    month,
    includeFreshYearRound,
    scene,
  ]);

  const localYearRoundOnlyCount = useMemo(() => {
    if (!selectedGroupKey) {
      return 0;
    }
    return localAvailableRecords.filter(
      (record) =>
        isFreshYearRound(record, selectedGroupKey) &&
        !isFreshInSeasonForGroup(record, selectedGroupKey, month) &&
        matchesScene(record, scene),
    ).length;
  }, [localAvailableRecords, selectedGroupKey, month, scene]);

  const otherRegionRecords = useMemo(() => {
    if (!data || !selectedGroupKey) {
      return [];
    }
    const otherGroupKeys = seasonGroups
      .map((group) => group.key)
      .filter((key) => key !== selectedGroupKey);
    return data.species
      .filter((record) => {
        if (record.availability[selectedRegion] !== 'none') {
          return false;
        }
        return (
          otherGroupKeys.some((key) =>
            isFreshInSeasonForGroup(record, key, month),
          ) && matchesScene(record, scene)
        );
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [data, selectedGroupKey, selectedRegion, seasonGroups, month, scene]);

  const rafflePool = useMemo(() => {
    if (!data) {
      return [];
    }
    return buildRafflePool(
      data.species,
      selectedRegion,
      data.regions,
      month,
      { onlyInSeason },
    ).filter(({ species }) => {
      if (prefs.pinboneFree && !isPinBoneFree(species)) {
        return false;
      }
      if (
        prefs.sashimi &&
        species.sashimi.level !== 'recommended' &&
        species.sashimi.level !== 'conditional'
      ) {
        return false;
      }
      if (prefs.steam && !hasAnyMethod(species, STEAM_TAGS)) {
        return false;
      }
      if (prefs.grill) {
        const fat = fishAttrs(species)?.fat_level ?? null;
        const fatty = typeof fat === 'number' && fat >= 7;
        if (!fatty && !hasAnyMethod(species, PAN_GRILL_TAGS)) {
          return false;
        }
      }
      if (prefs.braise && !hasAnyMethod(species, BRAISE_TAGS)) {
        return false;
      }
      if (prefs.cheap && !isCheap(species, priceGroup)) {
        return false;
      }
      return true;
    });
  }, [data, selectedRegion, month, onlyInSeason, prefs, priceGroup]);

  const draw = useCallback(() => {
    if (rafflePool.length === 0 || rolling) {
      return;
    }
    if (rollTimerRef.current !== null) {
      window.clearInterval(rollTimerRef.current);
      rollTimerRef.current = null;
    }

    setDrawn(null);
    setRolling(true);
    setRollingSpecies(pickWeightedRaffleSpecies(rafflePool));

    let tick = 0;
    rollTimerRef.current = window.setInterval(() => {
      setRollingSpecies(pickWeightedRaffleSpecies(rafflePool));
      tick += 1;
      if (tick >= ROLL_TICKS) {
        if (rollTimerRef.current !== null) {
          window.clearInterval(rollTimerRef.current);
          rollTimerRef.current = null;
        }
        setRollingSpecies(null);
        setRolling(false);
        const picked =
          pickWeightedRaffleSpecies(rafflePool, drawnIds) ??
          pickWeightedRaffleSpecies(rafflePool, []);
        if (picked) {
          setDrawn(picked);
          setDrawnIds((previous) =>
            previous.includes(picked.id)
              ? [picked.id]
              : [...previous, picked.id],
          );
        }
      }
    }, ROLL_STEP_MS);
  }, [drawnIds, rafflePool, rolling]);

  const togglePref = (key: keyof DicePrefs) => {
    setPrefs((current) => ({ ...current, [key]: !current[key] }));
  };

  const activePrefCount = Object.values(prefs).filter(Boolean).length;

  const drawnNote = useMemo(() => {
    if (!drawn) {
      return '';
    }
    if (selectedGroupKey) {
      return noteForGroup(drawn, selectedGroupKey);
    }
    const matchingGroup = Object.entries(drawn.seasonality.by_group).find(
      ([, group]) => group.months.includes(month),
    );
    return matchingGroup?.[1].note || noteForGroup(drawn, null);
  }, [drawn, month, selectedGroupKey]);

  const drawnEntry = drawn
    ? rafflePool.find((entry) => entry.species.id === drawn.id) ?? null
    : null;
  const drawnMethods = drawn ? signatureTags(drawn).slice(0, 3) : [];
  const drawnSelected = drawn ? compareIds.includes(drawn.id) : false;
  const drawnCompareFull = drawn ? !drawnSelected && compareIds.length >= 3 : false;
  const previewRecord = rollingSpecies ?? drawn;
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div className="h-40 animate-pulse rounded-3xl bg-white/60 dark:bg-[#102030]/60" />
        <div className="mt-3 h-72 animate-pulse rounded-3xl bg-white/50 dark:bg-[#102030]/50" />
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3.5">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="hf-card h-56 animate-pulse bg-white/60 dark:bg-[#102030]/60"
            />
          ))}
        </div>
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
      <section className="rounded-3xl border border-[#E2EBF0] bg-white/90 p-4 shadow-[0_18px_40px_-32px_rgba(11,79,113,0.45)] dark:border-[#1E354A] dark:bg-[#102030]/90 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#0E86A8] dark:text-[#22D3EE]">
              HowFish · 当季推荐
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-tight text-[#0F172A] dark:text-[#F1F5F9] sm:text-2xl">
              <CalendarDays
                className="h-5 w-5 text-[#0B4F71] dark:text-[#38BDF8]"
                aria-hidden="true"
              />
              当季肥美与今天吃什么
            </h1>
            <p className="mt-1 text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8] sm:text-xs">
              自动读取设备系统月份，支持预览 1–12 月全年时令变化。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[#0B4F71]/20 bg-[#0B4F71]/[0.06] px-3 py-1 text-[11px] font-semibold text-[#0B4F71] tabular-nums dark:border-[#38BDF8]/25 dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
              当前 {systemMonth} 月
            </span>
            {month !== systemMonth ? (
              <button
                type="button"
                onClick={() => setMonth(systemMonth)}
                className="inline-flex h-7 items-center rounded-full border border-[#E2EBF0] bg-white px-3 text-[11px] font-semibold text-[#52667A] transition-colors hover:border-[#0B4F71]/30 hover:text-[#0B4F71] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#94A3B8] dark:hover:text-[#38BDF8]"
              >
                回到本月
              </button>
            ) : null}
          </div>
        </div>

        <div className="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 py-0.5">
          {MONTHS.map((value) => {
            const active = value === month;
            const isSystem = value === systemMonth;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setMonth(value)}
                className={`relative flex h-9 min-w-[2.6rem] shrink-0 items-center justify-center rounded-full border px-2 text-xs font-semibold tabular-nums transition-colors ${
                  active
                    ? 'border-[#0B4F71] bg-[#0B4F71] text-white dark:border-[#38BDF8] dark:bg-[#38BDF8] dark:text-[#07131F]'
                    : 'border-[#E2EBF0] bg-white text-[#52667A] hover:border-[#0B4F71]/30 hover:text-[#0B4F71] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#94A3B8] dark:hover:text-[#38BDF8]'
                }`}
              >
                {value}月
                {isSystem && !active ? (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[#0E86A8] dark:bg-[#22D3EE]"
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-[#52667A] dark:text-[#94A3B8]">
            预览 <span className="font-semibold tabular-nums">{month}</span> 月 ·
            左右滑动刻度条查看全年
          </p>
        </div>

        <div
          className="mt-2 flex flex-wrap items-center gap-1.5"
          aria-label="当季筛选"
        >
          {SCENES.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={scene === item.id}
                onClick={() => setScene(item.id)}
                className={`hf-chip shrink-0 whitespace-nowrap ${
                  scene === item.id ? 'hf-chip-active' : ''
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
          <span
            aria-hidden="true"
            className="hidden h-4 w-px bg-[#C9D9E2] dark:bg-[#1E354A] sm:block"
          />
          <button
            type="button"
            aria-pressed={includeFreshYearRound}
            onClick={() => setIncludeFreshYearRound((current) => !current)}
            className={`hf-chip shrink-0 whitespace-nowrap ${
              includeFreshYearRound ? 'hf-chip-active' : ''
            }`}
          >
            <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />
            含全年稳定鲜食
          </button>
          {!includeFreshYearRound &&
          selectedGroupKey &&
          localStrictRecords.length === 0 &&
          localYearRoundOnlyCount > 0 ? (
            <button
              type="button"
              onClick={() => setIncludeFreshYearRound(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:border-emerald-400 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              展开 {localYearRoundOnlyCount} 种全年稳定鲜食
            </button>
          ) : null}
        </div>
      </section>

      <section className="relative mt-3 overflow-hidden rounded-3xl border border-[#CDE7F2] bg-gradient-to-br from-[#EAF6FB] via-white to-[#E7F2F8] p-4 shadow-[0_24px_60px_-46px_rgba(11,79,113,0.55)] dark:border-[#1E4A5E] dark:from-[#0D2A3A] dark:via-[#0B1F2D] dark:to-[#0B2B36] sm:p-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-[#38BDF8]/25 to-[#0E86A8]/5 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-gradient-to-tr from-[#0B4F71]/10 to-transparent blur-2xl dark:from-[#38BDF8]/10"
        />

        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#0E86A8] dark:text-[#22D3EE]">
                灵感抽取
              </p>
              <h2 className="mt-1 flex items-center gap-1.5 text-lg font-semibold tracking-tight text-[#0F172A] dark:text-[#F1F5F9]">
                <Sparkles
                  className="h-4 w-4 text-[#0E86A8] dark:text-[#22D3EE]"
                  aria-hidden="true"
                />
                🎲 今天吃什么
              </h2>
              <p className="mt-0.5 text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8]">
                按本月鲜食、全年鲜食与冻品权重抽取；本地无分布与无供应物种不进池。
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-[#0B4F71]/15 bg-white/70 px-3 py-1 text-[11px] font-semibold text-[#0B4F71] tabular-nums backdrop-blur dark:border-[#38BDF8]/20 dark:bg-[#07131F]/50 dark:text-[#38BDF8]">
              候选池：{rafflePool.length} 种
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <Switch
              checked={onlyInSeason}
              onChange={setOnlyInSeason}
              label="仅限本月当季"
            />
            <span
              aria-hidden="true"
              className="hidden h-4 w-px bg-[#C9D9E2] dark:bg-[#1E354A] sm:block"
            />
            {DICE_PREF_META.map((meta) => {
              const active = prefs[meta.key];
              return (
                <button
                  key={meta.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => togglePref(meta.key)}
                  className={`hf-chip shrink-0 whitespace-nowrap ${
                    active ? 'hf-chip-active' : ''
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
            {activePrefCount > 0 ? (
              <button
                type="button"
                onClick={() => setPrefs(DEFAULT_PREFS)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium text-[#52667A] transition-colors hover:bg-[#0B4F71]/5 hover:text-[#0B4F71] dark:text-[#94A3B8] dark:hover:text-[#38BDF8]"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                清除偏好
              </button>
            ) : null}
          </div>

          <p className="mt-1.5 text-[10px] leading-4 text-[#52667A] dark:text-[#94A3B8]">
            权重：本月鲜食 3.0 · 全年鲜食 1.5 · 冻品/制品 0.5（进口冻品 0.3，需关闭「仅限本月当季」）
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-stretch">
            <div
              aria-live="polite"
              className="min-h-[8.5rem] rounded-2xl border border-white/70 bg-white/85 p-3 backdrop-blur transition-all dark:border-white/10 dark:bg-[#07131F]/55"
            >
              {previewRecord ? (
                <div
                  className={`transition-all duration-150 ${
                    rolling ? 'scale-[0.995] opacity-80 blur-[0.3px]' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <SpeciesPlaceholderSvg
                      category={previewRecord.category}
                      fleshColor={
                        fishAttrs(previewRecord)?.flesh_color_tag ?? null
                      }
                      cover={previewRecord.media.cover}
                      alt={previewRecord.names.zh_formal}
                      id={previewRecord.id}
                      className="h-14 w-14 shrink-0 rounded-2xl border border-[#E2EBF0]/80 dark:border-[#1E354A]/80"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0E86A8] dark:text-[#22D3EE]">
                        {rolling ? '滚轮抽取中…' : '海风选中了'}
                      </p>
                      <h3 className="mt-0.5 line-clamp-2 text-base font-semibold leading-6 text-[#0F172A] dark:text-[#F1F5F9]">
                        {previewRecord.names.zh_formal}
                      </h3>
                      <p className="line-clamp-1 text-[11px] text-[#52667A] dark:text-[#94A3B8]">
                        {previewRecord.names.en_standard}
                      </p>
                      {!rolling ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <SashimiBadge level={previewRecord.sashimi.level} compact />
                          {drawnEntry ? (
                            <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                              {RAFFLE_REASON_LABELS[drawnEntry.reason]}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {!rolling && drawn ? (
                    <>
                      {drawnNote ? (
                        <p className="mt-2 rounded-xl border border-emerald-200/70 bg-emerald-50/80 px-2.5 py-2 text-[11px] leading-[1.55] text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
                          <span className="mr-1 font-semibold">当季理由 · </span>
                          {drawnNote}
                        </p>
                      ) : null}
                      {drawnMethods.length > 0 ? (
                        <p className="mt-1.5 line-clamp-1 text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                          招牌做法 · {drawnMethods.join(' / ')}
                        </p>
                      ) : null}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={draw}
                          className="inline-flex h-8 items-center gap-1 rounded-full border border-[#0B4F71]/25 bg-white px-3 text-[11px] font-semibold text-[#0B4F71] transition-colors hover:border-[#0B4F71]/45 dark:border-[#38BDF8]/30 dark:bg-[#0B1824] dark:text-[#38BDF8]"
                        >
                          <Dices className="h-3.5 w-3.5" aria-hidden="true" />
                          换一条
                        </button>
                        <Link
                          to={`/species/${drawn.id}`}
                          className="inline-flex h-8 items-center gap-1 rounded-full bg-[#0B4F71] px-3 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 dark:bg-[#38BDF8] dark:text-[#07131F]"
                        >
                          看详情
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          aria-pressed={drawnSelected}
                          disabled={drawnCompareFull}
                          onClick={() => toggleCompare(drawn.id)}
                          className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[11px] font-semibold transition-colors ${
                            drawnSelected
                              ? 'border-[#0B4F71] bg-[#0B4F71] text-white dark:border-[#38BDF8] dark:bg-[#38BDF8] dark:text-[#07131F]'
                              : drawnCompareFull
                                ? 'cursor-not-allowed border-[#E2EBF0] bg-[#F6F9FB] text-[#94A3B8] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#52667A]'
                                : 'border-[#E2EBF0] bg-white text-[#0B4F71] hover:border-[#0B4F71]/40 dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#38BDF8]'
                          }`}
                        >
                          {drawnSelected ? (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {drawnSelected ? '已加入对比' : '对比'}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : (
                <div className="flex h-full min-h-[6.5rem] flex-col items-center justify-center text-center">
                  <Dices
                    className="h-6 w-6 text-[#0B4F71] dark:text-[#38BDF8]"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                    让海风决定今晚的餐桌
                  </p>
                  <p className="mt-1 max-w-xs text-[11px] leading-5 text-[#52667A] dark:text-[#94A3B8]">
                    {rafflePool.length > 0
                      ? '点击右侧按钮开始约 600ms 的滚轮抽取。'
                      : '当前条件下候选池为空，试试放宽偏好或关闭当季限定。'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex md:flex-col md:justify-center">
              <button
                type="button"
                onClick={draw}
                disabled={rafflePool.length === 0 || rolling}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B4F71] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#38BDF8] dark:text-[#07131F] md:w-auto"
              >
                <Dices
                  className={`h-4 w-4 ${rolling ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {rolling ? '抽取中…' : '🎲 帮我抽一条'}
              </button>
            </div>
          </div>
        </div>
      </section>
      {selectedRegion === 'global' ? (
        <div className="mt-4 space-y-6">
          {globalGroups.map((group) => {
            const hemiLabel = group.hemisphere === 'south' ? '南半球' : '北半球';
            const heading = `${getRegionFlag(
              group.regionKey ?? 'global',
            )} ${stripParens(group.label)}（${hemiLabel} · ${month}月正肥）`;
            return (
              <section key={group.key} aria-labelledby={`hf-season-${group.key}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2
                      id={`hf-season-${group.key}`}
                      className="text-base font-semibold tracking-tight text-[#0F172A] dark:text-[#F1F5F9]"
                    >
                      {heading}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-[#52667A] dark:text-[#94A3B8]">
                      本月当季{' '}
                      <span
                        data-testid={`seasonal-group-count-${group.key}`}
                        className="tabular-nums"
                      >
                        {group.records.length}
                      </span>{' '}
                      种
                    </p>
                  </div>
                  {group.regionKey ? (
                    <button
                      type="button"
                      onClick={() => setSelectedRegion(group.regionKey as string)}
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-[#0B4F71]/25 bg-white px-3 text-[11px] font-semibold text-[#0B4F71] transition-colors hover:border-[#0B4F71]/45 dark:border-[#38BDF8]/30 dark:bg-[#0B1824] dark:text-[#38BDF8]"
                    >
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      切换定位到此地区 →
                    </button>
                  ) : null}
                </div>

                {group.records.length > 0 ? (
                  <div className="mt-2 grid grid-cols-2 gap-2.5 sm:gap-3.5">
                    {group.records.map((record) => (
                      <SpeciesCard
                        key={record.id}
                        species={record}
                        month={month}
                        seasonNote={seasonalNote(record, group.key)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 rounded-2xl border border-dashed border-[#E2EBF0] bg-white/60 px-4 py-6 text-center text-xs text-[#52667A] dark:border-[#1E354A] dark:bg-[#102030]/50 dark:text-[#94A3B8]">
                    {month} 月该时令组暂无匹配的当季海产，可切换场景或开启「含全年稳定鲜食」。
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-[#0F172A] dark:text-[#F1F5F9]">
                {getRegionFlag(selectedRegion)} {regionLabel} · {month} 月当季
              </h2>
              <p className="mt-0.5 text-[11px] text-[#52667A] dark:text-[#94A3B8]">
                {selectedGroupKey
                  ? `时令组：${stripParens(
                      data?.regions.season_groups[selectedGroupKey]?.label ??
                        selectedGroupKey,
                    )}`
                  : '未匹配到本地季节点，暂不展示本地当季'}
              </p>
            </div>
            <span
              data-testid="seasonal-local-count"
              className="rounded-full border border-[#E2EBF0] bg-white/70 px-3 py-1 text-[11px] font-medium text-[#52667A] tabular-nums dark:border-[#1E354A] dark:bg-[#102030]/70 dark:text-[#94A3B8]"
            >
              {localRecords.length} 种
            </span>
          </div>

          {localRecords.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3.5">
              {localRecords.map((record) => (
                <SpeciesCard
                  key={record.id}
                  species={record}
                  month={month}
                  seasonNote={
                    selectedGroupKey
                      ? seasonalNote(record, selectedGroupKey)
                      : noteForMonth(record, month)
                  }
                />
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-3xl border border-dashed border-[#E2EBF0] bg-white/60 px-5 py-12 text-center dark:border-[#1E354A] dark:bg-[#102030]/50">
              <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                本月暂无匹配的当季海产
              </p>
              <p className="mt-1 text-xs leading-5 text-[#52667A] dark:text-[#94A3B8]">
                切换「全部当季」场景或开启「含全年稳定鲜食」后再看看。
              </p>
            </div>
          )}

          {otherRegionRecords.length > 0 ? (
            <section
              className="mt-8 border-t border-dashed border-[#E2EBF0] pt-5 dark:border-[#1E354A]"
              data-testid="seasonal-other-region"
            >
              <div className="min-w-0">
                <h3 className="text-sm font-semibold tracking-tight text-[#0F172A] dark:text-[#F1F5F9]">
                  其他地区本月当季（本地无分布）
                </h3>
                <p className="mt-0.5 text-[11px] text-[#52667A] dark:text-[#94A3B8]">
                  共 <span className="tabular-nums">{otherRegionRecords.length}</span>{' '}
                  种 · 仅供了解，本地按无分布处理
                </p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2.5 sm:gap-3.5">
                {otherRegionRecords.map((record) => (
                  <SpeciesCard
                    key={record.id}
                    species={record}
                    month={month}
                    seasonNote={noteForMonth(record, month)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
