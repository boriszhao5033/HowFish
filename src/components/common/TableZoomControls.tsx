import { ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';

export const ZOOM_MIN = 0.55;
export const ZOOM_MAX = 1.25;
export const ZOOM_STEP = 0.1;

export interface PinchZoomOptions {
  min?: number;
  max?: number;
}

function clampZoom(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundZoom(value: number): number {
  return Number(value.toFixed(2));
}

function touchDistance(touches: TouchList): number {
  if (touches.length < 2) {
    return 0;
  }
  const first = touches[0];
  const second = touches[1];
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

/**
 * Two-finger pinch zoom for a scrollable container.
 *
 * Single-finger gestures are deliberately ignored so normal scrolling and
 * drag-to-pan keep working untouched.
 */
export function usePinchZoom(
  ref: RefObject<HTMLElement | null>,
  zoom: number,
  setZoom: (next: number) => void,
  { min = ZOOM_MIN, max = ZOOM_MAX }: PinchZoomOptions = {},
): void {
  const zoomRef = useRef(zoom);
  const setZoomRef = useRef(setZoom);
  zoomRef.current = zoom;
  setZoomRef.current = setZoom;

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    let startDistance = 0;
    let startZoom = zoomRef.current;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) {
        return;
      }
      startDistance = touchDistance(event.touches);
      startZoom = zoomRef.current;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || startDistance <= 0) {
        return;
      }
      const distance = touchDistance(event.touches);
      if (distance <= 0) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
      const next = clampZoom((startZoom * distance) / startDistance, min, max);
      setZoomRef.current(roundZoom(next));
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        startDistance = 0;
      }
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd);
    element.addEventListener('touchcancel', onTouchEnd);

    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
      element.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [ref, min, max]);
}

export interface TableZoomControlsProps {
  zoom: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export function TableZoomControls({
  zoom,
  onChange,
  min = ZOOM_MIN,
  max = ZOOM_MAX,
  className,
}: TableZoomControlsProps) {
  const percent = Math.round(zoom * 100);
  const changeTo = (value: number) => {
    onChange(roundZoom(clampZoom(value, min, max)));
  };

  return (
    <div
      data-testid="table-zoom-controls"
      className={`inline-flex h-9 shrink-0 items-center gap-0.5 rounded-full border border-[#E2EBF0] bg-white/90 px-1 shadow-[0_8px_18px_-16px_rgba(11,79,113,0.55)] dark:border-[#1E354A] dark:bg-[#102030]/90 ${
        className ?? ''
      }`}
    >
      <button
        type="button"
        aria-label="缩小"
        title="缩小"
        disabled={zoom <= min + 1e-6}
        onClick={() => changeTo(zoom - ZOOM_STEP)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[#0B4F71] transition-colors hover:bg-[#0B4F71]/10 disabled:cursor-not-allowed disabled:opacity-35 dark:text-[#38BDF8] dark:hover:bg-[#38BDF8]/10"
      >
        <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="重置缩放"
        title="点击重置为 100%"
        onClick={() => onChange(1)}
        className="min-w-[3.2rem] rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums text-[#0B4F71] transition-colors hover:bg-[#0B4F71]/10 dark:text-[#38BDF8] dark:hover:bg-[#38BDF8]/10"
      >
        {percent}%
      </button>
      <button
        type="button"
        aria-label="放大"
        title="放大"
        disabled={zoom >= max - 1e-6}
        onClick={() => changeTo(zoom + ZOOM_STEP)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[#0B4F71] transition-colors hover:bg-[#0B4F71]/10 disabled:cursor-not-allowed disabled:opacity-35 dark:text-[#38BDF8] dark:hover:bg-[#38BDF8]/10"
      >
        <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
