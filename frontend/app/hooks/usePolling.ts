"use client";

import { useEffect, useRef, useCallback } from "react";

const DEFAULT_INTERVAL_MS = 10_000; // 10 detik

interface UsePollingOptions {
  /** Callback yang dipanggil setiap interval. Return false untuk stop. */
  onTick: () => void | Promise<void>;
  /** Interval dalam ms. Default 10_000. */
  intervalMs?: number;
  /** Mulai polling saat mount. Default true. */
  enabled?: boolean;
}

/**
 * Polling hook — memanggil `onTick` setiap `intervalMs` ms.
 * Otomatis pause saat tab tidak aktif (visibilitychange), resume saat kembali.
 */
export function usePolling({
  onTick,
  intervalMs = DEFAULT_INTERVAL_MS,
  enabled = true,
}: UsePollingOptions) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef(onTick);

  // Selalu pakai versi terbaru dari onTick tanpa restart interval
  useEffect(() => {
    tickRef.current = onTick;
  }, [onTick]);

  const start = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      tickRef.current();
    }, intervalMs);
  }, [intervalMs]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    start();

    function handleVisibility() {
      if (document.hidden) {
        stop();
      } else {
        // Resume + immediate tick saat tab kembali aktif
        tickRef.current();
        start();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, start, stop]);
}
