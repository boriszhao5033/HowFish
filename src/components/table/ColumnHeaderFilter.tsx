import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Filter,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ColumnFilterOption {
  value: string;
  label: string;
  count: number;
}

export type SortDirection = 'asc' | 'desc';

export interface ColumnHeaderFilterProps {
  label: string;
  options?: ColumnFilterOption[];
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  sort?: SortDirection | null;
  onSortChange?: (next: SortDirection | null) => void;
  align?: 'left' | 'center';
}

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true;
    }
    return window.matchMedia('(min-width: 768px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return desktop;
}

export function ColumnHeaderFilter({
  label,
  options,
  selected,
  onSelectedChange,
  sort = null,
  onSortChange,
  align = 'left',
}: ColumnHeaderFilterProps) {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 300 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const filterable = Array.isArray(options) ? options.length > 0 : false;
  const sortable = typeof onSortChange === 'function';
  const active = selected.length > 0 || sort !== null;

  const updatePosition = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const width = Math.min(320, Math.max(260, window.innerWidth - 24));
    const left = Math.min(
      Math.max(12, rect.left),
      Math.max(12, window.innerWidth - width - 12),
    );
    const estimatedHeight = 360;
    const below = rect.bottom + 8;
    const top =
      below + estimatedHeight > window.innerHeight
        ? Math.max(12, window.innerHeight - estimatedHeight - 12)
        : below;
    setPosition({ left, top, width });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    if (desktop) {
      updatePosition();
      const onPointerDown = (event: PointerEvent) => {
        const target = event.target as Node | null;
        if (!target) {
          return;
        }
        if (panelRef.current?.contains(target)) {
          return;
        }
        if (buttonRef.current?.contains(target)) {
          return;
        }
        setOpen(false);
      };
      document.addEventListener('pointerdown', onPointerDown, true);
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('pointerdown', onPointerDown, true);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, desktop, updatePosition]);

  const toggleValue = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onSelectedChange(next);
  };

  const panelBody = (
    <div className="flex max-h-[68dvh] flex-col">
      {sortable ? (
        <div className="border-b border-[#E2EBF0] px-3 py-3 dark:border-[#1E354A]">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#52667A] dark:text-[#94A3B8]">
            排序
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              aria-pressed={sort === 'asc'}
              onClick={() => {
                onSortChange?.('asc');
                if (!desktop) {
                  setOpen(false);
                }
              }}
              className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                sort === 'asc'
                  ? 'border-[#0B4F71] bg-[#0B4F71] text-white dark:border-[#38BDF8] dark:bg-[#38BDF8] dark:text-[#07131F]'
                  : 'border-[#E2EBF0] bg-white text-[#52667A] hover:border-[#0B4F71]/30 hover:text-[#0B4F71] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#94A3B8] dark:hover:text-[#38BDF8]'
              }`}
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              升序
            </button>
            <button
              type="button"
              aria-pressed={sort === 'desc'}
              onClick={() => {
                onSortChange?.('desc');
                if (!desktop) {
                  setOpen(false);
                }
              }}
              className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                sort === 'desc'
                  ? 'border-[#0B4F71] bg-[#0B4F71] text-white dark:border-[#38BDF8] dark:bg-[#38BDF8] dark:text-[#07131F]'
                  : 'border-[#E2EBF0] bg-white text-[#52667A] hover:border-[#0B4F71]/30 hover:text-[#0B4F71] dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#94A3B8] dark:hover:text-[#38BDF8]'
              }`}
            >
              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              降序
            </button>
            <button
              type="button"
              disabled={sort === null}
              onClick={() => onSortChange?.(null)}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-[#E2EBF0] bg-white text-[11px] font-medium text-[#52667A] transition-colors hover:text-[#0B4F71] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#94A3B8]"
            >
              清除排序
            </button>
          </div>
        </div>
      ) : null}

      {filterable ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#52667A] dark:text-[#94A3B8]">
            多选筛选 · 列内 OR
          </p>
          <ul className="space-y-0.5">
            {(options ?? []).map((option) => {
              const checked = selected.includes(option.value);
              const disabled = !checked && option.count === 0;
              return (
                <li key={option.value}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                      checked
                        ? 'bg-[#0B4F71]/[0.08] text-[#0B4F71] dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]'
                        : disabled
                          ? 'cursor-not-allowed text-[#94A3B8] dark:text-[#52667A]'
                          : 'text-[#0F172A] hover:bg-[#0B4F71]/5 dark:text-[#E2E8F0] dark:hover:bg-[#38BDF8]/5'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleValue(option.value)}
                      className="h-4 w-4 shrink-0 rounded border-[#C9D9E2] accent-[#0B4F71] dark:border-[#1E354A] dark:accent-[#38BDF8]"
                    />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <span className="shrink-0 rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[10px] tabular-nums text-[#52667A] dark:bg-white/10 dark:text-[#94A3B8]">
                      {option.count}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="safe-bottom flex items-center justify-between gap-2 border-t border-[#E2EBF0] px-3 py-2.5 dark:border-[#1E354A]">
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => onSelectedChange([])}
          className="rounded-lg px-2 py-1 text-[11px] font-medium text-[#52667A] transition-colors hover:bg-[#0B4F71]/5 hover:text-[#0B4F71] disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#94A3B8] dark:hover:text-[#38BDF8]"
        >
          清空本列筛选
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex h-8 items-center rounded-lg bg-[#0B4F71] px-4 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 dark:bg-[#38BDF8] dark:text-[#07131F]"
        >
          完成
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label} 筛选与排序`}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-7 w-full min-w-0 items-center gap-1 rounded-lg px-1.5 text-[11px] font-semibold transition-colors ${
          align === 'center' ? 'justify-center' : ''
        } ${
          active
            ? 'bg-[#38BDF8]/15 text-[#0B4F71] dark:bg-[#38BDF8]/15 dark:text-[#38BDF8]'
            : 'text-[#52667A] hover:bg-[#0B4F71]/5 hover:text-[#0B4F71] dark:text-[#94A3B8] dark:hover:bg-[#38BDF8]/5 dark:hover:text-[#38BDF8]'
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {selected.length > 0 ? (
          <span className="flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded-full bg-[#0B4F71] px-1 text-[9px] font-bold leading-none text-white tabular-nums dark:bg-[#38BDF8] dark:text-[#07131F]">
            {selected.length}
          </span>
        ) : null}
        {sortable ? (
          sort === 'asc' ? (
            <ArrowUp className="h-3 w-3 shrink-0" aria-hidden="true" />
          ) : sort === 'desc' ? (
            <ArrowDown className="h-3 w-3 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronsUpDown
              className="h-3 w-3 shrink-0 opacity-40"
              aria-hidden="true"
            />
          )
        ) : null}
        {filterable ? (
          <Filter
            className={`h-3 w-3 shrink-0 ${active ? 'fill-current' : 'opacity-60'}`}
            aria-hidden="true"
          />
        ) : null}
      </button>

      {typeof document !== 'undefined' && desktop && open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={`${label} 筛选与排序面板`}
              style={{
                position: 'fixed',
                left: position.left,
                top: position.top,
                width: position.width,
              }}
              className="z-[80] overflow-hidden rounded-2xl border border-[#E2EBF0] bg-white shadow-[0_26px_70px_-28px_rgba(11,79,113,0.55)] dark:border-[#1E354A] dark:bg-[#102030]"
            >
              <div className="flex items-center justify-between border-b border-[#E2EBF0] px-3 py-2 dark:border-[#1E354A]">
                <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                  {label}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="关闭筛选面板"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[#52667A] transition-colors hover:bg-[#0B4F71]/10 hover:text-[#0B4F71] dark:text-[#94A3B8]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              {panelBody}
            </div>,
            document.body,
          )
        : null}

      {typeof document !== 'undefined' && !desktop && open
        ? createPortal(
            <div className="fixed inset-0 z-[80] md:hidden">
              <div
                className="absolute inset-0 bg-[#07131F]/45 backdrop-blur-[2px]"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`${label} 筛选与排序面板`}
                className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-b-0 border-[#E2EBF0] bg-white shadow-[0_-24px_70px_-30px_rgba(11,79,113,0.45)] dark:border-[#1E354A] dark:bg-[#102030]"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                      {label}
                    </p>
                    <p className="text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                      列内多选取并集，跨列取交集
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="关闭筛选面板"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#52667A] transition-colors hover:bg-[#0B4F71]/10 hover:text-[#0B4F71] dark:text-[#94A3B8]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                {panelBody}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}