import { ChevronLeft, ChevronRight, MoveHorizontal } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from 'react';

export const DRAG_SCROLL_THRESHOLD_PX = 6;
export const SCROLL_STEP_PX = 240;

interface ScrollMetrics {
  scrollLeft: number;
  maxScroll: number;
}

const ZERO_METRICS: ScrollMetrics = { scrollLeft: 0, maxScroll: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function describeDeps(deps?: unknown[]): string {
  if (!deps || deps.length === 0) {
    return '';
  }
  try {
    return JSON.stringify(deps);
  } catch {
    return String(deps.length);
  }
}

export interface HorizontalScrollSyncBarProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  deps?: unknown[];
  className?: string;
}

export function HorizontalScrollSyncBar({
  scrollRef,
  deps,
  className,
}: HorizontalScrollSyncBarProps) {
  const [metrics, setMetrics] = useState<ScrollMetrics>(ZERO_METRICS);
  const depSignature = describeDeps(deps);

  const measure = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      setMetrics((previous) =>
        previous.scrollLeft === 0 && previous.maxScroll === 0
          ? previous
          : ZERO_METRICS,
      );
      return;
    }
    const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
    const scrollLeft = clamp(element.scrollLeft, 0, maxScroll);
    setMetrics((previous) =>
      previous.scrollLeft === scrollLeft && previous.maxScroll === maxScroll
        ? previous
        : { scrollLeft, maxScroll },
    );
  }, [scrollRef]);

  useEffect(() => {
    const element = scrollRef.current;
    measure();
    if (!element) {
      return;
    }

    const onScroll = () => measure();
    element.addEventListener('scroll', onScroll, { passive: true });

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => measure());
      observer.observe(element);
      for (const child of Array.from(element.children)) {
        observer.observe(child);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onScroll);
    }

    return () => {
      element.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', onScroll);
      }
    };
  }, [measure, scrollRef, depSignature]);

  if (metrics.maxScroll <= 2) {
    return null;
  }

  const percent = Math.round(
    clamp((metrics.scrollLeft / metrics.maxScroll) * 100, 0, 100),
  );
  const atStart = metrics.scrollLeft <= 1;
  const atEnd = metrics.scrollLeft >= metrics.maxScroll - 1;

  const scrollByStep = (direction: -1 | 1) => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
    const target = clamp(
      element.scrollLeft + direction * SCROLL_STEP_PX,
      0,
      maxScroll,
    );
    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ left: target, behavior: 'smooth' });
    } else {
      element.scrollLeft = target;
    }
    setMetrics({ scrollLeft: target, maxScroll });
  };

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const element = scrollRef.current;
    const value = Number(event.target.value);
    if (!element || Number.isNaN(value)) {
      return;
    }
    const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
    const next = clamp(value, 0, maxScroll);
    element.scrollLeft = next;
    setMetrics({ scrollLeft: next, maxScroll });
  };

  return (
    <div
      data-testid="horizontal-scroll-sync-bar"
      className={`flex items-center gap-2 rounded-2xl border border-[#E2EBF0] bg-white/85 px-2 py-1.5 shadow-[0_10px_24px_-22px_rgba(11,79,113,0.55)] backdrop-blur dark:border-[#1E354A] dark:bg-[#0B1824]/85 ${
        className ?? ''
      }`}
    >
      <span className="hidden shrink-0 items-center gap-1 text-[10px] font-medium text-[#52667A] dark:text-[#94A3B8] sm:inline-flex">
        <MoveHorizontal
          className="h-3.5 w-3.5 text-[#0E86A8] dark:text-[#22D3EE]"
          aria-hidden="true"
        />
        左右滑动查看全部列
      </span>

      <button
        type="button"
        aria-label="向左滚动"
        disabled={atStart}
        onClick={() => scrollByStep(-1)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#E2EBF0] bg-white text-[#0B4F71] transition-colors hover:border-[#0B4F71]/40 hover:bg-[#0B4F71]/5 disabled:cursor-not-allowed disabled:opacity-35 dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#38BDF8] dark:hover:border-[#38BDF8]/40 dark:disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">‹</span>
      </button>

      <input
        type="range"
        aria-label="水平滚动位置"
        aria-valuetext={`${percent}% / 100%`}
        title="0%–100%"
        min={0}
        max={Math.round(metrics.maxScroll)}
        step={1}
        value={Math.round(clamp(metrics.scrollLeft, 0, metrics.maxScroll))}
        onChange={handleSliderChange}
        className="hf-hscroll-range h-2 min-w-0 flex-1 cursor-pointer appearance-none"
      />

      <button
        type="button"
        aria-label="向右滚动"
        disabled={atEnd}
        onClick={() => scrollByStep(1)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#E2EBF0] bg-white text-[#0B4F71] transition-colors hover:border-[#0B4F71]/40 hover:bg-[#0B4F71]/5 disabled:cursor-not-allowed disabled:opacity-35 dark:border-[#1E354A] dark:bg-[#102030] dark:text-[#38BDF8] dark:hover:border-[#38BDF8]/40 dark:disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">›</span>
      </button>

      <span className="w-9 shrink-0 text-right text-[10px] font-semibold tabular-nums text-[#0B4F71] dark:text-[#38BDF8]">
        {percent}%
      </span>
    </div>
  );
}

export interface DragToScrollHandle {
  wasDraggingRef: RefObject<boolean>;
}

const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, label, [data-no-drag], [contenteditable="true"]';

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest(INTERACTIVE_SELECTOR));
}

