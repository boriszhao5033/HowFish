import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { loadAppData } from '../services/dataLoader';
import { buildSearchEngine, type SearchEngine } from '../services/searchEngine';
import { useAppStore } from '../store/useAppStore';
import type { LoadedAppData } from '../types/schema';

interface DataContextValue {
  data: LoadedAppData | null;
  searchEngine: SearchEngine | null;
  loading: boolean;
  error: string | null;
}

const DataContext = createContext<DataContextValue>({
  data: null,
  searchEngine: null,
  loading: true,
  error: null,
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LoadedAppData | null>(null);
  const [searchEngine, setSearchEngine] = useState<SearchEngine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoading(true);
      setError(null);
      try {
        const loaded = await loadAppData();
        if (cancelled) {
          return;
        }

        // Cold-start silent migration for favorites, notes, tags and compare queue.
        useAppStore.getState().applyRedirects(loaded.redirects);

        const store = useAppStore.getState();
        if (
          store.selectedRegion !== 'global' &&
          !loaded.regions.regions[store.selectedRegion]?.enabled
        ) {
          store.setSelectedRegion('global');
        }
        if (
          store.selectedCategory !== 'ALL' &&
          !loaded.categoriesPresent.includes(store.selectedCategory)
        ) {
          store.setSelectedCategory('ALL');
        }

        setData(loaded);
        setSearchEngine(buildSearchEngine(loaded.species));
      } catch (caught) {
        if (cancelled) {
          return;
        }
        setError(
          caught instanceof Error ? caught.message : '离线数据加载失败，请刷新重试。',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DataContext.Provider value={{ data, searchEngine, loading, error }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  return useContext(DataContext);
}