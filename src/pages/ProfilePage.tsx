import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  Info,
  Monitor,
  Moon,
  Search,
  Star,
  Sun,
  Upload,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { Link } from 'react-router-dom';

import { SpeciesPlaceholderSvg } from '../components/common/SpeciesPlaceholderSvg';
import { useData } from '../context/DataContext';
import {
  isWeChatBrowser,
  WECHAT_OPEN_IN_BROWSER_TIP,
} from '../services/browserEnv';
import { IS_SINGLE_FILE } from '../services/dataLoader';
import {
  USER_TAGS,
  useAppStore,
  type BackupImportMode,
  type ThemeMode,
  type UserTag,
} from '../store/useAppStore';
import { getRegionFlag } from '../types/schema';

type ListFilter = 'all' | 'notes' | UserTag;

type ServiceWorkerStatus =
  | 'checking'
  | 'ready'
  | 'registering'
  | 'not-registered'
  | 'unsupported'
  | 'not-applicable'
  | 'error';

interface BackupFeedback {
  kind: 'success' | 'error';
  message: string;
}

const THEME_OPTIONS: {
  value: ThemeMode;
  label: string;
  icon: typeof Monitor;
}[] = [
  { value: 'system', label: '跟随系统', icon: Monitor },
  { value: 'light', label: '浅色模式', icon: Sun },
  { value: 'dark', label: '深色模式', icon: Moon },
];

