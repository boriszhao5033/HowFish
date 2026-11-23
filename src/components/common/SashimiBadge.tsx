import {
  SASHIMI_LABELS,
  SASHIMI_SHORT_LABELS,
  type SashimiLevel,
} from '../../types/schema';

const TONE: Record<SashimiLevel, string> = {
  recommended:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  conditional:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  traditional_not_recommended:
    'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300',
  not_recommended:
    'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-300',
  forbidden:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
};

const DOT: Record<SashimiLevel, string> = {
  recommended: 'bg-emerald-500 dark:bg-emerald-400',
  conditional: 'bg-amber-500 dark:bg-amber-400',
  traditional_not_recommended: 'bg-orange-500 dark:bg-orange-400',
  not_recommended: 'bg-slate-400 dark:bg-slate-300',
  forbidden: 'bg-red-500 dark:bg-red-400',
};

interface SashimiBadgeProps {
  level: SashimiLevel | null | undefined;
  compact?: boolean;
  className?: string;
}

export function SashimiBadge({
  level,
  compact = false,
  className = '',
}: SashimiBadgeProps) {
  if (!level) {
    return null;
  }

  const label = compact ? SASHIMI_SHORT_LABELS[level] : SASHIMI_LABELS[level];

  return (
    <span
      title={SASHIMI_LABELS[level]}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } ${TONE[level]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[level]}`} aria-hidden="true" />
      {label}
    </span>
  );
}
