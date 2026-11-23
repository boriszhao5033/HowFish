import { RotateCcw, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import { useData } from '../../context/DataContext';
import { countActiveFilterDimensions } from '../../services/filters';
import { useAppStore } from '../../store/useAppStore';
import {
  COOKING_TAG_GROUPS,
  FLESH_COLOR_LIST,
  getRegionFlag,
  HISTAMINE_LABELS,
  PIN_BONE_LABELS,
  SALINITY_LABELS,
  SASHIMI_LABELS,
  SASHIMI_ORDER,
  type CookingTag,
  type HistamineRisk,
  type PinBoneLevel,
  type Salinity,
} from '../../types/schema';

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  resultCount: number;
}

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-[#E2EBF0] py-4 last:border-b-0 dark:border-[#1E354A]">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-[#0F172A] dark:text-[#F1F5F9]">
          {title}
        </h3>
        {hint ? (
          <span className="text-[10px] text-[#52667A] dark:text-[#94A3B8]">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`hf-chip ${active ? 'hf-chip-active' : ''}`}
    >
      {children}
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-[#F6F9FB] px-3 py-2.5 text-xs text-[#0F172A] dark:bg-[#0B1824] dark:text-[#F1F5F9]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[#C9D9E2] accent-[#0B4F71] dark:border-[#1E354A] dark:accent-[#38BDF8]"
      />
    </label>
  );
}

export function FilterDrawer({ open, onClose, resultCount }: FilterDrawerProps) {
  const { data } = useData();
  const filter = useAppStore((state) => state.homeFilter);
  const patchHomeFilter = useAppStore((state) => state.patchHomeFilter);
  const resetHomeFilter = useAppStore((state) => state.resetHomeFilter);

  const activeDimensions = countActiveFilterDimensions(filter);

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

  const regionOptions = data
    ? Object.entries(data.regions.regions).filter(([, config]) => config.enabled)
    : [];

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-[#07131F]/[0.45] backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="hf-filter-title"
        className={`absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-3xl border border-[#E2EBF0] bg-white shadow-[0_-24px_70px_-30px_rgba(11,79,113,0.45)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-[#1E354A] dark:bg-[#102030] lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[380px] lg:rounded-none lg:border-y-0 lg:border-r-0 lg:shadow-[-24px_0_70px_-40px_rgba(0,0,0,0.5)] ${
          open
            ? 'translate-y-0 lg:translate-x-0'
            : 'translate-y-full lg:translate-y-0 lg:translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-[#E2EBF0] px-4 py-3.5 dark:border-[#1E354A]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 id="hf-filter-title" className="text-base font-semibold tracking-tight">
                多维筛选
              </h2>
              <span className="rounded-full bg-[#0B4F71]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0B4F71] tabular-nums dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
                {activeDimensions} 项生效
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#52667A] dark:text-[#94A3B8]">
              跨维度取交集，同维度多选取并集
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭筛选"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#52667A] transition-colors hover:bg-[#0B4F71]/10 hover:text-[#0B4F71] dark:text-[#94A3B8] dark:hover:bg-[#38BDF8]/10 dark:hover:text-[#38BDF8]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          <Section title="场景过滤">
            <div className="space-y-2">
              <ToggleRow
                label="仅看本月当季正肥"
                checked={filter.onlyInSeason}
                onChange={(checked) => patchHomeFilter({ onlyInSeason: checked })}
              />
              <ToggleRow
                label="仅看有安全警示的物种"
                checked={filter.onlyWithSafetyAlert}
                onChange={(checked) =>
                  patchHomeFilter({ onlyWithSafetyAlert: checked })
                }
              />
            </div>
          </Section>

          <Section title="地区可得性" hint="任一地区有货即可">
            <div className="flex flex-wrap gap-1.5">
              {regionOptions.map(([key, config]) => (
                <Chip
                  key={key}
                  active={filter.regionAvailability.includes(key)}
                  onClick={() =>
                    patchHomeFilter({
                      regionAvailability: toggleValue(
                        filter.regionAvailability,
                        key,
                      ),
                    })
                  }
                >
                  {getRegionFlag(key)} {config.label}
                </Chip>
              ))}
              {regionOptions.length === 0 ? (
                <span className="text-[11px] text-[#52667A] dark:text-[#94A3B8]">
                  地区配置加载后自动出现
                </span>
              ) : null}
            </div>
          </Section>

          <Section title="生境盐度">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SALINITY_LABELS) as Salinity[]).map((value) => (
                <Chip
                  key={value}
                  active={filter.salinity.includes(value)}
                  onClick={() =>
                    patchHomeFilter({
                      salinity: toggleValue(filter.salinity, value),
                    })
                  }
                >
                  {SALINITY_LABELS[value]}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="刺身评级">
            <div className="flex flex-wrap gap-1.5">
              {SASHIMI_ORDER.map((value) => (
                <Chip
                  key={value}
                  active={filter.sashimiLevels.includes(value)}
                  onClick={() =>
                    patchHomeFilter({
                      sashimiLevels: toggleValue(filter.sashimiLevels, value),
                    })
                  }
                >
                  {SASHIMI_LABELS[value]}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="肌间刺水平" hint="仅鱼类">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(PIN_BONE_LABELS) as PinBoneLevel[]).map((value) => (
                <Chip
                  key={value}
                  active={filter.pinBoneLevels.includes(value)}
                  onClick={() =>
                    patchHomeFilter({
                      pinBoneLevels: toggleValue(filter.pinBoneLevels, value),
                    })
                  }
                >
                  {PIN_BONE_LABELS[value]}
                </Chip>
              ))}
            </div>
          </Section>

          <Section
            title="油脂范围"
            hint={`${filter.fatRange[0]}–${filter.fatRange[1]} / 10`}
          >
            <div className="space-y-2.5">
              <label className="block">
                <span className="mb-1 flex justify-between text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                  <span>最低油脂</span>
                  <span className="tabular-nums">{filter.fatRange[0]}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={filter.fatRange[0]}
                  onChange={(event) =>
                    patchHomeFilter({
                      fatRange: [
                        Math.min(Number(event.target.value), filter.fatRange[1]),
                        filter.fatRange[1],
                      ],
                    })
                  }
                  className="w-full accent-[#0B4F71] dark:accent-[#38BDF8]"
                />
              </label>
              <label className="block">
                <span className="mb-1 flex justify-between text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                  <span>最高油脂</span>
                  <span className="tabular-nums">{filter.fatRange[1]}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={filter.fatRange[1]}
                  onChange={(event) =>
                    patchHomeFilter({
                      fatRange: [
                        filter.fatRange[0],
                        Math.max(Number(event.target.value), filter.fatRange[0]),
                      ],
                    })
                  }
                  className="w-full accent-[#0B4F71] dark:accent-[#38BDF8]"
                />
              </label>
            </div>
          </Section>

          <Section title="组胺风险" hint="青皮红肉鱼重点">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(HISTAMINE_LABELS) as HistamineRisk[]).map((value) => (
                <Chip
                  key={value}
                  active={filter.histamineRisks.includes(value)}
                  onClick={() =>
                    patchHomeFilter({
                      histamineRisks: toggleValue(filter.histamineRisks, value),
                    })
                  }
                >
                  {HISTAMINE_LABELS[value]}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="肉色大类">
            <div className="flex flex-wrap gap-1.5">
              {FLESH_COLOR_LIST.map((item) => {
                const active = filter.fleshColors.includes(item.value);
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      patchHomeFilter({
                        fleshColors: toggleValue(
                          filter.fleshColors,
                          item.value,
                        ),
                      })
                    }
                    className={`hf-chip ${active ? 'hf-chip-active' : ''}`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-black/10"
                      style={{ backgroundColor: item.pastel }}
                      aria-hidden="true"
                    />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="烹饪技法" hint="同维度取并集">
            <div className="space-y-3">
              {COOKING_TAG_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="mb-1.5 text-[10px] font-medium text-[#52667A] dark:text-[#94A3B8]">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tags.map((tag) => {
                      const value = tag as CookingTag;
                      return (
                        <Chip
                          key={value}
                          active={filter.cookingTags.includes(value)}
                          onClick={() =>
                            patchHomeFilter({
                              cookingTags: toggleValue(
                                filter.cookingTags,
                                value,
                              ),
                            })
                          }
                        >
                          {value}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <ToggleRow
                label="仅匹配主打绝配 signature"
                checked={filter.cookingSignatureOnly}
                onChange={(checked) =>
                  patchHomeFilter({ cookingSignatureOnly: checked })
                }
              />
            </div>
          </Section>
        </div>

        <div className="safe-bottom border-t border-[#E2EBF0] bg-white/95 px-4 pt-3 backdrop-blur dark:border-[#1E354A] dark:bg-[#102030]/95">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetHomeFilter}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-[#E2EBF0] px-3.5 text-xs font-medium text-[#52667A] transition-colors hover:border-[#0B4F71]/30 hover:text-[#0B4F71] dark:border-[#1E354A] dark:text-[#94A3B8] dark:hover:border-[#38BDF8]/40 dark:hover:text-[#38BDF8]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              重置
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-[#0B4F71] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 dark:bg-[#38BDF8] dark:text-[#07131F]"
            >
              查看 <span className="mx-1 tabular-nums">{resultCount}</span> 种海产
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}