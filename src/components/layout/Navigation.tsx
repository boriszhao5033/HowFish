import {
  CalendarDays,
  Network,
  Scale,
  Search,
  Table2,
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { useAppStore } from '../../store/useAppStore';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '速查', icon: Search, end: true },
  { to: '/seasonal', label: '当季', icon: CalendarDays },
  { to: '/table', label: '全表', icon: Table2 },
  { to: '/compare', label: '对比', icon: Scale },
  { to: '/atlas', label: '图谱', icon: Network },
];

function activeClass(isActive: boolean): string {
  return isActive
    ? 'bg-[#0B4F71]/10 text-[#0B4F71] dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]'
    : 'text-[#52667A] hover:bg-[#0B4F71]/5 hover:text-[#0B4F71] dark:text-[#94A3B8] dark:hover:bg-[#38BDF8]/5 dark:hover:text-[#38BDF8]';
}

export function Navigation() {
  const compareCount = useAppStore((state) => state.compareIds.length);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col items-center border-r border-[#E2EBF0] bg-white/80 pt-24 backdrop-blur-md dark:border-[#1E354A] dark:bg-[#09131D]/85 lg:flex">
        <nav aria-label="主导航" className="flex w-full flex-col items-center gap-2 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const showBadge = item.to === '/compare' && compareCount > 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex w-full flex-col items-center gap-1 rounded-2xl py-2.5 text-[10px] font-medium transition-colors ${activeClass(isActive)}`
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{item.label}</span>
                {showBadge ? (
                  <span className="absolute right-1.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#DC2626] px-1 text-[9px] font-semibold text-white tabular-nums">
                    {compareCount}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <nav
        aria-label="主导航"
        className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 gap-1 border-x-0 border-b-0 border-t border-[#E2EBF0]/80 px-2 pt-1.5 dark:border-[#1E354A]/80 lg:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const showBadge = item.to === '/compare' && compareCount > 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors ${activeClass(isActive)}`
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
              {showBadge ? (
                <span className="absolute right-[18%] top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#DC2626] px-1 text-[9px] font-semibold text-white tabular-nums">
                  {compareCount}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}