import { cleanup, render, screen, within } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DetailContent } from '../../pages/DetailPage';
import { loadStaticAppData } from '../dataLoader';
import { useAppStore } from '../../store/useAppStore';
import type { SpeciesRecord } from '../../types/schema';

const BASE_DATA = loadStaticAppData();
const MACKEREL_ID = 'FI00000000001';

function cloneSpecies(id: string): SpeciesRecord {
  const source = BASE_DATA.speciesById[id];
  return JSON.parse(JSON.stringify(source)) as SpeciesRecord;
}

function renderDetail(species: SpeciesRecord) {
  return render(
    <HashRouter>
      <DetailContent data={BASE_DATA} species={species} />
    </HashRouter>,
  );
}

beforeEach(() => {
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    value: vi.fn(),
  });
  useAppStore.setState({
    selectedRegion: 'cn_north',
    favorites: [],
    compareIds: [],
    userTags: {},
    userNotes: {},
  });
});

afterEach(() => {
  cleanup();
});

describe('DetailPage information architecture', () => {
  it('renders the continuous dot-separated taxonomy without subfamily', () => {
    renderDetail(cloneSpecies(MACKEREL_ID));

    const line = screen.getByTestId('taxonomy-line');
    expect(line.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '鱼类 · 鲈形总目 · 鲭形目 · 鲭科 · 鲐属 · 日本鲭',
    );
    expect(line.textContent ?? '').not.toContain('鲭族');

    const links = Array.from(line.querySelectorAll('a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#/atlas?focus=FI00',
      '#/atlas?focus=FI0000',
      '#/atlas?focus=FI000000',
      '#/atlas?focus=FI000000000',
    ]);
  });

  it('never renders 定位地区无分布 and shows 当季 only when fresh in season', () => {
    const unavailable = cloneSpecies(MACKEREL_ID);
    unavailable.availability.cn_north = 'none';
    unavailable.seasonality.by_group.cn.months = [];
    renderDetail(unavailable);

    expect(screen.queryByTestId('season-badge')).toBeNull();
    expect(screen.queryByText('定位地区无分布')).toBeNull();
    cleanup();

    const inSeason = cloneSpecies(MACKEREL_ID);
    inSeason.availability.cn_north = 'common';
    inSeason.seasonality.by_group.cn.months = [new Date().getMonth() + 1];
    renderDetail(inSeason);

    expect(screen.getByTestId('season-badge').textContent).toContain('当季');
    expect(screen.queryByText('定位地区无分布')).toBeNull();
  });

  it('renders all ten sections in the required DOM order', () => {
    renderDetail(cloneSpecies(MACKEREL_ID));

    const expectedOrder = [
      'section-appearance',
      'section-distribution',
      'section-seasonality',
      'section-notes-remarks',
      'section-sensory',
      'section-culinary',
      'section-histamine',
      'section-sashimi',
      'section-personal-notes',
      'section-related',
    ];
    const renderedOrder = Array.from(
      document.querySelectorAll('section[id^="section-"]'),
    ).map((section) => section.id);

    expect(renderedOrder).toEqual(expectedOrder);

    const notes = document.querySelector('#section-notes-remarks');
    expect(notes).not.toBeNull();
    if (!notes) {
      throw new Error('notes section missing');
    }
    expect(
      within(notes as HTMLElement).getByText(/高组胺中毒风险/),
    ).toBeTruthy();
  });
});