const SERVICE_WORKER_LABEL: Record<ServiceWorkerStatus, string> = {
  checking: '检测中…',
  ready: '已就绪（离线缓存可用）',
  registering: '正在注册 / 等待激活',
  'not-registered': '尚未注册（开发模式或首次加载）',
  unsupported: '当前环境不支持 Service Worker',
  'not-applicable': '单文件模式无需 Service Worker',
  error: '缓存状态检测失败',
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function localStamp(date: Date = new Date()): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(
    date.getDate(),
  )}`;
}

function backupFilename(date: Date = new Date()): string {
  return `howfish_backup_${localStamp(date)}.json`;
}

function noteSnippet(note: string): string {
  const clean = note.replace(/\s+/g, ' ').trim();
  return clean.length > 96 ? `${clean.slice(0, 96)}…` : clean;
}

export function ProfilePage() {
  const { data, loading, error } = useData();

  const favorites = useAppStore((state) => state.favorites);
  const userTags = useAppStore((state) => state.userTags);
  const userNotes = useAppStore((state) => state.userNotes);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const exportUserBackup = useAppStore((state) => state.exportUserBackup);
  const importUserBackup = useAppStore((state) => state.importUserBackup);

  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [query, setQuery] = useState('');
  const [importMode, setImportMode] = useState<BackupImportMode>('merge');
  const [feedback, setFeedback] = useState<BackupFeedback | null>(null);
  const [wechatTipVisible, setWechatTipVisible] = useState(() =>
    isWeChatBrowser(),
  );
  const [swStatus, setSwStatus] = useState<ServiceWorkerStatus>(
    IS_SINGLE_FILE ? 'not-applicable' : 'checking',
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (IS_SINGLE_FILE) {
      setSwStatus('not-applicable');
      return;
    }
    if (!('serviceWorker' in navigator)) {
      setSwStatus('unsupported');
      return;
    }

    let cancelled = false;
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (cancelled) {
          return;
        }
        if (!registration) {
          setSwStatus('not-registered');
        } else {
          setSwStatus(registration.active ? 'ready' : 'registering');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSwStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const favoritesList = useMemo(() => {
    if (!data) {
      return [];
    }
    return favorites
      .map((id) => data.speciesById[id])
      .filter((species) => Boolean(species));
  }, [data, favorites]);

  const taggedList = useMemo(() => (data ? data.species : []), [data]);

  function speciesWithTag(tag: UserTag) {
    return taggedList.filter((species) =>
      userTags[species.id]?.includes(tag),
    );
  }

  const notedSpecies = useMemo(
    () =>
      taggedList.filter(
        (species) => (userNotes[species.id] ?? '').trim().length > 0,
      ),
    [taggedList, userNotes],
  );

  const counts = useMemo(() => {
    const byTag: Record<UserTag, number> = {
      常买: 0,
      想试: 0,
      避雷: 0,
    };
    for (const tag of USER_TAGS) {
      byTag[tag] = speciesWithTag(tag).length;
    }
    return {
      all: favoritesList.length,
      notes: notedSpecies.length,
      ...byTag,
    };
  }, [favoritesList.length, notedSpecies.length, taggedList, userTags]);

  const filterTabs: { key: ListFilter; label: string; count: number }[] = [
    { key: 'all', label: '全部收藏', count: counts.all },
    ...USER_TAGS.map((tag) => ({
      key: tag as ListFilter,
      label: tag,
      count: counts[tag],
    })),
    { key: 'notes', label: '有笔记', count: counts.notes },
  ];

  const baseList = useMemo(() => {
    if (!data) {
      return [];
    }
    if (listFilter === 'all') {
      return favoritesList;
    }
    if (listFilter === 'notes') {
      return notedSpecies;
    }
    return data.species.filter((species) =>
      userTags[species.id]?.includes(listFilter),
    );
  }, [data, listFilter, favoritesList, notedSpecies, userTags]);

  const filteredList = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return baseList;
    }
    return baseList.filter((species) => {
      const note = userNotes[species.id] ?? '';
      const nameText = [
        species.names.zh_formal,
        species.names.latin,
        species.names.en_standard,
        ...Object.values(species.names.aliases).flat(),
      ]
        .join(' ')
        .toLowerCase();
      return (
        nameText.includes(normalized) ||
        note.toLowerCase().includes(normalized)
      );
    });
  }, [baseList, query, userNotes]);
  function handleExport() {
    if (isWeChatBrowser()) {
      setWechatTipVisible(true);
    }
    const payload = exportUserBackup();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = backupFilename();
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setFeedback({
      kind: 'success',
      message: `已导出 ${payload.favorites.length} 条收藏、${
        Object.keys(payload.userNotes).length
      } 条笔记。`,
    });
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!file.name.toLowerCase().endsWith('.json')) {
      setFeedback({ kind: 'error', message: '请选择 .json 格式的 HowFish 备份文件。' });
      return;
    }

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const ok = importUserBackup(parsed, importMode);
      if (ok) {
        setFeedback({
          kind: 'success',
          message:
            importMode === 'replace'
              ? '覆盖恢复完成，当前清单已替换为备份内容。'
              : '合并导入完成，新增内容已与当前清单合并。',
        });
      } else {
        setFeedback({
          kind: 'error',
          message: '备份内容无法识别，请确认文件来自 HowFish 导出。',
        });
      }
    } catch {
      setFeedback({
        kind: 'error',
        message: '文件解析失败，请检查 JSON 是否完整。',
      });
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-3">
        <div className="hf-card h-24 animate-pulse bg-white/60 dark:bg-[#102030]/60" />
        <div className="hf-card h-64 animate-pulse bg-white/60 dark:bg-[#102030]/60" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-6xl rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
        <p className="font-semibold">数据加载失败</p>
        <p className="mt-1 text-xs leading-5">
          {error ?? '离线数据不可用，请刷新重试。'}
        </p>
      </div>
    );
  }

  const enabledRegions = data.meta.enabled_regions
    .map((key) => {
      const label = data.regions.regions[key]?.label ?? key;
      return `${getRegionFlag(key)} ${label}`;
    })
    .join(' · ');

  const metaRows: { label: string; value: string }[] = [
    { label: '数据版本 schema', value: `v${data.meta.schema_version}` },
    { label: '物种总数', value: `${data.meta.total_species} 种` },
    { label: '分类节点', value: `${data.meta.taxonomy_count} 个` },
    { label: '防坑条目', value: `${data.meta.traps_count} 条` },
    { label: '重定向记录', value: `${data.meta.redirects_count} 条` },
    { label: '数据构建时间', value: data.meta.build_timestamp },
    { label: '已启用地区', value: enabledRegions || '—' },
    { label: '当前构建模式', value: IS_SINGLE_FILE ? '离线单文件模式' : 'PWA 站点模式' },
    { label: 'Service Worker 离线缓存', value: SERVICE_WORKER_LABEL[swStatus] },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl pb-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#0E86A8] dark:text-[#22D3EE]">
            <Star className="h-3.5 w-3.5" aria-hidden="true" />
            收藏、笔记与设置
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#0F172A] dark:text-[#F1F5F9] sm:text-2xl">
            我的清单
          </h1>
          <p className="mt-1 text-[11px] text-[#52667A] dark:text-[#94A3B8]">
            收藏、标签、私密笔记与外观设置都保存在本机浏览器。
          </p>
        </div>
        <p className="text-[11px] text-[#52667A] dark:text-[#94A3B8]">
          收藏 <span className="tabular-nums">{counts.all}</span> · 笔记{' '}
          <span className="tabular-nums">{counts.notes}</span>
        </p>
      </div>

      {wechatTipVisible ? (
        <div
          data-testid="wechat-browser-tip"
          role="status"
          className="mt-3 flex items-start gap-2 rounded-2xl border border-[#0B4F71]/20 bg-[#0B4F71]/[0.06] px-3 py-2.5 text-[11px] leading-5 text-[#0B4F71] dark:border-[#38BDF8]/25 dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">{WECHAT_OPEN_IN_BROWSER_TIP}</p>
          <button
            type="button"
            aria-label="关闭微信打开提示"
            onClick={() => setWechatTipVisible(false)}
            className="-mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#0B4F71]/10 dark:hover:bg-[#38BDF8]/15"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <section className="mt-3 rounded-3xl border border-[#E2EBF0] bg-white p-3 dark:border-[#1E354A] dark:bg-[#102030]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#52667A] dark:text-[#94A3B8]"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索物种名或我的笔记内容…"
            aria-label="搜索我的清单"
            className="hf-input h-10 pl-9 pr-3 text-xs"
          />
        </div>

        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {filterTabs.map((filterTab) => {
            const active = listFilter === filterTab.key;
            return (
              <button
                key={filterTab.key}
                type="button"
                aria-pressed={active}
                onClick={() => setListFilter(filterTab.key)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? 'border-[#0B4F71] bg-[#0B4F71] text-white dark:border-[#38BDF8] dark:bg-[#38BDF8] dark:text-[#07131F]'
                    : 'border-[#E2EBF0] bg-white text-[#52667A] hover:border-[#0B4F71]/30 dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#94A3B8]'
                }`}
              >
                {filterTab.label}
                <span
                  className={`rounded-full px-1 text-[9px] tabular-nums ${
                    active
                      ? 'bg-white/20 text-white dark:bg-[#07131F]/20 dark:text-[#07131F]'
                      : 'bg-[#0B4F71]/10 text-[#0B4F71] dark:bg-[#38BDF8]/15 dark:text-[#38BDF8]'
                  }`}
                >
                  {filterTab.count}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-[10px] text-[#52667A] dark:text-[#94A3B8]">
          当前显示 <span className="tabular-nums">{filteredList.length}</span> 种
          {query.trim() ? '（含笔记全文搜索）' : ''}
        </p>

        {filteredList.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-[#E2EBF0] px-4 py-10 text-center text-xs text-[#52667A] dark:border-[#1E354A] dark:text-[#94A3B8]">
            {query.trim()
              ? '没有匹配的收藏或笔记，换个关键词试试。'
              : listFilter === 'all'
                ? '还没有收藏物种，去速查页点星标即可加入清单。'
                : '该分组暂无内容。'}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {filteredList.map((species) => {
              const isFavorite = favorites.includes(species.id);
              const tags = userTags[species.id] ?? [];
              const note = userNotes[species.id] ?? '';
              return (
                <article
                  key={species.id}
                  className="flex gap-2.5 rounded-2xl border border-[#E2EBF0] bg-[#F6F9FB]/60 p-2.5 dark:border-[#1E354A] dark:bg-[#0B1824]/60"
                >
                  <Link
                    to={`/species/${species.id}`}
                    className="shrink-0"
                    aria-label={`查看 ${species.names.zh_formal} 详情`}
                  >
                    <SpeciesPlaceholderSvg
                      category={species.category}
                      fleshColor={null}
                      cover={species.media.cover}
                      alt={species.names.zh_formal}
                      id={species.id}
                      className="h-14 w-14 rounded-xl border border-[#E2EBF0]/80 dark:border-[#1E354A]/80"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1.5">
                      <Link
                        to={`/species/${species.id}`}
                        className="min-w-0 flex-1"
                      >
                        <h2 className="line-clamp-1 text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                          {species.names.zh_formal}
                        </h2>
                        <p className="line-clamp-1 text-[10px] italic text-[#52667A] dark:text-[#94A3B8]">
                          {species.names.latin}
                        </p>
                      </Link>
                      <button
                        type="button"
                        aria-pressed={isFavorite}
                        aria-label={
                          isFavorite
                            ? `取消收藏 ${species.names.zh_formal}`
                            : `收藏 ${species.names.zh_formal}`
                        }
                        onClick={() => toggleFavorite(species.id)}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          isFavorite
                            ? 'border-amber-300 bg-amber-50 text-amber-500 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300'
                            : 'border-[#E2EBF0] text-[#52667A] hover:border-amber-300 hover:text-amber-500 dark:border-[#1E354A] dark:text-[#94A3B8]'
                        }`}
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current' : ''}`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-1">
                      {tags.length > 0 ? (
                        tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-[#0B4F71]/15 bg-[#0B4F71]/[0.06] px-1.5 py-0.5 text-[9px] font-semibold text-[#0B4F71] dark:border-[#38BDF8]/20 dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-[9px] text-[#94A3B8] dark:text-[#52667A]">
                          暂无标签
                        </span>
                      )}
                    </div>

                    {note ? (
                      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#52667A] dark:text-[#CBD5E1]">
                        笔记：{noteSnippet(note)}
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px] text-[#94A3B8] dark:text-[#52667A]">
                        暂无笔记
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <section className="mt-3 rounded-3xl border border-[#E2EBF0] bg-white p-3.5 dark:border-[#1E354A] dark:bg-[#102030]">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0B4F71]/10 text-[#0B4F71] dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
            <Database className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
              数据备份与迁移
            </h2>
            <p className="text-[11px] text-[#52667A] dark:text-[#94A3B8]">
              导出全部收藏、标签、私密笔记与对比队列，或从备份恢复。
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0B4F71] px-3 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 dark:bg-[#38BDF8] dark:text-[#07131F]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            导出备份 JSON
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E2EBF0] bg-white px-3 text-[11px] font-semibold text-[#0B4F71] transition-colors hover:border-[#0B4F71]/30 dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#38BDF8]"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            导入恢复备份
          </button>
          <FileJson
            className="hidden h-4 w-4 text-[#94A3B8] sm:block"
            aria-hidden="true"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => void handleImportFile(event)}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium text-[#52667A] dark:text-[#94A3B8]">
            导入方式
          </span>
          <div className="inline-flex rounded-full border border-[#E2EBF0] bg-[#F6F9FB] p-0.5 dark:border-[#1E354A] dark:bg-[#0B1824]">
            {(
              [
                { value: 'merge', label: '合并导入' },
                { value: 'replace', label: '覆盖恢复' },
              ] as const
            ).map((mode) => {
              const active = importMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setImportMode(mode.value)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                    active
                      ? 'bg-[#0B4F71] text-white dark:bg-[#38BDF8] dark:text-[#07131F]'
                      : 'text-[#52667A] dark:text-[#94A3B8]'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-1.5 text-[10px] leading-4 text-[#94A3B8] dark:text-[#52667A]">
          {importMode === 'merge'
            ? '合并导入：保留现有内容，并与备份中的收藏、标签与笔记合并。'
            : '覆盖恢复：用备份内容替换当前收藏、标签、笔记与对比队列。'}
        </p>

        {feedback ? (
          <div
            role={feedback.kind === 'error' ? 'alert' : 'status'}
            className={`mt-2 flex items-start gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] leading-5 ${
              feedback.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
            }`}
          >
            {feedback.kind === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
        ) : null}
      </section>

      <section className="mt-3 grid gap-3 lg:grid-cols-5">
        <div className="rounded-3xl border border-[#E2EBF0] bg-white p-3.5 dark:border-[#1E354A] dark:bg-[#102030] lg:col-span-2">
          <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
            外观与离线状态
          </h2>
          <p className="mt-0.5 text-[11px] text-[#52667A] dark:text-[#94A3B8]">
            默认跟随系统，也可手动固定浅色或深色模式。
          </p>

          <div className="mt-3 grid grid-cols-3 gap-1">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTheme(option.value)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border px-1.5 py-2 text-[10px] font-semibold transition-colors ${
                    active
                      ? 'border-[#0B4F71] bg-[#0B4F71]/[0.07] text-[#0B4F71] dark:border-[#38BDF8] dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]'
                      : 'border-[#E2EBF0] text-[#52667A] hover:border-[#0B4F71]/30 dark:border-[#1E354A] dark:text-[#94A3B8]'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[#E2EBF0] bg-[#F6F9FB] px-2.5 py-2 dark:border-[#1E354A] dark:bg-[#0B1824]">
            {swStatus === 'ready' ? (
              <Wifi
                className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300"
                aria-hidden="true"
              />
            ) : (
              <WifiOff
                className="h-4 w-4 shrink-0 text-[#94A3B8] dark:text-[#52667A]"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                Service Worker 离线缓存
              </p>
              <p className="text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                {SERVICE_WORKER_LABEL[swStatus]}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-[#E2EBF0] bg-white p-3.5 dark:border-[#1E354A] dark:bg-[#102030] lg:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
              数据版本与离线状态
            </h2>
            <span className="rounded-full border border-[#0B4F71]/15 bg-[#0B4F71]/[0.06] px-2 py-0.5 text-[9px] font-semibold text-[#0B4F71] dark:border-[#38BDF8]/20 dark:bg-[#38BDF8]/10 dark:text-[#38BDF8]">
              {IS_SINGLE_FILE ? '离线单文件模式' : 'PWA 站点模式'}
            </span>
          </div>

          <dl className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {metaRows.map((row) => (
              <div
                key={row.label}
                className="flex items-start justify-between gap-2 rounded-xl border border-[#E2EBF0]/70 bg-[#F6F9FB]/60 px-2.5 py-1.5 dark:border-[#1E354A]/70 dark:bg-[#0B1824]/60"
              >
                <dt className="shrink-0 text-[10px] text-[#52667A] dark:text-[#94A3B8]">
                  {row.label}
                </dt>
                <dd className="min-w-0 break-words text-right text-[10px] font-medium tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}