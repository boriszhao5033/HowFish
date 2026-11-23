import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HashRouter, MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../context/DataContext', async () => {
  const { loadStaticAppData } = await import('../dataLoader');
  const data = loadStaticAppData();
  return {
    useData: () => ({ data, searchEngine: null, loading: false, error: null }),
  };
});

import { SpeciesCard } from '../../components/species/SpeciesCard';
import { AtlasPage } from '../../pages/AtlasPage';
import { SeasonalPage } from '../../pages/SeasonalPage';
import { loadStaticAppData } from '../dataLoader';
import {
  isFreshInSeasonForGroup,
  isSpeciesUnavailableInRegion,
} from '../filters';
import { useAppStore } from '../../store/useAppStore';

const DATA = loadStaticAppData();

beforeEach(() => {
  useAppStore.setState({
    selectedRegion: 'global',
    compareIds: [],
    favorites: [],
    userTags: {},
    userNotes: {},
  });
});

afterEach(() => {
  cleanup();
});

describe('compact SpeciesCard', () => {
  it('renders a compact right-side thumbnail and omits the Latin name', () => {
    const species = DATA.speciesById.FI00000000001;
    const { container } = render(
      <HashRouter>
        <SpeciesCard species={species} month={11} />
      </HashRouter>,
    );

    const thumb = screen.getByTestId('species-card-thumb');
    expect(thumb.className).toContain('h-11');
    expect(thumb.className).toContain('w-11');
    expect(thumb.className).toContain('sm:h-12');
    expect(thumb.className).toContain('sm:w-12');

    expect(container.textContent).toContain(species.names.zh_formal);
    expect(container.textContent).toContain(species.names.en_standard);
    expect(container.textContent).not.toContain(species.names.latin);
  });
});

describe('SeasonalPage local seasonal results', () => {
  it('shows real local AU results in November and excludes frozen-only species', () => {
    useAppStore.setState({ selectedRegion: 'au' });
    const { container } = render(
      <HashRouter>
        <SeasonalPage />
      </HashRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '11月' }));

    const articles = Array.from(container.querySelectorAll('article'));
    expect(articles.length).toBeGreaterThan(0);
    const renderedText = articles
      .map((article) => article.textContent ?? '')
      .join('\n');

    const auGroup = DATA.regions.regions.au.season_group;
    const expectedLocal = DATA.species
      .filter(
        (record) =>
          !isSpeciesUnavailableInRegion(record, 'au', DATA.regions) &&
          isFreshInSeasonForGroup(record, auGroup, 11),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    expect(expectedLocal.length).toBeGreaterThan(0);
    expect(renderedText).toContain(expectedLocal[0].names.zh_formal);
    expect(renderedText).toContain(
      expectedLocal[expectedLocal.length - 1].names.zh_formal,
    );
    expect(renderedText).not.toContain('日本鲭');
    expect(renderedText).not.toContain('异鳞蛇鲭');

    const countBadge = screen.getByTestId('seasonal-local-count');
    expect(countBadge.textContent).toContain(String(expectedLocal.length));
    expect(countBadge.textContent).toContain('种');
  });
});

describe('AtlasPage taxonomy table', () => {
  it('renders true rowSpan cells when genera share ancestors', () => {
    render(
      <MemoryRouter initialEntries={['/atlas']}>
        <AtlasPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /分类表/ }));

    const mergedCells = Array.from(
      document.querySelectorAll('td[rowspan]'),
    ).filter((cell) => Number(cell.getAttribute('rowspan')) > 1);

    expect(mergedCells.length).toBeGreaterThan(0);
  });

  it('renders every full Chinese species name without sashimi badges in the 收录物种 column', () => {
    render(
      <MemoryRouter initialEntries={['/atlas']}>
        <AtlasPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /分类表/ }));

    const speciesCells = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="atlas-species-cell"]'),
    );
    expect(speciesCells.length).toBe(233);

    const nameElements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="atlas-species-name"]'),
    );
    const renderedNames = new Set<string>();
    for (const element of nameElements) {
      const text = (element.textContent ?? '').trim();
      if (text) {
        renderedNames.add(text);
      }
      expect(element.className).not.toContain('truncate');
      expect(element.className).not.toContain('line-clamp');
    }

    const catalogedNames = DATA.taxonomyNodes
      .filter((node) => node.level === 'genus')
      .flatMap((node) => node.species_names ?? [])
      .filter((name) => name.trim().length > 0);
    expect(catalogedNames.length).toBe(350);

    const loadedNames = DATA.species.map((species) => species.names.zh_formal);
    for (const name of new Set([...catalogedNames, ...loadedNames])) {
      expect(renderedNames.has(name), `missing full Chinese species name: ${name}`).toBe(
        true,
      );
    }

    const sashimiLabels = [
      '推荐生食',
      '有条件生食',
      '常规熟食',
      '不建议生食',
      '严禁生食',
    ];
    for (const cell of speciesCells) {
      const text = cell.textContent ?? '';
      for (const label of sashimiLabels) {
        expect(text).not.toContain(label);
      }
    }
  });
});
