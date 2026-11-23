import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  createDefaultHomeFilterState,
  type HomeFilterState,
} from '../services/filters';
import {
  migrateIdList,
  migrateRecordMap,
  resolveRedirectId,
} from '../services/kinship';
import type { CategoryCode, IdRedirects } from '../types/schema';

const STORE_KEY = 'howfish_user_store_v1';
const MAX_COMPARE = 3;

export type ThemeMode = 'system' | 'light' | 'dark';

export type UserTag = '常买' | '想试' | '避雷';

export const USER_TAGS: readonly UserTag[] = ['常买', '想试', '避雷'];

export type TablePreset = 'core' | 'aliases' | 'full';

export interface TableSortingRule {
  id: string;
  desc: boolean;
}

export interface TableState {
  keyword: string;
  preset: TablePreset;
  hiddenColumns: string[];
  columnFilters: Record<string, string[]>;
  sorting: TableSortingRule[];
  scrollTop: number;
  columnsCustomized: boolean;
}

export const DEFAULT_TABLE_STATE: TableState = {
  keyword: '',
  preset: 'core',
  hiddenColumns: [],
  columnFilters: {},
  sorting: [],
  scrollTop: 0,
  columnsCustomized: false,
};

export interface UserBackupPayload {
  version: number;
  exported_at: string;
  favorites: string[];
  userTags: Record<string, UserTag[]>;
  userNotes: Record<string, string>;
  compareIds: string[];
}

export type BackupImportMode = 'merge' | 'replace';

export interface AppState {
  selectedRegion: string;
  selectedCategory: CategoryCode | 'ALL';
  theme: ThemeMode;
  compareIds: string[];
  favorites: string[];
  userTags: Record<string, UserTag[]>;
  userNotes: Record<string, string>;
  homeQuery: string;
  homeFilter: HomeFilterState;
  tableState: TableState;
  regionEpoch: number;
  homeFeedSeed: number;

  setSelectedRegion: (region: string) => void;
  setSelectedCategory: (category: CategoryCode | 'ALL') => void;
  setTheme: (theme: ThemeMode) => void;
  shuffleHomeFeed: () => void;

  setCompareIds: (ids: string[]) => void;
  toggleCompare: (id: string) => void;
  removeCompare: (id: string) => void;
  clearCompare: () => void;

  toggleFavorite: (id: string) => void;
  toggleUserTag: (id: string, tag: UserTag) => void;
  setUserNote: (id: string, note: string) => void;

  setHomeQuery: (query: string) => void;
  setHomeFilter: (filter: HomeFilterState) => void;
  patchHomeFilter: (patch: Partial<HomeFilterState>) => void;
  resetHomeFilter: () => void;

  setTableState: (patch: Partial<TableState>) => void;

  applyRedirects: (redirects: IdRedirects) => number;
  exportUserBackup: () => UserBackupPayload;
  importUserBackup: (payload: unknown, mode: BackupImportMode) => boolean;
}

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

function mergeTagLists(a: UserTag[], b: UserTag[]): UserTag[] {
  const merged: UserTag[] = [];
  for (const tag of [...a, ...b]) {
    if (USER_TAGS.includes(tag) && !merged.includes(tag)) {
      merged.push(tag);
    }
  }
  return merged;
}

