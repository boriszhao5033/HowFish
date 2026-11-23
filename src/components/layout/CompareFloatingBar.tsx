import { ArrowRight, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { useAppStore } from '../../store/useAppStore';

export function CompareFloatingBar() {
  const compareIds = useAppStore((state) => state.compareIds);
  const clearCompare = useAppStore((state) => state.clearCompare);
  const location = useLocation();

  if (compareIds.length === 0 || location.pathname.startsWith('/compare')) {
    return null;
  }

  const href = `/compare?ids=${compareIds.join(',')}`;

  return (
    <div
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 lg:bottom-6 lg:left-[calc(50%+2.5rem)]"
      aria-live="polite"
    >
      <div className="glass flex items-center gap-2 rounded-full border border-[#0B4F71]/15 px-2.5 py-2 shadow-[0_18px_45px_-22px_rgba(11,79,113,0.55)] dark:border-[#38BDF8]/25">
        <span className="ml-1.5 text-xs font-medium text-[#0B4F71] dark:text-[#38BDF8]">
          已选 <span className="tabular-nums">{compareIds.length}</span> 种
        </span>
        <Link
          to={href}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full bg-[#0B4F71] px-3.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 dark:bg-[#38BDF8] dark:text-[#07131F]"
        >
          立即 VS 对比
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={clearCompare}
          aria-label="清空对比队列"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#52667A] transition-colors hover:bg-[#0B4F71]/10 hover:text-[#0B4F71] dark:text-[#94A3B8] dark:hover:bg-[#38BDF8]/10 dark:hover:text-[#38BDF8]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}