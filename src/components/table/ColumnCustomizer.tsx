import { Eye, EyeOff, Lock, RotateCcw, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface CustomizerColumn {
  id: string;
  label: string;
  locked?: boolean;
}

export interface ColumnCustomizerProps {
  open: boolean;
  onClose: () => void;
  columns: CustomizerColumn[];
  visibleIds: string[];
  presetLabel: string;
  onToggle: (id: string) => void;
  onReset: () => void;
  onShowAll: () => void;
}

export function ColumnCustomizer({
  open,
  onClose,
  columns,
  visibleIds,
  presetLabel,
  onToggle,
  onReset,
  onShowAll,
}: ColumnCustomizerProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  const visible = new Set(visibleIds);

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div
        data-testid="column-customizer-backdrop"
        className="absolute inset-0 bg-[#07131F]/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="自定义列"
        className="absolute inset-x-0 bottom-0 flex max-h-[86dvh] flex-col rounded-t-3xl border border-[#E2EBF0] bg-white shadow-[0_-24px_70px_-30px_rgba(11,79,113,0.45)] dark:border-[#1E354A] dark:bg-[#102030] md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[30rem] md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-[calc(100vw-2rem)] md:rounded-3xl md:shadow-[0_26px_70px_-28px_rgba(11,79,113,0.55)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E2EBF0] px-4 py-3.5 dark:border-[#1E354A]">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-[#0F172A] dark:text-[#F1F5F9]">
              自定义列
            </h2>
            <p className="mt-0.5 text-[11px] text-[#52667A] dark:text-[#94A3B8]">
              当前预设「{presetLabel}」· 物种名称为固定锚点列
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭自定义列"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#52667A] transition-colors hover:bg-[#0B4F71]/10 hover:text-[#0B4F71] dark:text-[#94A3B8] dark:hover:bg-[#38BDF8]/10 dark:hover:text-[#38BDF8]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <ul className="grid grid-cols-2 gap-1.5 md:grid-cols-2">
            {columns.map((column) => {
              const checked = visible.has(column.id);
              return (
                <li key={column.id}>
                  <label
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs transition-colors ${
                      checked
                        ? 'border-[#0B4F71]/25 bg-[#0B4F71]/[0.06] text-[#0B4F71] dark:border-[#38BDF8]/25 dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]'
                        : 'border-[#E2EBF0] bg-white text-[#52667A] hover:border-[#0B4F71]/20 dark:border-[#1E354A] dark:bg-[#0B1824] dark:text-[#94A3B8]'
                    } ${column.locked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={column.locked}
                      onChange={() => onToggle(column.id)}
                      className="h-4 w-4 shrink-0 rounded border-[#C9D9E2] accent-[#0B4F71] dark:border-[#1E354A] dark:accent-[#38BDF8]"
                    />
                    <span className="min-w-0 flex-1 truncate">{column.label}</span>
                    {column.locked ? (
                      <Lock
                        className="h-3 w-3 shrink-0 opacity-70"
                        aria-hidden="true"
                      />
                    ) : checked ? (
                      <Eye className="h-3 w-3 shrink-0" aria-hidden="true" />
                    ) : (
                      <EyeOff
                        className="h-3 w-3 shrink-0 opacity-60"
                        aria-hidden="true"
                      />
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="safe-bottom flex flex-wrap items-center justify-between gap-2 border-t border-[#E2EBF0] px-4 py-3 dark:border-[#1E354A]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-[#52667A] transition-colors hover:bg-[#0B4F71]/5 hover:text-[#0B4F71] dark:text-[#94A3B8] dark:hover:text-[#38BDF8]"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              恢复预设默认列
            </button>
            <button
              type="button"
              onClick={onShowAll}
              className="rounded-full px-2.5 py-1.5 text-[11px] font-medium text-[#52667A] transition-colors hover:bg-[#0B4F71]/5 hover:text-[#0B4F71] dark:text-[#94A3B8] dark:hover:text-[#38BDF8]"
            >
              全部显示
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-xl bg-[#0B4F71] px-5 text-xs font-semibold text-white transition-opacity hover:opacity-90 dark:bg-[#38BDF8] dark:text-[#07131F]"
          >
            完成
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}