function mergeNotes(a: string, b: string): string {
  if (!a) return b;
  if (!b || a === b) return a;
  if (a.includes(b)) return a;
  return `${a}\n${b}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUserTag(value: unknown): value is UserTag {
  return typeof value === 'string' && USER_TAGS.includes(value as UserTag);
}

interface ParsedBackup {
  favorites: string[];
  userTags: Record<string, UserTag[]>;
  userNotes: Record<string, string>;
  compareIds: string[];
}

function parseBackup(payload: unknown): ParsedBackup | null {
  if (!isRecord(payload)) {
    return null;
  }

  const favorites = Array.isArray(payload.favorites)
    ? uniqueStrings(payload.favorites.filter((id): id is string => typeof id === 'string'))
    : [];

  const userNotes: Record<string, string> = {};
  if (isRecord(payload.userNotes)) {
    for (const [id, note] of Object.entries(payload.userNotes)) {
      if (typeof note === 'string') {
        userNotes[id] = note;
      }
    }
  }

  const userTags: Record<string, UserTag[]> = {};
  if (isRecord(payload.userTags)) {
    for (const [id, tags] of Object.entries(payload.userTags)) {
      if (Array.isArray(tags)) {
        const valid = tags.filter(isUserTag);
        if (valid.length > 0) {
          userTags[id] = mergeTagLists([], valid);
        }
      }
    }
  }

  const compareIds = Array.isArray(payload.compareIds)
    ? uniqueStrings(payload.compareIds.filter((id): id is string => typeof id === 'string'))
    : [];

  const hasKnownField =
    'favorites' in payload ||
    'compareIds' in payload ||
    'userNotes' in payload ||
    'userTags' in payload;

  if (!hasKnownField) {
    return null;
  }
  return {
    favorites,
    userTags,
    userNotes,
    compareIds: compareIds.slice(0, MAX_COMPARE),
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      selectedRegion: 'global',
      selectedCategory: 'ALL',
      theme: 'system',
      compareIds: [],
      favorites: [],
      userTags: {},
      userNotes: {},
      homeQuery: '',
      homeFilter: createDefaultHomeFilterState(),
      tableState: { ...DEFAULT_TABLE_STATE },
      regionEpoch: 0,
      homeFeedSeed: 1,

      setSelectedRegion: (region) => {
        if (get().selectedRegion === region) {
          return;
        }
        set((state) => ({
          selectedRegion: region,
          regionEpoch: state.regionEpoch + 1,
          homeFeedSeed: state.homeFeedSeed + 1,
        }));
      },
      setSelectedCategory: (category) => set({ selectedCategory: category }),
      setTheme: (theme) => set({ theme }),
      shuffleHomeFeed: () =>
        set((state) => ({ homeFeedSeed: state.homeFeedSeed + 1 })),

      setCompareIds: (ids) =>
        set({ compareIds: uniqueStrings(ids).slice(0, MAX_COMPARE) }),

      toggleCompare: (id) => {
        const current = get().compareIds;
        if (current.includes(id)) {
          set({ compareIds: current.filter((item) => item !== id) });
          return;
        }
        if (current.length >= MAX_COMPARE) {
          return;
        }
        set({ compareIds: [...current, id] });
      },

      removeCompare: (id) =>
        set({ compareIds: get().compareIds.filter((item) => item !== id) }),

      clearCompare: () => set({ compareIds: [] }),

      toggleFavorite: (id) => {
        const current = get().favorites;
        set({
          favorites: current.includes(id)
            ? current.filter((item) => item !== id)
            : uniqueStrings([...current, id]),
        });
      },

      toggleUserTag: (id, tag) => {
        if (!isUserTag(tag)) {
          return;
        }
        const current = get().userTags;
        const existing = current[id] ?? [];
        const nextTags = existing.includes(tag)
          ? existing.filter((item) => item !== tag)
          : [...existing, tag];
        const nextTagsMap = { ...current };
        if (nextTags.length > 0) {
          nextTagsMap[id] = nextTags;
        } else {
          delete nextTagsMap[id];
        }
        set({ userTags: nextTagsMap });
      },

      setUserNote: (id, note) => {
        const nextNotes = { ...get().userNotes };
        if (note.trim()) {
          nextNotes[id] = note;
        } else {
          delete nextNotes[id];
        }
        set({ userNotes: nextNotes });
      },

      setHomeQuery: (query) => set({ homeQuery: query }),
      setHomeFilter: (filter) => set({ homeFilter: filter }),
      patchHomeFilter: (patch) =>
        set({ homeFilter: { ...get().homeFilter, ...patch } }),
      resetHomeFilter: () => set({ homeFilter: createDefaultHomeFilterState() }),

      setTableState: (patch) =>
        set({ tableState: { ...get().tableState, ...patch } }),

      applyRedirects: (redirects) => {
        if (!redirects || Object.keys(redirects).length === 0) {
          return 0;
        }

        const state = get();
        let changes = 0;

        const migrateList = (ids: string[]): string[] => {
          for (const id of ids) {
            if (resolveRedirectId(id, redirects) !== id) {
              changes += 1;
            }
          }
          return migrateIdList(ids, redirects);
        };

        for (const key of Object.keys(state.userNotes)) {
          if (resolveRedirectId(key, redirects) !== key) {
            changes += 1;
          }
        }
        for (const key of Object.keys(state.userTags)) {
          if (resolveRedirectId(key, redirects) !== key) {
            changes += 1;
          }
        }

        const favorites = migrateList(state.favorites);
        const compareIds = migrateList(state.compareIds).slice(0, MAX_COMPARE);
        const userNotes = migrateRecordMap(
          state.userNotes,
          redirects,
          mergeNotes,
        );
        const userTags = migrateRecordMap(
          state.userTags,
          redirects,
          mergeTagLists,
        );

        if (changes > 0) {
          set({ favorites, compareIds, userNotes, userTags });
        }

        return changes;
      },

      exportUserBackup: () => {
        const state = get();
        return {
          version: 1,
          exported_at: new Date().toISOString(),
          favorites: [...state.favorites],
          userTags: Object.fromEntries(
            Object.entries(state.userTags).map(([id, tags]) => [id, [...tags]]),
          ),
          userNotes: { ...state.userNotes },
          compareIds: [...state.compareIds],
        };
      },

      importUserBackup: (payload, mode) => {
        const parsed = parseBackup(payload);
        if (!parsed) {
          return false;
        }

        if (mode === 'replace') {
          set({
            favorites: parsed.favorites,
            userTags: parsed.userTags,
            userNotes: parsed.userNotes,
            compareIds: parsed.compareIds.slice(0, MAX_COMPARE),
          });
          return true;
        }

        const state = get();
        const mergedTags: Record<string, UserTag[]> = { ...state.userTags };
        for (const [id, tags] of Object.entries(parsed.userTags)) {
          mergedTags[id] = mergeTagLists(mergedTags[id] ?? [], tags);
        }

        set({
          favorites: uniqueStrings([...state.favorites, ...parsed.favorites]),
          userTags: mergedTags,
          userNotes: { ...parsed.userNotes, ...state.userNotes },
          compareIds: uniqueStrings([
            ...state.compareIds,
            ...parsed.compareIds,
          ]).slice(0, MAX_COMPARE),
        });
        return true;
      },
    }),
    {
      name: STORE_KEY,
      version: 1,
      merge: (persisted, current) => {
        const incoming = (persisted ?? {}) as Partial<AppState>;
        const rawTable = (incoming.tableState ?? {}) as Partial<TableState>;

        const hiddenColumns = Array.isArray(rawTable.hiddenColumns)
          ? rawTable.hiddenColumns.filter(
              (value): value is string => typeof value === 'string',
            )
          : [];

        const columnFilters: Record<string, string[]> = {};
        if (rawTable.columnFilters && typeof rawTable.columnFilters === 'object') {
          for (const [key, value] of Object.entries(rawTable.columnFilters)) {
            if (!Array.isArray(value)) {
              continue;
            }
            const valid = value.filter(
              (item): item is string => typeof item === 'string',
            );
            if (valid.length > 0) {
              columnFilters[key] = valid;
            }
          }
        }

        const sorting = Array.isArray(rawTable.sorting)
          ? rawTable.sorting
              .filter(
                (rule): rule is TableSortingRule =>
                  typeof rule === 'object' &&
                  rule !== null &&
                  typeof (rule as TableSortingRule).id === 'string' &&
                  typeof (rule as TableSortingRule).desc === 'boolean',
              )
              .map((rule) => ({ id: rule.id, desc: rule.desc }))
          : [];

        return {
          ...current,
          ...incoming,
          compareIds: Array.isArray(incoming.compareIds)
            ? incoming.compareIds
            : current.compareIds,
          tableState: {
            ...DEFAULT_TABLE_STATE,
            ...rawTable,
            keyword:
              typeof rawTable.keyword === 'string' ? rawTable.keyword : '',
            preset:
              rawTable.preset === 'aliases' || rawTable.preset === 'full'
                ? rawTable.preset
                : 'core',
            hiddenColumns,
            columnFilters,
            sorting,
            scrollTop:
              typeof rawTable.scrollTop === 'number' &&
              Number.isFinite(rawTable.scrollTop)
                ? rawTable.scrollTop
                : 0,
            columnsCustomized: rawTable.columnsCustomized === true,
          },
        } as AppState;
      },
      partialize: (state) => ({
        selectedRegion: state.selectedRegion,
        selectedCategory: state.selectedCategory,
        theme: state.theme,
        compareIds: state.compareIds,
        favorites: state.favorites,
        userTags: state.userTags,
        userNotes: state.userNotes,
        homeQuery: state.homeQuery,
        homeFilter: state.homeFilter,
        tableState: state.tableState,
      }),
    },
  ),
);