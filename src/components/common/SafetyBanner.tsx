import { ShieldAlert } from 'lucide-react';

import type { SafetyItem, SafetySeverity } from '../../types/schema';

const SEVERITY_LABEL: Record<SafetySeverity, string> = {
  critical: '严禁',
  high: '高风险',
  medium: '注意',
  low: '提示',
};

const RED_SEVERITIES = new Set<SafetySeverity>(['critical', 'high']);

interface SafetyBannerProps {
  items: SafetyItem[];
  title?: string;
  className?: string;
}

/**
 * Safety and legal alerts rendered as single-row, top-to-bottom stacked items.
 * Critical/high rows are red, medium/low rows are amber; nothing collapses.
 */
export function SafetyBanner({
  items,
  title = '安全与法规警示',
  className = '',
}: SafetyBannerProps) {
  const visible = items.filter((item) => item.title || item.detail);
  if (visible.length === 0) {
    return null;
  }

  return (
    <section
      role="note"
      aria-label={title}
      className={`rounded-2xl border border-[#E2EBF0] bg-[#F8FBFD]/70 p-3 dark:border-[#1E354A] dark:bg-[#0B1824]/50 ${className}`}
    >
      <div className="flex items-center gap-2">
        <ShieldAlert
          className="h-4 w-4 shrink-0 text-red-600 dark:text-red-300"
          aria-hidden="true"
        />
        <h3 className="text-xs font-semibold tracking-tight text-[#0F172A] dark:text-[#F1F5F9]">
          {title}
        </h3>
      </div>

      <div className="mt-2 space-y-2">
        {visible.map((item, index) => {
          const severity = item.severity ?? 'medium';
          const red = RED_SEVERITIES.has(severity);
          return (
            <div
              key={`${item.type}-${index}`}
              className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 ${
                red
                  ? 'border-red-200 bg-red-50/90 text-red-950 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100'
                  : 'border-amber-200 bg-amber-50/90 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
              }`}
            >
              <span
                className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                  red
                    ? 'bg-red-600/10 text-red-700 dark:bg-red-400/15 dark:text-red-200'
                    : 'bg-amber-600/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200'
                }`}
              >
                {SEVERITY_LABEL[severity]}
              </span>
              <div className="min-w-0">
                {item.title ? (
                  <p className="text-xs font-semibold leading-5">{item.title}</p>
                ) : null}
                {item.detail ? (
                  <p className="mt-0.5 text-[11px] leading-5 opacity-85">
                    {item.detail}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
