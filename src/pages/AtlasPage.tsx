import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Leaf,
  ListTree,
  Microscope,
  Network,
  Plus,
  Search,
  ShieldCheck,
  Table2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { SashimiBadge } from '../components/common/SashimiBadge';
import {
  HorizontalScrollSyncBar,
  useDragToScroll,
} from '../components/common/HorizontalScrollSyncBar';
import {
  TableZoomControls,
  usePinchZoom,
} from '../components/common/TableZoomControls';
import { SpeciesPlaceholderSvg } from '../components/common/SpeciesPlaceholderSvg';
import { useData } from '../context/DataContext';
import { useAppStore } from '../store/useAppStore';
import {
  CATEGORY_LABELS,
  type CategoryCode,
  type LoadedAppData,
  type SpeciesRecord,
  type TaxonomyLevel,
  type TaxonomyNode,
} from '../types/schema';

type AtlasLevel = 'category' | TaxonomyLevel;

interface AtlasNode {
  key: string;
  code: string | null;
  level: AtlasLevel;
  name: string;
  latin: string | null;
  anatomy: string | null;
  ecology: string | null;
  children: AtlasNode[];
  species: SpeciesRecord[];
  count: number;
}

const LEVEL_LABELS: Record<AtlasLevel, string> = {
  category: '大类',
  superorder: '总目',
  order: '目',
  family: '科',
  subfamily: '亚科/族',
  genus: '属',
};

const LEVEL_BADGE_CLASS: Record<AtlasLevel, string> = {
  category:
    'border-[#0B4F71]/25 bg-[#0B4F71]/10 text-[#0B4F71] dark:border-[#38BDF8]/30 dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]',
  superorder:
    'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300',
  order:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
  family:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  subfamily:
    'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300',
  genus:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
};

const SPECIES_BADGE_CLASS =
  'border-[#0F172A]/15 bg-[#0F172A]/5 text-[#334155] dark:border-[#E2EBF0]/15 dark:bg-[#E2EBF0]/5 dark:text-[#CBD5E1]';

const TABLE_COLUMN_MIN_WIDTHS = [124, 124, 124, 132, 142, 232, 330, 330] as const;

interface AtlasGenusRow {
  key: string;
  genus: TaxonomyNode;
  superorder: TaxonomyNode | null;
  order: TaxonomyNode | null;
  family: TaxonomyNode | null;
  subfamily: TaxonomyNode | null;
  species: SpeciesRecord[];
}

