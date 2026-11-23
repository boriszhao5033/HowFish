import { beforeEach, describe, expect, it } from 'vitest';

import { useAppStore } from '../../store/useAppStore';
import {
  diagnoseKinship,
  migrateIdList,
  migrateRecordMap,
  resolveRedirectId,
} from '../kinship';

describe('diagnoseKinship 11-digit lineage slices', () => {
  it('detects the same record', () => {
    const result = diagnoseKinship('FI00000000001', 'FI00000000001');
    expect(result.kind).toBe('same_record');
  });

  it('detects a/b variants that share the same 13-char base code', () => {
    const result = diagnoseKinship('FI03000000001a', 'FI03000000001b');
    expect(result.kind).toBe('same_species_ab');
    expect(result.matchedPrefixLength).toBe(13);
  });

  it('detects same-genus siblings sharing 11 characters', () => {
    const result = diagnoseKinship('FI00000000001', 'FI00000000002');
    expect(result.kind).toBe('same_genus');
    expect(result.matchedPrefixLength).toBe(11);
  });

  it('detects same-family relatives sharing 8 characters', () => {
    const result = diagnoseKinship('FI00000000001', 'FI00000010001a');
    expect(result.kind).toBe('same_family');
    expect(result.matchedPrefixLength).toBe(8);
  });

  it('detects different categories from the first 2 characters', () => {
    const result = diagnoseKinship('FI00000000001', 'CR00000000001');
    expect(result.kind).toBe('different_category');
    expect(result.matchedPrefixLength).toBe(0);
  });

  it('warns about same-category cross-family species', () => {
    const result = diagnoseKinship('FI00000500001', 'FI00040100001');
    expect(result.kind).toBe('cross_family');
    expect(result.matchedPrefixLength).toBe(2);
  });
});

describe('redirect resolution and migration', () => {
  const chain = { A: 'B', B: 'C', C: 'D' };

  it('follows a multi-hop A -> B -> C -> D chain', () => {
    expect(resolveRedirectId('A', chain)).toBe('D');
    expect(resolveRedirectId('D', chain)).toBe('D');
  });

  it('stops safely when a redirect cycle exists', () => {
    const cycle = { A: 'B', B: 'A' };
    expect(resolveRedirectId('A', cycle)).toBe('A');
    expect(migrateIdList(['A'], cycle)).toEqual(['A']);
  });

  it('migrates lists, removes duplicates and preserves order', () => {
    const simple = { A: 'B', B: 'C' };
    expect(migrateIdList(['B', 'A', 'D', 'B', ''], simple)).toEqual([
      'C',
      'D',
    ]);
  });

  it('migrates record maps and merges collisions', () => {
    const mapped = migrateRecordMap(
      { A: 'alpha', C: 'gamma' },
      { A: 'B', B: 'C', C: 'D' },
      (left, right) => `${left}+${right}`,
    );
    expect(mapped).toEqual({ D: 'alpha+gamma' });
  });
});

describe('useAppStore.applyRedirects', () => {
  beforeEach(() => {
    useAppStore.setState({
      favorites: [],
      userTags: {},
      userNotes: {},
      compareIds: [],
    });
  });

  it('migrates favorites, notes, tags and compareIds through redirects', () => {
    useAppStore.setState({
      favorites: ['OLD', 'KEEP'],
      userTags: { OLD: ['常买'], KEEP: ['想试'] },
      userNotes: { OLD: '旧笔记', KEEP: '保留笔记' },
      compareIds: ['OLD'],
    });

    const changes = useAppStore
      .getState()
      .applyRedirects({ OLD: 'MID', MID: 'NEW' });
    const state = useAppStore.getState();

    expect(state.favorites).toEqual(['NEW', 'KEEP']);
    expect(state.userTags.NEW).toEqual(['常买']);
    expect(state.userTags.OLD).toBeUndefined();
    expect(state.userNotes.NEW).toBe('旧笔记');
    expect(state.userNotes.OLD).toBeUndefined();
    expect(state.compareIds).toEqual(['NEW']);
    expect(changes).toBe(4);
  });

  it('is a no-op when redirects are empty', () => {
    useAppStore.setState({ favorites: ['KEEP'] });
    expect(useAppStore.getState().applyRedirects({})).toBe(0);
    expect(useAppStore.getState().favorites).toEqual(['KEEP']);
  });
});