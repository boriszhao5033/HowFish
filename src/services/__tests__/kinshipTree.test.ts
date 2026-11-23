import { describe, expect, it } from 'vitest';

import speciesJson from '../../../public/data/species.json';
import taxonomyJson from '../../../public/data/taxonomy.json';
import {
  buildComparisonTree,
  type ComparisonTreeNode,
} from '../../components/compare/KinshipTreeDiagram';
import type {
  SpeciesRecord,
  TaxonomyNode,
  TaxonomyPayload,
} from '../../types/schema';

const species = speciesJson as unknown as SpeciesRecord[];
const taxonomy = taxonomyJson as unknown as TaxonomyPayload;

const taxonomyByCode: Record<string, TaxonomyNode> = {};
for (const node of taxonomy.nodes) {
  taxonomyByCode[node.code] = node;
}

function speciesById(id: string): SpeciesRecord {
  const found = species.find((item) => item.id === id);
  if (!found) {
    throw new Error(`Missing test species ${id}`);
  }
  return found;
}

function walkNodes(
  node: ComparisonTreeNode,
  visit: (item: ComparisonTreeNode) => void,
): void {
  visit(node);
  for (const child of node.children) {
    walkNodes(child, visit);
  }
}

describe('buildComparisonTree', () => {
  it('places a/b variants under their shared genus and labels the same-species split', () => {
    const tree = buildComparisonTree(
      [speciesById('FI00000010001a'), speciesById('FI00000010001b')],
      taxonomyByCode,
    );

    expect(tree.leaves).toHaveLength(2);
    expect(tree.speciesIds).toEqual([
      'FI00000010001a',
      'FI00000010001b',
    ]);
    expect(tree.divergence.name).toBe('马鲛属');
    expect(tree.divergence.level).toBe('genus');
    expect(tree.divergence.sharedLevel).toBe('species');
    expect(tree.summary).toContain('同种 a/b 分化');
    expect(tree.summary).toContain('蓝点马鲛');
  });

  it('locates same-genus siblings at the genus node', () => {
    const tree = buildComparisonTree(
      [speciesById('FI00000000001'), speciesById('FI00000000002')],
      taxonomyByCode,
    );

    expect(tree.leaves).toHaveLength(2);
    expect(tree.divergence.name).toBe('鲐属');
    expect(tree.divergence.level).toBe('genus');
    expect(tree.divergence.sharedLevel).toBe('genus');
    expect(tree.summary).toBe('同属分叉（鲐属）');
  });

  it('lifts the LCA to the shared family for 油鱼 vs Gemfish', () => {
    const tree = buildComparisonTree(
      [speciesById('FI00000500001'), speciesById('FI00000510101')],
      taxonomyByCode,
    );

    expect(tree.leaves).toHaveLength(2);
    expect(tree.divergence.name).toBe('蛇鲭科');
    expect(tree.divergence.level).toBe('family');
    expect(tree.divergence.sharedLevel).toBe('family');
    expect(tree.summary).toBe('在「蛇鲭科」分叉');
  });

  it('reports a cross-superorder split when only the category is shared', () => {
    const tree = buildComparisonTree(
      [speciesById('FI00100200001'), speciesById('FI03010000001')],
      taxonomyByCode,
    );

    expect(tree.leaves).toHaveLength(2);
    expect(tree.divergence.level).toBe('category');
    expect(tree.divergence.name).toBe('鱼类');
    expect(tree.divergence.sharedLevel).toBe('category');
    expect(tree.summary).toContain('跨总目/大类分叉');
    expect(tree.summary).toContain('鱼类');
  });

  it('keeps all three leaves while pruning unrelated taxonomy branches', () => {
    const input = [
      speciesById('FI00000000001'),
      speciesById('FI00000000002'),
      speciesById('FI00000010001a'),
    ];
    const tree = buildComparisonTree(input, taxonomyByCode);

    const leafIds = tree.leaves
      .map((leaf) => leaf.species?.id)
      .filter((id): id is string => Boolean(id));

    expect(tree.leaves).toHaveLength(3);
    expect(new Set(leafIds)).toEqual(new Set(input.map((item) => item.id)));
    expect(tree.divergence.name).toBe('鲭科');
    expect(tree.divergence.level).toBe('family');
    expect(tree.root.speciesCount).toBe(3);

    const visitedKeys = new Set<string>();
    const visitedNames = new Set<string>();
    walkNodes(tree.root, (node) => {
      visitedKeys.add(node.key);
      visitedNames.add(node.name);
      expect(node.speciesCount).toBeGreaterThan(0);
      expect(node.speciesCount).toBeLessThanOrEqual(3);
    });

    expect(visitedNames.has('鲭科')).toBe(true);
    expect(visitedNames.has('马鲛属')).toBe(true);
    expect(visitedNames.has('鲐属')).toBe(true);
    expect(visitedNames.has('蛇鲭科')).toBe(false);
    expect(visitedNames.has('银鱼科')).toBe(false);
    expect(visitedKeys.size).toBeLessThan(taxonomy.nodes.length);
  });
});