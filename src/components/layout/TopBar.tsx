import { Fish, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useData } from '../../context/DataContext';
import { useAppStore } from '../../store/useAppStore';
import { CATEGORY_LABELS, type CategoryCode } from '../../types/schema';

import { RegionSelector } from './RegionSelector';

export function TopBar() {
  const { data } = useData();
  const selectedCategory = useAppStore((state) => state.selectedCategory);
  const setSelectedCategory = useAppStore((state) => state.setSelectedCategory);
  const favoritesCount = useAppStore((state) => state.favorites.length);

  const categories = data?.categoriesPresent ?? [];
  const showCategorySwitcher = categories.length > 1;

  return (
    <header className="glass safe-top sticky top-0 z-30 border-x-0 border-t-0 border-b border-[#E2EBF0]/80 dark:border-[#1E354A]/80">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-2 px-3 sm:h-14 sm:px-5">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 rounded-xl outline-none"
          aria-label="HowFish 首页"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0B4F71] text-white shadow-[0_8px_20px_-12px_rgba(11,79,113,0.9)] dark:bg-[#38BDF8] dark:text-[#07131F]">
            <Fish className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className={`text-base font-semibold tracking-tight text-[#0F172A] dark:text-[#F1F5F9] sm:text-lg ${showCategorySwitcher ? 'hidden sm:inline' : ''}`}>
            HowFish
          </span>
        </Link>

        {showCategorySwitcher ? (
          <div className="relative ml-1 hidden items-center sm:inline-flex">
            <select
              aria-label="切换海产大类"
              value={selectedCategory}
              onChange={(event) =>
                setSelectedCategory(event.target.value as CategoryCode | 'ALL')
              }
              className="h-8 cursor-pointer appearance-none rounded-full border border-[#E2EBF0] bg-white/70 px-3 pr-6 text-xs font-medium text-[#52667A] outline-none focus:border-[#0B4F71]/40 dark:border-[#1E354A] dark:bg-[#102030]/70 dark:text-[#94A3B8]"
            >
              <option value="ALL">全部海产</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {showCategorySwitcher ? (
            <div className="relative inline-flex items-center sm:hidden">
              <select
                aria-label="切换海产大类"
                value={selectedCategory}
                onChange={(event) =>
                  setSelectedCategory(event.target.value as CategoryCode | 'ALL')
                }
                className="h-9 max-w-[5.5rem] cursor-pointer appearance-none truncate rounded-full border border-[#E2EBF0] bg-white/80 px-2.5 text-xs font-medium text-[#52667A] outline-none dark:border-[#1E354A] dark:bg-[#102030]/80 dark:text-[#94A3B8]"
              >
                <option value="ALL">全部</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <RegionSelector />

          <Link
            to="/profile"
            aria-label="收藏与设置"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E2EBF0] bg-white/80 text-[#52667A] transition-colors hover:border-[#0B4F71]/30 hover:text-[#0B4F71] dark:border-[#1E354A] dark:bg-[#102030]/80 dark:text-[#94A3B8] dark:hover:border-[#38BDF8]/40 dark:hover:text-[#38BDF8]"
          >
            <Star className="h-4 w-4" aria-hidden="true" />
            {favoritesCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0B4F71] px-1 text-[9px] font-semibold text-white dark:bg-[#38BDF8] dark:text-[#07131F]">
                {favoritesCount > 9 ? '9+' : favoritesCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
