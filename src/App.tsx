import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { CompareFloatingBar } from './components/layout/CompareFloatingBar';
import { Navigation } from './components/layout/Navigation';
import { PwaUpdateToast } from './components/layout/PwaUpdateToast';
import { TopBar } from './components/layout/TopBar';
import { DataProvider } from './context/DataContext';
import { AtlasPage } from './pages/AtlasPage';
import { ComparePage } from './pages/ComparePage';
import { DetailPage } from './pages/DetailPage';
import { HomePage } from './pages/HomePage';
import { ProfilePage } from './pages/ProfilePage';
import { SeasonalPage } from './pages/SeasonalPage';
import { TablePage } from './pages/TablePage';
import { useAppStore } from './store/useAppStore';

function useThemeSync() {
  const theme = useAppStore((state) => state.theme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';

      const themeMeta = document.querySelector('meta[name="theme-color"]');
      themeMeta?.setAttribute('content', dark ? '#09131D' : '#0B4F71');

      try {
        window.localStorage.setItem('howfish-theme', dark ? 'dark' : 'light');
      } catch {
        /* Storage can be unavailable in private browsing. */
      }
    };

    applyTheme();

    if (theme !== 'system') {
      return;
    }

    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);
}

function AppShell() {
  useThemeSync();

  return (
    <div className="min-h-dvh bg-[#F6F9FB] text-[#0F172A] dark:bg-[#09131D] dark:text-[#F1F5F9]">
      <div className="lg:pl-20">
        <TopBar />
        <main className="mx-auto w-full max-w-6xl px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pt-5 lg:pb-12">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/seasonal" element={<SeasonalPage />} />
            <Route path="/table" element={<TablePage />} />
            <Route path="/species/:id" element={<DetailPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/atlas" element={<AtlasPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <Navigation />
      <CompareFloatingBar />
      <PwaUpdateToast />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <DataProvider>
        <AppShell />
      </DataProvider>
    </HashRouter>
  );
}