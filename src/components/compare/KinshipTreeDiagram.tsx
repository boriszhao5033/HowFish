import { useMemo } from 'react';

import {
  CATEGORY_LABELS,
  type SpeciesRecord,
  type TaxonomyLevel,
  type TaxonomyNode,
} from '../../types/schema';

export type ComparisonNodeKind =
  | 'root'
  | 'category'
  | TaxonomyLevel
  | 'species';

export type SharedTaxonomyLevel =
  | 'species'
  | TaxonomyLevel
  | 'category'
  | 'none';

export interface ComparisonTreeNode {
  key: string;
  kind: ComparisonNodeKind;
  code: string | null;
  name: string;
  latin: string | null;
  children: ComparisonTreeNode[];
  speciesCount: number;
  species: SpeciesRecord | null;
}

export interface ComparisonDivergence {
  key: string;
  kind: ComparisonNodeKind;
  level: ComparisonNodeKind;
  code: string | null;
  name: string;
  latin: string | null;
  summary: string;
  sharedLevel: SharedTaxonomyLevel;
}

export interface ComparisonTreeResult {
  root: ComparisonTreeNode;
  leaves: ComparisonTreeNode[];
  divergence: ComparisonDivergence;
  summary: string;
  speciesIds: string[];
}

interface NodeSeed {
  key: string;
  kind: ComparisonNodeKind;
  code: string | null;
  name: string;
  latin: string | null;
}

export const COMPARISON_KIND_LABELS: Record<ComparisonNodeKind, string> = {
  root: '谱系',
  category: '大类',
  superorder: '总目',
  order: '目',
  family: '科',
  subfamily: '亚科/族',
  genus: '属',
  species: '种',
};

const TAXONOMY_PATH_LEVELS: TaxonomyLevel[] = [
  'superorder',
  'order',
  'family',
  'subfamily',
  'genus',
];