function speciesNameBase(name: string): string {
  const cut = name.search(/[（(]/);
  return cut > 0 ? name.slice(0, cut).trim() : name.trim();
}

function findSpeciesByName(
  name: string,
  species: SpeciesRecord[],
): SpeciesRecord | undefined {
  const target = name.trim();
  if (!target) {
    return undefined;
  }
  const exact = species.find((item) => item.names.zh_formal === target);
  if (exact) {
    return exact;
  }
  const targetBase = speciesNameBase(target);
  if (targetBase !== target) {
    return undefined;
  }
  return (
    species.find((item) => item.names.zh_formal === targetBase) ??
    species.find((item) => speciesNameBase(item.names.zh_formal) === targetBase)
  );
}

interface AtlasSpeciesCellItem {
  key: string;
  label: string;
  speciesId: string | null;
}

function buildSpeciesCellItems(row: AtlasGenusRow): AtlasSpeciesCellItem[] {
  const names: string[] = [];
  const addName = (value: string | undefined | null) => {
    const name = (value ?? '').trim();
    if (name && !names.includes(name)) {
      names.push(name);
    }
  };

  for (const name of row.genus.species_names ?? []) {
    addName(name);
  }
  for (const item of row.species) {
    addName(item.names.zh_formal);
  }

  const seenLabels = new Set<string>();
  const items: AtlasSpeciesCellItem[] = [];
  for (const name of names) {
    const match = findSpeciesByName(name, row.species);
    const label = match ? match.names.zh_formal : name;
    if (seenLabels.has(label)) {
      continue;
    }
    seenLabels.add(label);
    items.push({
      key: label,
      label,
      speciesId: match ? match.id : null,
    });
  }
  return items;
}

function AtlasBranchRow({
  isFirst,
  isLast,
  children,
}: {
  isFirst: boolean;
  isLast: boolean;
  children: React.ReactNode;
}) {
  const verticalClass =
    isFirst && isLast
      ? 'hidden'
      : isFirst
        ? 'top-7 bottom-0'
        : isLast
          ? 'top-0 h-7'
          : 'top-0 bottom-0';

  return (
    <div className="relative flex items-start pl-6">
      <span
        aria-hidden="true"
        className="absolute left-0 top-7 h-px w-6 bg-[#C9D9E2] dark:bg-[#1E354A]"
      />
      <span
        aria-hidden="true"
        className={`absolute left-0 w-px bg-[#C9D9E2] dark:bg-[#1E354A] ${verticalClass}`}
      />
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const HIERARCHY_SURFACE_CLASS: Record<TaxonomyLevel, string> = {
  superorder: 'bg-[#EAF6FB] dark:bg-[#0D2A3A]',
  order: 'bg-[#F2F8FB] dark:bg-[#0E2130]',
  family: 'bg-white dark:bg-[#102030]',
  subfamily: 'bg-[#F0F6F9] dark:bg-[#0C1B28]',
  genus: 'bg-white dark:bg-[#102030]',
};

function HierarchyCell({
  node,
  level,
  rowSpan,
  groupStart = false,
}: {
  node: TaxonomyNode | null;
  level: TaxonomyLevel;
  rowSpan: number;
  groupStart?: boolean;
}) {
  return (
    <td
      rowSpan={rowSpan}
      className={`border-[1.5px] border-[#8FB4C9] px-2.5 py-2 align-middle dark:border-[#345C7A] ${HIERARCHY_SURFACE_CLASS[level]} ${
        groupStart
          ? 'border-t-2 border-t-[#0B4F71]/45 dark:border-t-[#38BDF8]/45'
          : ''
      }`}
    >
      {node ? (
        <div>
          <p className="text-[11px] font-semibold leading-4 text-[#0F172A] dark:text-[#F1F5F9]">
            {node.name_zh}
          </p>
          <p className="font-mono text-[9px] tabular-nums text-[#52667A] dark:text-[#94A3B8]">
            {node.code}
          </p>
        </div>
      ) : (
        <span className="text-[10px] text-[#94A3B8] dark:text-[#52667A]">
          —
        </span>
      )}
    </td>
  );
}

function buildGenusRows(data: LoadedAppData): AtlasGenusRow[] {
  const speciesByGenus = new Map<string, SpeciesRecord[]>();

  for (const species of data.species) {
    const genusCode = species.taxon_codes?.genus;
    if (!genusCode) {
      continue;
    }
    const list = speciesByGenus.get(genusCode) ?? [];
    list.push(species);
    speciesByGenus.set(genusCode, list);
  }

  const rows: AtlasGenusRow[] = [];

  for (const node of data.taxonomyNodes) {
    if (node.level !== 'genus') {
      continue;
    }

    const ancestors = new Map<TaxonomyLevel, TaxonomyNode>();
    const visited = new Set<string>([node.code]);
    let cursor = node.parent_code
      ? data.taxonomyByCode[node.parent_code]
      : undefined;

    while (cursor) {
      if (visited.has(cursor.code)) {
        break;
      }
      visited.add(cursor.code);
      ancestors.set(cursor.level, cursor);
      cursor = cursor.parent_code
        ? data.taxonomyByCode[cursor.parent_code]
        : undefined;
    }

    rows.push({
      key: `genus:${node.code}`,
      genus: node,
      superorder: ancestors.get('superorder') ?? null,
      order: ancestors.get('order') ?? null,
      family: ancestors.get('family') ?? null,
      subfamily: ancestors.get('subfamily') ?? null,
      species: [...(speciesByGenus.get(node.code) ?? [])].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
    });
  }

  return rows.sort((a, b) => a.genus.code.localeCompare(b.genus.code));
}

function collectLoadedKeys(nodes: AtlasNode[]): Set<string> {
  const keys = new Set<string>();

  const walk = (node: AtlasNode) => {
    if (node.count > 0) {
      keys.add(node.key);
    }
    for (const child of node.children) {
      walk(child);
    }
  };

  for (const root of nodes) {
    walk(root);
  }

  return keys;
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

function buildAtlasTree(data: LoadedAppData): AtlasNode[] {
  const childrenByParent = new Map<string, TaxonomyNode[]>();
  const rootsByCategory = new Map<string, TaxonomyNode[]>();

  for (const node of data.taxonomyNodes) {
    if (node.parent_code) {
      const list = childrenByParent.get(node.parent_code) ?? [];
      list.push(node);
      childrenByParent.set(node.parent_code, list);
    } else {
      const category = node.code.slice(0, 2);
      const list = rootsByCategory.get(category) ?? [];
      list.push(node);
      rootsByCategory.set(category, list);
    }
  }

  const speciesByGenus = new Map<string, SpeciesRecord[]>();
  const unassignedByCategory = new Map<string, SpeciesRecord[]>();

  for (const species of data.species) {
    const genusCode = species.taxon_codes?.genus;
    if (genusCode && data.taxonomyByCode[genusCode]) {
      const list = speciesByGenus.get(genusCode) ?? [];
      list.push(species);
      speciesByGenus.set(genusCode, list);
    } else {
      const list = unassignedByCategory.get(species.category) ?? [];
      list.push(species);
      unassignedByCategory.set(species.category, list);
    }
  }

  const buildNode = (node: TaxonomyNode): AtlasNode => {
    const children = (childrenByParent.get(node.code) ?? []).map(buildNode);
    const species = [...(speciesByGenus.get(node.code) ?? [])].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    const count =
      species.length + children.reduce((sum, child) => sum + child.count, 0);
    return {
      key: `taxon:${node.code}`,
      code: node.code,
      level: node.level,
      name: node.name_zh,
      latin: node.name_latin,
      anatomy: node.anatomy_notes,
      ecology: node.ecology_notes,
      children,
      species,
      count,
    };
  };

  return data.categoriesPresent.map((category) => {
    const children = (rootsByCategory.get(category) ?? []).map(buildNode);
    const species = [...(unassignedByCategory.get(category) ?? [])].sort(
      (a, b) => a.id.localeCompare(b.id),
    );
    const count =
      species.length + children.reduce((sum, child) => sum + child.count, 0);
    return {
      key: `category:${category}`,
      code: null,
      level: 'category' as const,
      name: CATEGORY_LABELS[category as CategoryCode],
      latin: null,
      anatomy: null,
      ecology: null,
      children,
      species,
      count,
    };
  });
}

function findAtlasPath(
  nodes: AtlasNode[],
  key: string,
  trail: string[] = [],
): string[] | null {
  for (const node of nodes) {
    const next = [...trail, node.key];
    if (node.key === key) {
      return next;
    }
    const found = findAtlasPath(node.children, key, next);
    if (found) {
      return found;
    }
  }
  return null;
}

function speciesMatchesQuery(species: SpeciesRecord, query: string): boolean {
  const haystack = [
    species.id,
    species.names.zh_formal,
    species.names.latin,
    species.names.en_standard,
    ...Object.values(species.names.aliases).flat(),
  ];
  return haystack.some((text) => text.toLowerCase().includes(query));
}
export function AtlasPage() {
  const { data, loading, error } = useData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = searchParams.get('tab') === 'traps' ? 'traps' : 'tree';
  const focusCode = searchParams.get('focus');

  const [query, setQuery] = useState('');
  const [onlyLoaded, setOnlyLoaded] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<'diagram' | 'table'>('diagram');
  const [tableZoom, setTableZoom] = useState(1);
  const [tableNaturalSize, setTableNaturalSize] = useState({
    width: 0,
    height: 0,
  });
  const [treeZoom, setTreeZoom] = useState(1);
  const [treeNaturalSize, setTreeNaturalSize] = useState({
    width: 0,
    height: 0,
  });

  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const treeElementRef = useRef<HTMLDivElement | null>(null);
  const tableElementRef = useRef<HTMLTableElement | null>(null);

  useDragToScroll(treeScrollRef, [view, tab]);
  useDragToScroll(tableScrollRef, [view, tab]);
  usePinchZoom(tableScrollRef, tableZoom, setTableZoom);
  usePinchZoom(treeScrollRef, treeZoom, setTreeZoom);

  const compareIds = useAppStore((state) => state.compareIds);
  const toggleCompare = useAppStore((state) => state.toggleCompare);
  const setCompareIds = useAppStore((state) => state.setCompareIds);

  const tree = useMemo(() => (data ? buildAtlasTree(data) : []), [data]);

  const genusRows = useMemo(
    () => (data ? buildGenusRows(data) : []),
    [data],
  );

  const filteredGenusRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return genusRows.filter((row) => {
      if (onlyLoaded && row.species.length === 0) {
        return false;
      }
      if (!normalized) {
        return true;
      }

      const texts: string[] = [];
      for (const node of [
        row.superorder,
        row.order,
        row.family,
        row.subfamily,
      ]) {
        if (!node) {
          continue;
        }
        texts.push(
          node.name_zh,
          node.name_latin ?? '',
          node.code,
          node.anatomy_notes ?? '',
          node.ecology_notes ?? '',
        );
      }
      texts.push(
        row.genus.name_zh,
        row.genus.name_latin ?? '',
        row.genus.code,
        row.genus.anatomy_notes ?? '',
        row.genus.ecology_notes ?? '',
        ...(row.genus.species_names ?? []),
      );
      for (const item of row.species) {
        texts.push(
          item.id,
          item.names.zh_formal,
          item.names.latin,
          item.names.en_standard,
          ...Object.values(item.names.aliases).flat(),
        );
      }

      return texts.some((text) => text.toLowerCase().includes(normalized));
    });
  }, [genusRows, onlyLoaded, query]);

  const genusSpans = useMemo<
    Record<'superorder' | 'order' | 'family' | 'subfamily', number>[]
  >(() => {
    const rows = filteredGenusRows;
    if (rows.length === 0) {
      return [];
    }

    const spans = rows.map(() => ({
      superorder: 0,
      order: 0,
      family: 0,
      subfamily: 0,
    }));

    const levels = ['superorder', 'order', 'family', 'subfamily'] as const;
    for (const level of levels) {
      let runStart = 0;
      for (let index = 1; index <= rows.length; index += 1) {
        const nextCode =
          index < rows.length ? rows[index][level]?.code ?? '' : null;
        const runCode = rows[runStart][level]?.code ?? '';
        if (nextCode === null || nextCode !== runCode) {
          spans[runStart][level] = index - runStart;
          runStart = index;
        }
      }
    }

    return spans;
  }, [filteredGenusRows]);

  useEffect(() => {
    if (view !== 'table') {
      return;
    }
    const node = tableElementRef.current;
    if (!node) {
      return;
    }
    const measure = () => {
      setTableNaturalSize((previous) => {
        const width = node.offsetWidth;
        const height = node.offsetHeight;
        return previous.width === width && previous.height === height
          ? previous
          : { width, height };
      });
    };
    measure();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(node);
    }
    return () => observer?.disconnect();
  }, [view, filteredGenusRows.length, query, onlyLoaded]);

  useEffect(() => {
    if (view !== 'diagram') {
      return;
    }
    const node = treeElementRef.current;
    if (!node) {
      return;
    }
    const measure = () => {
      setTreeNaturalSize((previous) => {
        const width = node.offsetWidth;
        const height = node.offsetHeight;
        return previous.width === width && previous.height === height
          ? previous
          : { width, height };
      });
    };
    measure();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(node);
    }
    return () => observer?.disconnect();
  }, [view, tree.length, expanded, query, onlyLoaded]);

  const focusKey = focusCode ? `taxon:${focusCode}` : null;
  const focusPath = useMemo(
    () => (focusKey ? findAtlasPath(tree, focusKey) : null),
    [tree, focusKey],
  );

  const searchState = useMemo(() => {
    const matched = new Set<string>();
    const branches = new Set<string>();
    const normalized = query.trim().toLowerCase();
    let any = false;

    if (!normalized) {
      return { matched, branches, any };
    }

    const walk = (node: AtlasNode): boolean => {
      const ownText = [
        node.name,
        node.latin ?? '',
        node.code ?? '',
        node.anatomy ?? '',
        node.ecology ?? '',
      ];
      const ownMatch = ownText.some((text) =>
        text.toLowerCase().includes(normalized),
      );
      const speciesMatch = node.species.some((species) =>
        speciesMatchesQuery(species, normalized),
      );
      let childMatch = false;
      for (const child of node.children) {
        if (walk(child)) {
          childMatch = true;
        }
      }
      const subtreeMatch = ownMatch || speciesMatch || childMatch;
      if (ownMatch || speciesMatch) {
        matched.add(node.key);
      }
      if (subtreeMatch) {
        branches.add(node.key);
        any = true;
      }
      return subtreeMatch;
    };

    for (const root of tree) {
      walk(root);
    }

    return { matched, branches, any };
  }, [tree, query]);

  useEffect(() => {
    if (tree.length === 0) {
      return;
    }
    setExpanded((prev) => {
      if (prev.size > 0) {
        return prev;
      }
      const next = new Set<string>();
      for (const root of tree) {
        next.add(root.key);
        for (const child of root.children) {
          if (child.level === 'superorder') {
            next.add(child.key);
          }
        }
      }
      return next;
    });
  }, [tree]);

  useEffect(() => {
    if (!focusPath || focusPath.length === 0) {
      return;
    }
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const key of focusPath) {
        next.add(key);
      }
      return next;
    });
  }, [focusPath]);

  useEffect(() => {
    if (focusCode && tab === 'tree') {
      setView('diagram');
    }
  }, [focusCode, tab]);

  useEffect(() => {
    if (!focusCode || tab !== 'tree' || view !== 'diagram') {
      return;
    }
    const timer = window.setTimeout(() => {
      const element = document.querySelector<HTMLElement>(
        `[data-taxon-code="${focusCode}"]`,
      );
      element?.scrollIntoView({
        block: 'center',
        inline: 'center',
        behavior: 'smooth',
      });
    }, 140);
    return () => window.clearTimeout(timer);
  }, [focusCode, focusPath, expanded, tab, view]);

  const effectiveExpanded = useMemo(() => {
    const next = new Set(expanded);
    for (const key of searchState.branches) {
      next.add(key);
    }
    if (focusPath) {
      for (const key of focusPath) {
        next.add(key);
      }
    }
    return next;
  }, [expanded, searchState, focusPath]);

  function selectTab(next: 'tree' | 'traps') {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  function toggleNode(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function expandLoadedBranches() {
    setExpanded(collectLoadedKeys(tree));
  }

  function collapseAllBranches() {
    setExpanded(new Set());
    setQuery('');
    if (focusCode) {
      const params = new URLSearchParams(searchParams);
      params.delete('focus');
      setSearchParams(params, { replace: true });
    }
  }

  function enterCompare(ids: string[]) {
    if (!data) {
      return;
    }
    const available = uniqueIds(
      ids.filter((id) => Boolean(data.speciesById[id])),
    ).slice(0, 3);
    if (available.length < 2) {
      return;
    }
    setCompareIds(available);
    navigate(`/compare?ids=${available.join(',')}`);
  }

  function isVisible(node: AtlasNode): boolean {
    if (!onlyLoaded) {
      return true;
    }
    if (node.count > 0) {
      return true;
    }
    if (focusPath?.includes(node.key)) {
      return true;
    }
    if (searchState.matched.has(node.key) || searchState.branches.has(node.key)) {
      return true;
    }
    return false;
  }

  function renderSpeciesLeaf(species: SpeciesRecord) {
    const selected = compareIds.includes(species.id);
    const full = !selected && compareIds.length >= 3;

    return (
      <div className="w-[238px] rounded-2xl border border-[#E2EBF0] bg-white p-2 shadow-[0_10px_22px_-24px_rgba(11,79,113,0.55)] dark:border-[#1E354A] dark:bg-[#102030]">
        <Link
          to={`/species/${species.id}`}
          className="flex items-start gap-2 rounded-xl transition-colors hover:bg-[#0B4F71]/[0.04] dark:hover:bg-[#38BDF8]/[0.07]"
        >
          <SpeciesPlaceholderSvg
            category={species.category}
            fleshColor={null}
            cover={species.media.cover}
            alt={species.names.zh_formal}
            id={species.id}
            className="h-9 w-9 shrink-0 rounded-lg border border-[#E2EBF0]/80 dark:border-[#1E354A]/80"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1">
              <span
                className={`shrink-0 rounded-md border px-1 py-0.5 text-[9px] font-semibold ${SPECIES_BADGE_CLASS}`}
              >
                种
              </span>
              <span className="line-clamp-2 text-[11px] font-semibold leading-4 text-[#0F172A] dark:text-[#F1F5F9]">
                {species.names.zh_formal}
              </span>
            </span>
            <span className="mt-0.5 block truncate text-[9px] italic text-[#52667A] dark:text-[#94A3B8]">
              {species.names.latin}
            </span>
            <span className="mt-0.5 block truncate font-mono text-[9px] tabular-nums text-[#52667A]/80 dark:text-[#94A3B8]/80">
              {species.id}
            </span>
          </span>
        </Link>

        <div className="mt-1.5 flex items-center justify-between gap-1.5">
          <SashimiBadge level={species.sashimi.level} compact />
          <button
            type="button"
            aria-pressed={selected}
            disabled={full}
            onClick={() => toggleCompare(species.id)}
            className={`inline-flex h-7 shrink-0 items-center gap-0.5 rounded-full border px-2 text-[10px] font-semibold transition-colors ${
              selected
                ? 'border-[#0B4F71] bg-[#0B4F71] text-white dark:border-[#38BDF8] dark:bg-[#38BDF8] dark:text-[#07131F]'
                : full
                  ? 'cursor-not-allowed border-[#E2EBF0] text-[#94A3B8] dark:border-[#1E354A] dark:text-[#52667A]'
                  : 'border-[#E2EBF0] text-[#0B4F71] hover:border-[#0B4F71]/40 dark:border-[#1E354A] dark:text-[#38BDF8]'
            }`}
          >
            {selected ? (
              <Check className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Plus className="h-3 w-3" aria-hidden="true" />
            )}
            对比
          </button>
        </div>
      </div>
    );
  }

  function renderAtlasNode(node: AtlasNode): React.ReactNode {
    if (!isVisible(node)) {
      return null;
    }

    const visibleChildren = node.children.filter((child) => isVisible(child));
    const hasTaxonomyChildren = visibleChildren.length > 0;
    const hasSpecies = node.species.length > 0;
    const hasNotes = Boolean(node.anatomy) || Boolean(node.ecology);
    const canExpand = hasTaxonomyChildren || hasSpecies || hasNotes;
    const isExpanded = effectiveExpanded.has(node.key);
    const isMatched = searchState.matched.has(node.key);
    const isFocus = Boolean(focusCode && node.code === focusCode);
    const childCount = visibleChildren.length + node.species.length;

    return (
      <div key={node.key} className="relative flex items-start">
        <div
          data-taxon-code={node.code ?? undefined}
          className="relative shrink-0"
        >
          <button
            type="button"
            disabled={!canExpand}
            aria-expanded={canExpand ? isExpanded : undefined}
            onClick={() => toggleNode(node.key)}
            className={`flex min-h-[56px] w-[210px] items-center gap-1.5 rounded-2xl border px-2 py-2 text-left transition-colors ${
              isFocus
                ? 'border-amber-300 bg-amber-50/80 ring-2 ring-amber-300/60 dark:border-amber-500/40 dark:bg-amber-500/10'
                : isMatched
                  ? 'border-[#0E86A8]/40 bg-[#0E86A8]/[0.06] dark:border-[#22D3EE]/30 dark:bg-[#22D3EE]/10'
                  : 'border-[#E2EBF0] bg-white hover:border-[#0B4F71]/30 hover:bg-[#F6F9FB] dark:border-[#1E354A] dark:bg-[#102030] dark:hover:border-[#38BDF8]/30 dark:hover:bg-[#132636]'
            } ${canExpand ? '' : 'cursor-default'}`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#52667A] dark:text-[#94A3B8]">
              {canExpand ? (
                isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                )
              ) : (
                <span
                  className="block h-1.5 w-1.5 rounded-full bg-current opacity-50"
                  aria-hidden="true"
                />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span
                  className={`shrink-0 rounded-md border px-1 py-0.5 text-[9px] font-semibold ${LEVEL_BADGE_CLASS[node.level]}`}
                >
                  {LEVEL_LABELS[node.level]}
                </span>
                <span className="truncate text-[11px] font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                  {node.name}
                </span>
              </span>
              {node.latin ? (
                <span className="mt-0.5 block truncate text-[9px] italic text-[#52667A] dark:text-[#94A3B8]">
                  {node.latin}
                </span>
              ) : null}
              {node.code ? (
                <span className="mt-0.5 block truncate font-mono text-[8.5px] tabular-nums text-[#52667A]/80 dark:text-[#94A3B8]/80">
                  {node.code}
                </span>
              ) : null}
            </span>

            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                node.count > 0
                  ? 'bg-[#0B4F71]/10 text-[#0B4F71] dark:bg-[#38BDF8]/15 dark:text-[#38BDF8]'
                  : 'bg-[#E2EBF0]/60 text-[#94A3B8] dark:bg-[#1E354A]/60 dark:text-[#52667A]'
              }`}
              title={`包含 ${node.count} 种已收录物种`}
            >
              {node.count}
            </span>
          </button>

          {isExpanded && hasNotes ? (
            <div className="mt-1.5 w-[210px] space-y-1.5 rounded-2xl border border-[#E2EBF0] bg-[#F6F9FB]/80 p-2 dark:border-[#1E354A] dark:bg-[#0B1824]/70">
              {node.anatomy ? (
                <div>
                  <p className="flex items-center gap-1 text-[9px] font-semibold text-[#0B4F71] dark:text-[#38BDF8]">
                    <Microscope className="h-3 w-3" aria-hidden="true" />
                    解剖特征
                  </p>
                  <p className="mt-0.5 text-[10px] leading-4 text-[#52667A] dark:text-[#CBD5E1]">
                    {node.anatomy}
                  </p>
                </div>
              ) : null}
              {node.ecology ? (
                <div>
                  <p className="flex items-center gap-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
                    <Leaf className="h-3 w-3" aria-hidden="true" />
                    生态习性
                  </p>
                  <p className="mt-0.5 text-[10px] leading-4 text-[#52667A] dark:text-[#CBD5E1]">
                    {node.ecology}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {isExpanded && childCount > 0 ? (
          <div className="hf-trap-in relative ml-6 flex flex-col">
            <span
              aria-hidden="true"
              className="absolute -left-6 top-7 h-px w-6 bg-[#C9D9E2] dark:bg-[#1E354A]"
            />
            {node.species.map((species, index) => (
              <AtlasBranchRow
                key={`species:${species.id}`}
                isFirst={index === 0}
                isLast={index === childCount - 1}
              >
                {renderSpeciesLeaf(species)}
              </AtlasBranchRow>
            ))}
            {visibleChildren.map((child, index) => {
              const offset = node.species.length + index;
              return (
                <AtlasBranchRow
                  key={child.key}
                  isFirst={offset === 0}
                  isLast={offset === childCount - 1}
                >
                  {renderAtlasNode(child)}
                </AtlasBranchRow>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-3">
        <div className="hf-card h-24 animate-pulse bg-white/60 dark:bg-[#102030]/60" />
        <div className="hf-card h-72 animate-pulse bg-white/60 dark:bg-[#102030]/60" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-6xl rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
        <p className="font-semibold">数据加载失败</p>
        <p className="mt-1 text-xs leading-5">
          {error ?? '离线数据不可用，请刷新重试。'}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl pb-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#0E86A8] dark:text-[#22D3EE]">
            <Network className="h-3.5 w-3.5" aria-hidden="true" />
            演化图谱与防坑专题
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#0F172A] dark:text-[#F1F5F9] sm:text-2xl">
            从分类谱系看懂鱼市亲缘
          </h1>
        </div>
        <p className="text-[11px] text-[#52667A] dark:text-[#94A3B8]">
          <span className="tabular-nums">{data.meta.taxonomy_count}</span> 个分类节点 ·{' '}
          <span className="tabular-nums">{data.meta.total_species}</span> 种已收录
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl border border-[#E2EBF0] bg-white p-1 dark:border-[#1E354A] dark:bg-[#102030]">
        <button
          type="button"
          onClick={() => selectTab('tree')}
          aria-pressed={tab === 'tree'}
          className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors ${
            tab === 'tree'
              ? 'bg-[#0B4F71] text-white dark:bg-[#38BDF8] dark:text-[#07131F]'
              : 'text-[#52667A] hover:bg-[#0B4F71]/5 dark:text-[#94A3B8] dark:hover:bg-[#38BDF8]/10'
          }`}
        >
          <Network className="h-3.5 w-3.5" aria-hidden="true" />
          生物分类谱系树
        </button>
        <button
          type="button"
          onClick={() => selectTab('traps')}
          aria-pressed={tab === 'traps'}
          className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors ${
            tab === 'traps'
              ? 'bg-[#0B4F71] text-white dark:bg-[#38BDF8] dark:text-[#07131F]'
              : 'text-[#52667A] hover:bg-[#0B4F71]/5 dark:text-[#94A3B8] dark:hover:bg-[#38BDF8]/10'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          菜场防坑辨伪专题
        </button>
      </div>

      {tab === 'tree' ? (
        <section className="mt-3 rounded-3xl border border-[#E2EBF0] bg-white p-3 dark:border-[#1E354A] dark:bg-[#102030]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#52667A] dark:text-[#94A3B8]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索分类中文/拉丁名、编码、解剖生态注释或物种名…"
                aria-label="在分类树中搜索"
                className="hf-input h-10 pl-9 pr-16 text-xs"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 h-7 -translate-y-1/2 rounded-full px-2 text-[10px] font-semibold text-[#52667A] hover:bg-[#0B4F71]/10 dark:text-[#94A3B8] dark:hover:bg-[#38BDF8]/10"
                >
                  清除
                </button>
              ) : null}
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={onlyLoaded}
              onClick={() => setOnlyLoaded((value) => !value)}
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[#E2EBF0] bg-[#F6F9FB] px-2.5 py-1.5 text-[11px] font-semibold text-[#0F172A] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#F1F5F9]"
            >
              <span
                className={`relative h-4 w-8 rounded-full transition-colors ${
                  onlyLoaded
                    ? 'bg-[#0B4F71] dark:bg-[#38BDF8]'
                    : 'bg-[#E2EBF0] dark:bg-[#1E354A]'
                }`}
                aria-hidden="true"
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all dark:bg-[#09131D] ${
                    onlyLoaded ? 'left-4' : 'left-0.5'
                  }`}
                />
              </span>
              仅看已收录物种
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl border border-[#E2EBF0] bg-[#F6F9FB] p-1 dark:border-[#1E354A] dark:bg-[#0B1824]">
            <button
              type="button"
              aria-pressed={view === 'diagram'}
              onClick={() => setView('diagram')}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors ${
                view === 'diagram'
                  ? 'bg-[#0B4F71] text-white dark:bg-[#38BDF8] dark:text-[#07131F]'
                  : 'text-[#52667A] hover:bg-[#0B4F71]/5 dark:text-[#94A3B8] dark:hover:bg-[#38BDF8]/10'
              }`}
            >
              <ListTree className="h-3.5 w-3.5" aria-hidden="true" />
              树状图
            </button>
            <button
              type="button"
              aria-pressed={view === 'table'}
              onClick={() => setView('table')}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors ${
                view === 'table'
                  ? 'bg-[#0B4F71] text-white dark:bg-[#38BDF8] dark:text-[#07131F]'
                  : 'text-[#52667A] hover:bg-[#0B4F71]/5 dark:text-[#94A3B8] dark:hover:bg-[#38BDF8]/10'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
              分类表
            </button>
          </div>

          {focusCode ? (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              已定位分类节点{' '}
              <span className="font-mono tabular-nums">{focusCode}</span>
              ，并自动展开上级路径。
            </p>
          ) : null}

          {query.trim() && view === 'diagram' && !searchState.any ? (
            <p className="mt-2 rounded-xl border border-[#E2EBF0] bg-[#F6F9FB] px-2.5 py-1.5 text-[10px] text-[#52667A] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#94A3B8]">
              没有匹配的分类节点或物种，换个关键词试试。
            </p>
          ) : null}

          {query.trim() && view === 'table' && filteredGenusRows.length === 0 ? (
            <p className="mt-2 rounded-xl border border-[#E2EBF0] bg-[#F6F9FB] px-2.5 py-1.5 text-[10px] text-[#52667A] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#94A3B8]">
              没有匹配的分类属，换个关键词试试。
            </p>
          ) : null}

          {view === 'diagram' ? (
            <div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={expandLoadedBranches}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-[#E2EBF0] bg-white px-2.5 text-[10px] font-semibold text-[#0B4F71] transition-colors hover:border-[#0B4F71]/30 dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#38BDF8]"
                >
                  <ChevronDown className="h-3 w-3" aria-hidden="true" />
                  展开已收录分支
                </button>
                <button
                  type="button"
                  onClick={collapseAllBranches}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-[#E2EBF0] bg-white px-2.5 text-[10px] font-semibold text-[#52667A] transition-colors hover:border-[#0B4F71]/30 dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#94A3B8]"
                >
                  <ChevronRight className="h-3 w-3" aria-hidden="true" />
                  全部收起
                </button>
                <TableZoomControls
                  zoom={treeZoom}
                  onChange={setTreeZoom}
                  className="ml-auto"
                />
                <span className="text-[10px] text-[#94A3B8] dark:text-[#52667A]">
                  点击节点展开 / 收起，横向拖动查看深层谱系
                </span>
              </div>

              <HorizontalScrollSyncBar
                scrollRef={treeScrollRef}
                deps={[view, tree.length, treeZoom, expanded]}
                className="mt-2"
              />

              <div
                ref={treeScrollRef}
                role="group"
                aria-label="生物分类谱系树状图"
                style={{
                  touchAction: 'pan-x pan-y',
                  WebkitOverflowScrolling: 'touch',
                }}
                className="mt-2 max-h-[70dvh] min-h-[18rem] overflow-auto overscroll-contain rounded-2xl border border-[#E2EBF0] bg-[#FBFDFE] p-3 touch-pan-x touch-pan-y dark:border-[#1E354A] dark:bg-[#09131D]"
              >
                <div
                  className="relative"
                  style={{
                    width: treeNaturalSize.width
                      ? Math.ceil(treeNaturalSize.width * treeZoom)
                      : undefined,
                    height: treeNaturalSize.height
                      ? Math.ceil(treeNaturalSize.height * treeZoom)
                      : undefined,
                  }}
                >
                  <div
                    style={{
                      width: treeNaturalSize.width || undefined,
                      transform: 'scale(' + treeZoom + ')',
                      transformOrigin: 'top left',
                      willChange: 'transform',
                    }}
                  >
                    <div
                      ref={treeElementRef}
                      className="flex min-w-max flex-col gap-4"
                    >
                      {tree.map((root) => renderAtlasNode(root))}
                    </div>
                  </div>
                </div>
              </div>

              <HorizontalScrollSyncBar
                scrollRef={treeScrollRef}
                deps={[view, tree.length, treeZoom, expanded]}
                className="mt-2"
              />
            </div>
          ) : (
            <div>
              <div className="mt-2 flex items-center justify-end">
                <TableZoomControls
                  zoom={tableZoom}
                  onChange={setTableZoom}
                />
              </div>

              <HorizontalScrollSyncBar
                scrollRef={tableScrollRef}
                deps={[view, filteredGenusRows.length, tableZoom]}
                className="mt-2"
              />

              <div
                ref={tableScrollRef}
                style={{
                  touchAction: 'pan-x pan-y',
                  WebkitOverflowScrolling: 'touch',
                }}
                className="mt-2 max-h-[70dvh] min-h-[18rem] overflow-auto overscroll-contain rounded-2xl border border-[#E2EBF0] bg-white touch-pan-x touch-pan-y dark:border-[#1E354A] dark:bg-[#102030]"
              >
                <div
                  className="relative"
                  style={{
                    width: tableNaturalSize.width
                      ? Math.ceil(tableNaturalSize.width * tableZoom)
                      : undefined,
                    height: tableNaturalSize.height
                      ? Math.ceil(tableNaturalSize.height * tableZoom)
                      : undefined,
                  }}
                >
                  <div
                    style={{
                      width: tableNaturalSize.width || undefined,
                      transform: `scale(${tableZoom})`,
                      transformOrigin: 'top left',
                      willChange: 'transform',
                    }}
                  >
                    <table
                      ref={tableElementRef}
                      className="w-max min-w-full border-collapse text-left text-[11px]"
                    >
                  <thead>
                    <tr>
                      {[
                        '总目',
                        '目',
                        '科',
                        '亚科/族',
                        '属',
                        '收录物种',
                        '核心解剖与演化特征',
                        '生态习性与体型特征',
                      ].map((label, index) => (
                        <th
                          key={label}
                          scope="col"
                          style={{ minWidth: TABLE_COLUMN_MIN_WIDTHS[index] }}
                          className="sticky top-0 z-20 whitespace-nowrap border-b-2 border-r border-[#D8E4EC] border-b-[#8FB4C9] bg-[#F0F5F8] px-2.5 py-2 text-left text-[10px] font-semibold text-[#0B4F71] dark:border-[#1E354A] dark:border-b-[#345C7A] dark:bg-[#0B1824] dark:text-[#38BDF8]"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGenusRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-10 text-center text-[11px] text-[#52667A] dark:text-[#94A3B8]"
                        >
                          没有匹配的分类属，请调整关键词或关闭「仅看已收录物种」。
                        </td>
                      </tr>
                    ) : (
                      filteredGenusRows.map((row, rowIndex) => {
                        const spans = genusSpans[rowIndex];
                        const speciesCellItems = buildSpeciesCellItems(row);
                        return (
                          <tr
                            key={row.key}
                            className="transition-colors hover:bg-[#0B4F71]/[0.035] dark:hover:bg-[#38BDF8]/[0.06]"
                          >
                            {spans.superorder > 0 ? (
                              <HierarchyCell
                                node={row.superorder}
                                level="superorder"
                                rowSpan={spans.superorder}
                                groupStart
                              />
                            ) : null}
                            {spans.order > 0 ? (
                              <HierarchyCell
                                node={row.order}
                                level="order"
                                rowSpan={spans.order}
                                groupStart
                              />
                            ) : null}
                            {spans.family > 0 ? (
                              <HierarchyCell
                                node={row.family}
                                level="family"
                                rowSpan={spans.family}
                                groupStart
                              />
                            ) : null}
                            {spans.subfamily > 0 ? (
                              <HierarchyCell
                                node={row.subfamily}
                                level="subfamily"
                                rowSpan={spans.subfamily}
                                groupStart
                              />
                            ) : null}
                            <HierarchyCell
                              node={row.genus}
                              level="genus"
                              rowSpan={1}
                              groupStart
                            />

                            <td
                              data-testid="atlas-species-cell"
                              className="border-b border-r border-[#E2EBF0] px-2.5 py-2 align-top dark:border-[#1E354A]"
                            >
                              {speciesCellItems.length === 0 ? (
                                <span className="text-[10px] text-[#94A3B8] dark:text-[#52667A]">
                                  —
                                </span>
                              ) : (
                                <ul className="flex flex-col gap-1">
                                  {speciesCellItems.map((item) => (
                                    <li key={item.key}>
                                      {item.speciesId ? (
                                        <Link
                                          data-testid="atlas-species-name"
                                          to={`/species/${item.speciesId}`}
                                          className="block whitespace-normal break-words rounded-lg border border-[#E2EBF0] bg-[#F6F9FB] px-1.5 py-0.5 text-[10px] font-medium leading-4 text-[#0B4F71] transition-colors hover:border-[#0B4F71]/30 hover:bg-white dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#38BDF8]"
                                        >
                                          {item.label}
                                        </Link>
                                      ) : (
                                        <span
                                          data-testid="atlas-species-name"
                                          className="block whitespace-normal break-words rounded-lg border border-dashed border-[#D8E4EC] bg-white px-1.5 py-0.5 text-[10px] font-medium leading-4 text-[#52667A] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#CBD5E1]"
                                        >
                                          {item.label}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>

                            <td className="border-b border-r border-[#E2EBF0] px-2.5 py-2 align-top dark:border-[#1E354A]">
                              <p className="max-w-[320px] text-[10px] leading-4 text-[#52667A] dark:text-[#CBD5E1]">
                                {row.genus.anatomy_notes ?? '—'}
                              </p>
                            </td>
                            <td className="border-b border-r border-[#E2EBF0] px-2.5 py-2 align-top dark:border-[#1E354A]">
                              <p className="max-w-[320px] text-[10px] leading-4 text-[#52667A] dark:text-[#CBD5E1]">
                                {row.genus.ecology_notes ?? '—'}
                              </p>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <HorizontalScrollSyncBar
                scrollRef={tableScrollRef}
                deps={[view, filteredGenusRows.length, tableZoom]}
                className="mt-2"
              />
            </div>
          )}
        </section>
      ) : (
        <section className="mt-3 space-y-4">
          <div className="rounded-3xl border border-[#E2EBF0] bg-white p-4 dark:border-[#1E354A] dark:bg-[#102030]">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                  跨科撞名陷阱
                </h2>
                <p className="text-[11px] text-[#52667A] dark:text-[#94A3B8]">
                  市场俗名相同，血缘可能天差地别。点卡片直接进入同屏比对。
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {data.traps.cross_family_traps.map((trap) => {
              const available = trap.species_ids.filter(
                (id) => Boolean(data.speciesById[id]),
              );
              const canCompare = available.length >= 2;
              return (
                <article
                  key={`${trap.trap_index ?? trap.title}`}
                  className="flex flex-col rounded-3xl border border-[#E2EBF0] bg-white p-3.5 dark:border-[#1E354A] dark:bg-[#102030]"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[9px] font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                      {trap.module.split('\n')[0]}
                    </span>
                    {trap.trap_index !== null ? (
                      <span className="text-[9px] font-semibold tabular-nums text-[#52667A] dark:text-[#94A3B8]">
                        #{trap.trap_index}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-1.5 text-sm font-semibold leading-5 text-[#0F172A] dark:text-[#F1F5F9]">
                    {trap.title}
                  </h3>

                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {trap.aliases_trigger.map((alias) => (
                      <span
                        key={alias}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>

                  <p className="mt-1.5 text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                    涉及科：
                    {trap.families.length > 0 ? trap.families.join(' / ') : '—'}
                  </p>

                  <p className="mt-2 text-[11px] leading-5 text-[#52667A] dark:text-[#CBD5E1]">
                    {trap.truth}
                  </p>
                  {trap.tips ? (
                    <p className="mt-1.5 rounded-xl bg-[#0B4F71]/[0.045] px-2 py-1.5 text-[10px] leading-4 text-[#0B4F71] dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
                      💡 {trap.tips}
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-1">
                    {trap.species_ids.map((id) => {
                      const species = data.speciesById[id];
                      return (
                        <span
                          key={id}
                          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${
                            species
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                              : 'border-[#E2EBF0] bg-[#F6F9FB] text-[#94A3B8] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#52667A]'
                          }`}
                        >
                          {species ? (
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          ) : null}
                          {species ? species.names.zh_formal : `未收录 ${id}`}
                        </span>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={!canCompare}
                    onClick={() => enterCompare(trap.species_ids)}
                    className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#0B4F71] text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#38BDF8] dark:text-[#07131F]"
                  >
                    一键进入 VS 对比
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>

          <div className="border-t border-[#E2EBF0] pt-4 dark:border-[#1E354A]">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300">
                <Network className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                  同种 a/b 分化对照
                </h2>
                <p className="text-[11px] text-[#52667A] dark:text-[#94A3B8]">
                  同一物种的不同产地、季节或养殖品系，风味与做法可能完全不同。
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {data.traps.ab_pairs.map((pair) => {
              const ids = [pair.species_id_a, pair.species_id_b].filter(
                (id): id is string => Boolean(id),
              );
              const available = ids.filter((id) => Boolean(data.speciesById[id]));
              const canCompare = available.length >= 2;
              return (
                <article
                  key={`${pair.pair_index ?? pair.name_zh}-${pair.name_zh}`}
                  className="flex flex-col rounded-3xl border border-[#E2EBF0] bg-white p-3.5 dark:border-[#1E354A] dark:bg-[#102030]"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[9px] font-semibold text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300">
                      a/b 配对 #{pair.pair_index ?? '—'}
                    </span>
                    <span className="text-[9px] font-medium text-[#52667A] dark:text-[#94A3B8]">
                      {pair.family}
                    </span>
                  </div>

                  <h3 className="mt-1.5 text-sm font-semibold leading-5 text-[#0F172A] dark:text-[#F1F5F9]">
                    {pair.name_zh}
                  </h3>

                  <p className="mt-2 text-[11px] leading-5 text-[#52667A] dark:text-[#CBD5E1]">
                    {pair.difference}
                  </p>
                  {pair.usage_tips ? (
                    <p className="mt-1.5 rounded-xl bg-[#0B4F71]/[0.045] px-2 py-1.5 text-[10px] leading-4 text-[#0B4F71] dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
                      💡 {pair.usage_tips}
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-1">
                    {ids.map((id) => {
                      const species = data.speciesById[id];
                      return (
                        <span
                          key={id}
                          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${
                            species
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                              : 'border-[#E2EBF0] bg-[#F6F9FB] text-[#94A3B8] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#52667A]'
                          }`}
                        >
                          {species ? (
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          ) : null}
                          {species ? species.names.zh_formal : `未收录 ${id}`}
                        </span>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={!canCompare}
                    onClick={() => enterCompare(ids)}
                    className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#0B4F71] text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#38BDF8] dark:text-[#07131F]"
                  >
                    一键进入 VS 对比
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}