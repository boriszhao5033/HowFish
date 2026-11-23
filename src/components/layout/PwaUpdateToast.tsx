import { RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const SINGLE_FILE = import.meta.env.VITE_SINGLE_FILE === 'true';

export function PwaUpdateToast() {
  const [waiting, setWaiting] = useState<ServiceWorkerRegistration | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    if (SINGLE_FILE || !('serviceWorker' in navigator)) {
      return;
    }

    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;

    const checkWaiting = () => {
      if (disposed || !registration) {
        return;
      }
      if (registration.waiting && navigator.serviceWorker.controller) {
        setWaiting(registration);
      }
    };

    const onUpdateFound = () => {
      if (!registration) {
        return;
      }
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
          checkWaiting();
        }
      });
    };

    const onControllerChange = () => {
      if (!disposed) {
        setOfflineReady(true);
      }
    };

    navigator.serviceWorker.ready
      .then((readyRegistration) => {
        if (disposed) {
          return;
        }
        registration = readyRegistration;
        registration.addEventListener('updatefound', onUpdateFound);
        checkWaiting();
      })
      .catch(() => {
        /* Service workers may be unavailable in private browsing. */
      });

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange,
      );
      registration?.removeEventListener('updatefound', onUpdateFound);
    };
  }, []);

  useEffect(() => {
    if (!offlineReady) {
      return;
    }
    const timer = window.setTimeout(() => setOfflineReady(false), 5000);
    return () => window.clearTimeout(timer);
  }, [offlineReady]);

  if (SINGLE_FILE || (!waiting && !offlineReady)) {
    return null;
  }

  const reloadWithUpdate = () => {
    waiting?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    setWaiting(null);
    window.setTimeout(() => window.location.reload(), 400);
  };

  return (
    <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 lg:bottom-6 lg:left-[calc(50%+2.5rem)]">
      <div
        role="status"
        className="glass flex items-center gap-2 rounded-2xl border border-[#0B4F71]/15 px-3 py-2.5 shadow-[0_18px_45px_-22px_rgba(11,79,113,0.55)] dark:border-[#38BDF8]/25"
      >
        <span className="min-w-0 flex-1 text-xs leading-5 text-[#0B4F71] dark:text-[#38BDF8]">
          {waiting ? '发现新版本与最新海产数据' : '离线数据缓存已就绪'}
        </span>
        {waiting ? (
          <button
            type="button"
            onClick={reloadWithUpdate}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[#0B4F71] px-3 text-xs font-semibold text-white dark:bg-[#38BDF8] dark:text-[#07131F]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            更新
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setWaiting(null);
            setOfflineReady(false);
          }}
          aria-label="关闭提示"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#52667A] hover:bg-[#0B4F71]/10 dark:text-[#94A3B8] dark:hover:bg-[#38BDF8]/10"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}