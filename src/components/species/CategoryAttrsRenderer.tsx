import type { ReactNode } from 'react';

import {
  ACIDITY_LABELS,
  CATEGORY_LABELS,
  FLESH_COLOR_MAP,
  PIN_BONE_LABELS,
  type AcidityLevel,
  type BivalveCategoryAttrs,
  type CephalopodCategoryAttrs,
  type CrustaceanCategoryAttrs,
  type FishCategoryAttrs,
  type FleshColorTag,
  type GastropodCategoryAttrs,
  type PinBoneLevel,
  type SpeciesRecord,
} from '../../types/schema';

const PIN_BONE_TONE: Record<PinBoneLevel, string> = {
  none: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  few: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
  moderate:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  many: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
};

function toText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => toText(item))
      .filter(Boolean)
      .join('、');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}

interface AttrRowProps {
  label: string;
  children: ReactNode;
}

/** One vertical, single-column attribute row. */
function AttrRow({ label, children }: AttrRowProps) {
  return (
    <div className="flex flex-col gap-1 border-b border-[#E2EBF0] py-2.5 last:border-b-0 dark:border-[#1E354A] sm:flex-row sm:items-start sm:gap-3">
      <span className="w-28 shrink-0 text-[11px] font-semibold tracking-wide text-[#0E86A8] dark:text-[#22D3EE]">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function FleshColorInline({
  tag,
  raw,
}: {
  tag: FleshColorTag | null | undefined;
  raw: string | null | undefined;
}) {
  if (!tag && !raw) {
    return (
      <p className="text-xs leading-5 text-[#52667A] dark:text-[#94A3B8]">
        暂无肉色标签
      </p>
    );
  }
  const meta = tag ? FLESH_COLOR_MAP[tag] : undefined;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="relative h-5 w-5 shrink-0" aria-hidden="true">
        <span
          className="absolute inset-0 rounded-full border border-black/5 dark:hidden"
          style={{ backgroundColor: meta?.pastel ?? '#E7F2F8' }}
        />
        <span
          className="absolute inset-0 hidden rounded-full border border-white/10 dark:block"
          style={{ backgroundColor: meta?.pastelDark ?? '#122B3A' }}
        />
      </span>
      <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
        {tag ?? '未标注'}
      </span>
      {raw ? (
        <span className="text-[11px] leading-4 text-[#52667A] dark:text-[#94A3B8]">
          {raw}
        </span>
      ) : null}
    </div>
  );
}

interface FatLevelBarProps {
  level: number | null | undefined;
  acidity: AcidityLevel | null | undefined;
  raw: string | null | undefined;
}

function FatLevelBar({ level, acidity, raw }: FatLevelBarProps) {
  const value =
    typeof level === 'number' && Number.isFinite(level)
      ? Math.max(0, Math.min(10, level))
      : null;
  const filled = value === null ? 0 : Math.min(7, Math.ceil((value / 10) * 7));

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium tracking-wide text-[#52667A] dark:text-[#94A3B8]">
          7 段油脂
        </span>
        <span className="text-xs font-semibold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
          {value === null ? '—' : value}
          <span className="ml-0.5 text-[10px] font-normal text-[#52667A] dark:text-[#94A3B8]">
            /10
          </span>
        </span>
      </div>
      <div
        className="mt-1.5 grid grid-cols-7 gap-1"
        role="img"
        aria-label={value === null ? '油脂等级暂无' : `油脂等级 ${value} 分，满分 10 分`}
      >
        {Array.from({ length: 7 }, (_, index) => (
          <span
            key={index}
            className={`h-2 rounded-full ${
              index < filled
                ? 'bg-gradient-to-r from-[#0E86A8] to-[#0B4F71] dark:from-[#22D3EE] dark:to-[#38BDF8]'
                : 'bg-[#E2EBF0] dark:bg-[#1E354A]'
            }`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {acidity ? (
          <span className="inline-flex items-center rounded-full border border-[#0B4F71]/15 bg-[#0B4F71]/[0.06] px-2 py-0.5 text-[10px] font-medium text-[#0B4F71] dark:border-[#38BDF8]/20 dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
            酸度 · {ACIDITY_LABELS[acidity]}
          </span>
        ) : null}
        {raw ? (
          <span className="text-[11px] leading-4 text-[#52667A] dark:text-[#94A3B8]">
            {raw}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function FishAttrs({
  species,
  attrs,
}: {
  species: SpeciesRecord;
  attrs: FishCategoryAttrs;
}) {
  const pinBone = attrs.pin_bone_level ?? null;
  const pinRaw =
    typeof species.extra_attrs.pin_bone_raw === 'string'
      ? species.extra_attrs.pin_bone_raw.trim()
      : '';

  return (
    <div>
      <AttrRow label="肌间刺">
        {pinBone ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PIN_BONE_TONE[pinBone]}`}
            >
              {PIN_BONE_LABELS[pinBone]}
            </span>
            {pinRaw ? (
              <span className="text-[11px] leading-4 text-[#52667A] dark:text-[#94A3B8]">
                {pinRaw}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-xs leading-5 text-[#52667A] dark:text-[#94A3B8]">
            暂无肌间刺数据
          </p>
        )}
      </AttrRow>

      <AttrRow label="肉色">
        <FleshColorInline tag={attrs.flesh_color_tag} raw={attrs.flesh_color_raw} />
      </AttrRow>

      <AttrRow label="油脂与酸度">
        <FatLevelBar
          level={attrs.fat_level}
          acidity={attrs.acidity_level}
          raw={attrs.fat_acidity_raw}
        />
      </AttrRow>
    </div>
  );
}

interface SimpleAttrsProps {
  title: string;
  rows: Array<{ label: string; value: unknown }>;
}

function SimpleAttrs({ title, rows }: SimpleAttrsProps) {
  const visible = rows.filter((row) => Boolean(toText(row.value)));
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold tracking-wide text-[#52667A] dark:text-[#94A3B8]">
        {title}
      </p>
      {visible.length > 0 ? (
        visible.map((row) => (
          <AttrRow key={row.label} label={row.label}>
            <span className="break-words text-xs font-semibold leading-5 text-[#0F172A] dark:text-[#F1F5F9]">
              {toText(row.value)}
            </span>
          </AttrRow>
        ))
      ) : (
        <p className="text-xs leading-5 text-[#52667A] dark:text-[#94A3B8]">
          暂无该类专属属性
        </p>
      )}
    </div>
  );
}

/**
 * Single-column, category-specific attribute renderer.
 *
 * FI renders pin bones, flesh colour and the fat/acidity gauge in that exact
 * top-to-bottom order. Other categories render their own attributes line by
 * line. Histamine lives in its own dedicated DetailPage section.
 */
export function CategoryAttrsRenderer({ species }: { species: SpeciesRecord }) {
  switch (species.category) {
    case 'FI':
      return (
        <FishAttrs
          species={species}
          attrs={species.category_attrs as FishCategoryAttrs}
        />
      );
    case 'CR': {
      const attrs = species.category_attrs as CrustaceanCategoryAttrs;
      return (
        <SimpleAttrs
          title={`${CATEGORY_LABELS.CR}专属属性`}
          rows={[
            { label: '抱卵 / 蟹膏季', value: attrs.roe_season },
            { label: '壳质硬度', value: attrs.shell_hardness },
            { label: '氧化 / 黑变风险', value: attrs.oxidation_risk },
          ]}
        />
      );
    }
    case 'CE': {
      const attrs = species.category_attrs as CephalopodCategoryAttrs;
      return (
        <SimpleAttrs
          title={`${CATEGORY_LABELS.CE}专属属性`}
          rows={[
            {
              label: '漂烫时间',
              value:
                typeof attrs.blanch_seconds === 'number'
                  ? `${attrs.blanch_seconds} 秒`
                  : attrs.blanch_seconds,
            },
            { label: '失水收缩', value: attrs.water_shrinkage },
            { label: '墨囊可食', value: attrs.ink_sac_edible },
          ]}
        />
      );
    }
    case 'BI': {
      const attrs = species.category_attrs as BivalveCategoryAttrs;
      return (
        <SimpleAttrs
          title={`${CATEGORY_LABELS.BI}专属属性`}
          rows={[
            { label: '壳型', value: attrs.shell_type },
            { label: '吐沙难度', value: attrs.sand_purge_difficulty },
            { label: '生物毒素风险', value: attrs.biotoxin_risk },
          ]}
        />
      );
    }
    case 'GA': {
      const attrs = species.category_attrs as GastropodCategoryAttrs;
      return (
        <SimpleAttrs
          title={`${CATEGORY_LABELS.GA}专属属性`}
          rows={[
            { label: '内脏可食', value: attrs.viscera_edible },
            { label: '黏液清洗', value: attrs.slime_cleaning },
          ]}
        />
      );
    }
    default:
      return (
        <SimpleAttrs
          title={`${CATEGORY_LABELS[species.category]}专属属性`}
          rows={Object.entries(species.category_attrs).map(([key, value]) => ({
            label: key
              .split('_')
              .filter(Boolean)
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(' '),
            value,
          }))}
        />
      );
  }
}