export function useDragToScroll(
  scrollRef: RefObject<HTMLElement | null>,
  deps?: unknown[],
): DragToScrollHandle {
  const wasDraggingRef = useRef(false);
  const depSignature = describeDeps(deps);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    let activePointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let moved = false;
    let clearTimer: number | null = null;

    const resetCursor = () => {
      element.classList.remove('cursor-grabbing', 'select-none', 'hf-dragging');
      element.classList.add('cursor-grab');
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) {
        return;
      }
      if (activePointerId !== null || isInteractiveTarget(event.target)) {
        return;
      }
      activePointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = element.scrollLeft;
      startTop = element.scrollTop;
      moved = false;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (activePointerId === null || event.pointerId !== activePointerId) {
        return;
      }
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;

      if (!moved) {
        if (Math.hypot(deltaX, deltaY) < DRAG_SCROLL_THRESHOLD_PX) {
          return;
        }
        moved = true;
        wasDraggingRef.current = true;
        element.classList.remove('cursor-grab');
        element.classList.add('cursor-grabbing', 'select-none', 'hf-dragging');
        if (typeof element.setPointerCapture === 'function') {
          try {
            element.setPointerCapture(event.pointerId);
          } catch {
            /* pointer capture is best-effort */
          }
        }
      }

      event.preventDefault();
      element.scrollLeft = startLeft - deltaX;
      element.scrollTop = startTop - deltaY;
    };

    const finishDrag = (event: PointerEvent) => {
      if (activePointerId === null || event.pointerId !== activePointerId) {
        return;
      }
      const pointerId = activePointerId;
      activePointerId = null;
      if (typeof element.releasePointerCapture === 'function') {
        try {
          element.releasePointerCapture(pointerId);
        } catch {
          /* pointer capture is best-effort */
        }
      }
      if (!moved) {
        return;
      }
      moved = false;
      resetCursor();
      if (clearTimer !== null) {
        window.clearTimeout(clearTimer);
      }
      clearTimer = window.setTimeout(() => {
        clearTimer = null;
        wasDraggingRef.current = false;
      }, 0);
    };

    const onClickCapture = (event: MouseEvent) => {
      if (wasDraggingRef.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    element.classList.add('cursor-grab');
    element.addEventListener('pointerdown', onPointerDown);
    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', finishDrag);
      window.addEventListener('pointercancel', finishDrag);
    }
    element.addEventListener('click', onClickCapture, true);

    return () => {
      if (clearTimer !== null) {
        window.clearTimeout(clearTimer);
        clearTimer = null;
      }
      wasDraggingRef.current = false;
      element.classList.remove(
        'cursor-grab',
        'cursor-grabbing',
        'select-none',
        'hf-dragging',
      );
      element.removeEventListener('pointerdown', onPointerDown);
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', finishDrag);
        window.removeEventListener('pointercancel', finishDrag);
      }
      element.removeEventListener('click', onClickCapture, true);
    };
  }, [scrollRef, depSignature]);

  return { wasDraggingRef };
}