export function shortenTaxonName(name: string): string {
  const trimmed = name.trim();
  const cut = trimmed.search(/[（(]/);
  return cut > 0 ? trimmed.slice(0, cut).trim() : trimmed;
}

function createNode(seed: NodeSeed): ComparisonTreeNode {
  return {
    key: seed.key,
    kind: seed.kind,
    code: seed.code,
    name: seed.name,
    latin: seed.latin,
    children: [],
    speciesCount: 0,
    species: null,
  };
}

function buildLineage(
  species: SpeciesRecord,
  taxonomyByCode: Record<string, TaxonomyNode>,
  includeSubfamily: boolean,
): NodeSeed[] {
  const steps: NodeSeed[] = [
    {
      key: `category:${species.category}`,
      kind: 'category',
      code: species.category,
      name: CATEGORY_LABELS[species.category],
      latin: null,
    },
  ];

  const codes = species.taxon_codes;
  if (codes) {
    for (const level of TAXONOMY_PATH_LEVELS) {
      if (level === 'subfamily' && !includeSubfamily) {
        continue;
      }
      const code = codes[level];
      if (!code) {
        continue;
      }
      const node = taxonomyByCode[code];
      if (!node) {
        continue;
      }
      steps.push({
        key: `taxon:${node.code}`,
        kind: node.level,
        code: node.code,
        name: node.name_zh,
        latin: node.name_latin,
      });
    }
  }

  steps.push({
    key: `species:${species.id}`,
    kind: 'species',
    code: species.id,
    name: shortenTaxonName(species.names.zh_formal),
    latin: species.names.latin,
  });

  return steps;
}

function collectLeaves(node: ComparisonTreeNode, output: ComparisonTreeNode[]): void {
  if (node.kind === 'species') {
    output.push(node);
    return;
  }
  for (const child of node.children) {
    collectLeaves(child, output);
  }
}

function findDeepestBranch(root: ComparisonTreeNode): ComparisonTreeNode {
  let cursor = root;
  while (cursor.children.length === 1) {
    cursor = cursor.children[0];
  }
  return cursor;
}

function detectSharedLevel(species: SpeciesRecord[]): SharedTaxonomyLevel {
  if (species.length === 0) {
    return 'none';
  }
  if (
    species.length > 1 &&
    new Set(species.map((item) => item.id.slice(0, 13))).size === 1
  ) {
    return 'species';
  }

  if (new Set(species.map((item) => item.category)).size > 1) {
    return 'none';
  }

  const levels: TaxonomyLevel[] = ['genus', 'family', 'order', 'superorder'];
  for (const level of levels) {
    const codes = species.map((item) => item.taxon_codes?.[level] ?? '');
    if (codes.every(Boolean) && new Set(codes).size === 1) {
      return level;
    }
  }

  return 'category';
}

function buildSummary(
  species: SpeciesRecord[],
  divergence: ComparisonTreeNode,
): string {
  if (species.length === 0) {
    return '暂无可对比物种';
  }

  const sameBase =
    species.length > 1 &&
    new Set(species.map((item) => item.id.slice(0, 13))).size === 1;

  if (sameBase) {
    return `同种 a/b 分化（${shortenTaxonName(species[0].names.zh_formal)}）`;
  }

  switch (divergence.kind) {
    case 'genus':
      return `同属分叉（${divergence.name}）`;
    case 'family':
    case 'subfamily':
    case 'order':
    case 'superorder':
      return `在「${divergence.name}」分叉`;
    case 'category':
      return `跨总目/大类分叉（${divergence.name}）`;
    case 'root': {
      const categories = Array.from(
        new Set(species.map((item) => CATEGORY_LABELS[item.category])),
      );
      return `跨大类分叉（${categories.join(' / ')}）`;
    }
    case 'species':
      return `同种记录（${divergence.name}）`;
    default:
      return '分类关系待确认';
  }
}

/**
 * Build the minimal pruned taxonomy tree for 2-3 compared species.
 *
 * The tree always reads Root(海产谱系) -> 大类 -> 总目 -> 目 -> 科 ->
 * 亚科/族 -> 属 -> 种(leaf). Missing taxonomy nodes are skipped so the
 * remaining lineage stays readable instead of showing holes.
 */
export function buildComparisonTree(
  speciesList: SpeciesRecord[],
  taxonomyByCode: Record<string, TaxonomyNode>,
): ComparisonTreeResult {
  const uniqueSpecies: SpeciesRecord[] = [];
  const seenIds = new Set<string>();

  for (const species of speciesList) {
    if (!species || seenIds.has(species.id)) {
      continue;
    }
    seenIds.add(species.id);
    uniqueSpecies.push(species);
  }

  const root: ComparisonTreeNode = {
    key: 'lineage:root',
    kind: 'root',
    code: null,
    name: '海产谱系',
    latin: null,
    children: [],
    speciesCount: 0,
    species: null,
  };

  const includeSubfamily =
    new Set(
      uniqueSpecies.map((item) => item.taxon_codes?.subfamily ?? ''),
    ).size > 1;

  for (const species of uniqueSpecies) {
    root.speciesCount += 1;
    let cursor = root;

    for (const seed of buildLineage(species, taxonomyByCode, includeSubfamily)) {
      let child = cursor.children.find((item) => item.key === seed.key);
      if (!child) {
        child = createNode(seed);
        cursor.children.push(child);
      }
      child.speciesCount += 1;
      if (seed.kind === 'species') {
        child.species = species;
      }
      cursor = child;
    }
  }

  const leaves: ComparisonTreeNode[] = [];
  collectLeaves(root, leaves);

  const divergenceNode = findDeepestBranch(root);
  const summary = buildSummary(uniqueSpecies, divergenceNode);

  return {
    root,
    leaves,
    divergence: {
      key: divergenceNode.key,
      kind: divergenceNode.kind,
      level: divergenceNode.kind,
      code: divergenceNode.code,
      name: divergenceNode.name,
      latin: divergenceNode.latin,
      summary,
      sharedLevel: detectSharedLevel(uniqueSpecies),
    },
    summary,
    speciesIds: uniqueSpecies.map((item) => item.id),
  };
}

const NODE_WIDTH = 156;
const NODE_HEIGHT = 50;
const LEAF_GAP = 196;
const ROW_HEIGHT = 76;
const MARGIN_X = 36;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 28;

const TRUNK_EDGE_CLASS = 'stroke-[#0B4F71] dark:stroke-[#38BDF8]';
const BRANCH_EDGE_CLASS = [
  'stroke-[#0F766E] dark:stroke-[#2DD4BF]',
  'stroke-[#059669] dark:stroke-[#34D399]',
  'stroke-[#6D28D9] dark:stroke-[#A78BFA]',
];

const KIND_TEXT_CLASS: Record<ComparisonNodeKind, string> = {
  root: 'fill-[#0B4F71] dark:fill-[#38BDF8]',
  category: 'fill-[#0E86A8] dark:fill-[#22D3EE]',
  superorder: 'fill-[#7E22CE] dark:fill-[#C084FC]',
  order: 'fill-[#0369A1] dark:fill-[#7DD3FC]',
  family: 'fill-[#047857] dark:fill-[#6EE7B7]',
  subfamily: 'fill-[#0F766E] dark:fill-[#5EEAD4]',
  genus: 'fill-[#B45309] dark:fill-[#FBBF24]',
  species: 'fill-[#0F172A] dark:fill-[#F1F5F9]',
};

const KIND_ACCENT_CLASS: Record<ComparisonNodeKind, string> = {
  root: 'fill-[#0B4F71] dark:fill-[#38BDF8]',
  category: 'fill-[#0E86A8] dark:fill-[#22D3EE]',
  superorder: 'fill-[#7E22CE] dark:fill-[#C084FC]',
  order: 'fill-[#0369A1] dark:fill-[#7DD3FC]',
  family: 'fill-[#047857] dark:fill-[#6EE7B7]',
  subfamily: 'fill-[#0F766E] dark:fill-[#5EEAD4]',
  genus: 'fill-[#B45309] dark:fill-[#FBBF24]',
  species: 'fill-[#0F172A] dark:fill-[#F1F5F9]',
};

interface LaidOutNode {
  node: ComparisonTreeNode;
  x: number;
  y: number;
  depth: number;
  branchIndex: number;
  children: LaidOutNode[];
}

interface TreeEdge {
  parent: LaidOutNode;
  child: LaidOutNode;
}

interface TreeLayout {
  nodes: LaidOutNode[];
  edges: TreeEdge[];
  width: number;
  height: number;
  leafCount: number;
}

function truncateSvgLabel(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

function layoutComparisonTree(
  root: ComparisonTreeNode,
  divergenceKey: string,
): TreeLayout {
  let leafCursor = 0;
  let maxDepth = 0;

  const build = (
    node: ComparisonTreeNode,
    depth: number,
    branchIndex: number,
  ): LaidOutNode => {
    maxDepth = Math.max(maxDepth, depth);
    const item: LaidOutNode = {
      node,
      x: 0,
      y: MARGIN_TOP + depth * ROW_HEIGHT,
      depth,
      branchIndex,
      children: [],
    };

    if (node.children.length === 0) {
      item.x = MARGIN_X + NODE_WIDTH / 2 + leafCursor * LEAF_GAP;
      leafCursor += 1;
      return item;
    }

    item.children = node.children.map((child, index) =>
      build(
        child,
        depth + 1,
        node.key === divergenceKey ? index : branchIndex,
      ),
    );
    item.x =
      item.children.reduce((sum, child) => sum + child.x, 0) /
      item.children.length;
    return item;
  };

  const rootItem = build(root, 0, -1);
  const nodes: LaidOutNode[] = [];
  const edges: TreeEdge[] = [];

  const visit = (item: LaidOutNode) => {
    nodes.push(item);
    for (const child of item.children) {
      edges.push({ parent: item, child });
      visit(child);
    }
  };

  visit(rootItem);

  const leafCount = Math.max(leafCursor, 1);
  const width = MARGIN_X * 2 + NODE_WIDTH + (leafCount - 1) * LEAF_GAP;
  const height =
    MARGIN_TOP + maxDepth * ROW_HEIGHT + NODE_HEIGHT + MARGIN_BOTTOM;

  return { nodes, edges, width, height, leafCount };
}

function edgePath(parent: LaidOutNode, child: LaidOutNode): string {
  const startX = parent.x;
  const startY = parent.y + NODE_HEIGHT;
  const endX = child.x;
  const endY = child.y;
  const midY = startY + (endY - startY) / 2;
  return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
}

function SvgTreeNode({
  item,
  divergenceKey,
}: {
  item: LaidOutNode;
  divergenceKey: string;
}) {
  const { node } = item;
  const left = item.x - NODE_WIDTH / 2;
  const top = item.y;
  const isDivergence = node.key === divergenceKey;
  const isSpecies = node.kind === 'species';
  const name = truncateSvgLabel(node.name, isSpecies ? 9 : 10);
  const codeText = node.code ?? '';

  return (
    <g>
      {isDivergence ? (
        <>
          <rect
            x={left - 6}
            y={top - 6}
            width={NODE_WIDTH + 12}
            height={NODE_HEIGHT + 12}
            rx={16}
            className="fill-none stroke-[#D97706] dark:stroke-[#FBBF24]"
            strokeWidth={2.2}
            strokeDasharray="6 4"
          />
          <rect
            x={item.x - 36}
            y={top - 28}
            width={72}
            height={19}
            rx={9.5}
            className="fill-[#FEF3C7] dark:fill-[#422006]"
          />
          <text
            x={item.x}
            y={top - 14}
            textAnchor="middle"
            fontSize={9}
            fontWeight={700}
            className="fill-[#B45309] dark:fill-[#FCD34D]"
          >
            分叉点
          </text>
        </>
      ) : null}

      <rect
        x={left}
        y={top}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={12}
        className="fill-white stroke-[#D8E4EC] dark:fill-[#102030] dark:stroke-[#25415A]"
        strokeWidth={1.2}
      />
      <rect
        x={left}
        y={top}
        width={4}
        height={NODE_HEIGHT}
        rx={2}
        className={KIND_ACCENT_CLASS[node.kind]}
      />
      <text
        x={left + 14}
        y={top + 17}
        fontSize={8.5}
        fontWeight={700}
        letterSpacing={0.5}
        className={KIND_TEXT_CLASS[node.kind]}
      >
        {COMPARISON_KIND_LABELS[node.kind]}
      </text>
      <text
        x={left + 14}
        y={top + 32}
        fontSize={11}
        fontWeight={600}
        className="fill-[#0F172A] dark:fill-[#F1F5F9]"
      >
        {name}
      </text>
      <text
        x={left + 14}
        y={top + 45}
        fontSize={isSpecies ? 8.5 : 8}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
        className="fill-[#52667A] dark:fill-[#94A3B8]"
      >
        {codeText}
      </text>
    </g>
  );
}

export interface KinshipTreeDiagramProps {
  speciesList: SpeciesRecord[];
  taxonomyByCode: Record<string, TaxonomyNode>;
}

const BRANCH_DOT_CLASS = [
  'bg-[#0F766E] dark:bg-[#2DD4BF]',
  'bg-[#059669] dark:bg-[#34D399]',
  'bg-[#6D28D9] dark:bg-[#A78BFA]',
];

export function KinshipTreeDiagram({
  speciesList,
  taxonomyByCode,
}: KinshipTreeDiagramProps) {
  const result = useMemo(
    () => buildComparisonTree(speciesList, taxonomyByCode),
    [speciesList, taxonomyByCode],
  );
  const layout = useMemo(
    () => layoutComparisonTree(result.root, result.divergence.key),
    [result],
  );
  const leafBranchByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of layout.nodes) {
      if (item.node.kind === 'species') {
        map.set(item.node.key, item.branchIndex);
      }
    }
    return map;
  }, [layout]);

  if (speciesList.length < 2) {
    return null;
  }

  return (
    <section className="mt-3 overflow-hidden rounded-3xl border border-[#E2EBF0] bg-white dark:border-[#1E354A] dark:bg-[#102030]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E2EBF0] bg-[#F6F9FB]/70 px-3 py-2 dark:border-[#1E354A] dark:bg-[#0B1824]/70">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0B4F71]/20 bg-[#0B4F71]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0B4F71] dark:border-[#38BDF8]/30 dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
          <span
            className="h-1.5 w-1.5 rounded-full bg-current"
            aria-hidden="true"
          />
          分类关系树
        </span>
        <span className="text-[11px] font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
          {result.summary}
        </span>
        <span className="ml-auto text-[10px] text-[#52667A] dark:text-[#94A3B8]">
          LCA：{result.divergence.name}
        </span>
      </div>

      <div className="overflow-x-auto px-2 pb-1 pt-3">
        <svg
          role="img"
          aria-label="物种生物学分类关系图"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          preserveAspectRatio="xMidYMin meet"
          className="mx-auto h-auto w-full min-w-[400px]"
          style={{
            aspectRatio: `${layout.width} / ${layout.height}`,
            maxWidth: `${layout.width + 24}px`,
          }}
        >
          <title>物种生物学分类关系图</title>
          <desc>{result.summary}</desc>

          {layout.edges.map((edge) => {
            const branch = edge.child.branchIndex;
            return (
              <path
                key={`${edge.parent.node.key}->${edge.child.node.key}`}
                d={edgePath(edge.parent, edge.child)}
                fill="none"
                strokeLinecap="round"
                strokeWidth={branch >= 0 ? 2.4 : 2}
                strokeOpacity={branch >= 0 ? 0.95 : 0.6}
                className={
                  branch >= 0
                    ? BRANCH_EDGE_CLASS[
                        branch % BRANCH_EDGE_CLASS.length
                      ]
                    : TRUNK_EDGE_CLASS
                }
              />
            );
          })}

          {layout.nodes.map((item) => (
            <SvgTreeNode
              key={item.node.key}
              item={item}
              divergenceKey={result.divergence.key}
            />
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#E2EBF0] px-3 py-2 text-[10px] text-[#52667A] dark:border-[#1E354A] dark:text-[#94A3B8]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-0.5 w-5 rounded-full bg-[#0B4F71] dark:bg-[#38BDF8]"
            aria-hidden="true"
          />
          共同祖先主干
        </span>
        {result.leaves.map((leaf, index) => {
          const branch = leafBranchByKey.get(leaf.key) ?? index;
          return (
            <span key={leaf.key} className="inline-flex items-center gap-1.5">
              <span
                className={`h-0.5 w-5 rounded-full ${
                  branch >= 0
                    ? BRANCH_DOT_CLASS[
                        branch % BRANCH_DOT_CLASS.length
                      ]
                    : 'bg-[#0B4F71] dark:bg-[#38BDF8]'
                }`}
                aria-hidden="true"
              />
              {leaf.name}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-[#D97706] dark:border-[#FBBF24]"
            aria-hidden="true"
          />
          分叉点 · {result.divergence.name}
        </span>
      </div>
    </section>
  );
}