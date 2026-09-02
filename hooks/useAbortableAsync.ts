import { useRef, useEffect, useCallback } from "react";

type AsyncFn<TArgs extends unknown[], TResult> = (...args: [...TArgs, AbortSignal]) => Promise<TResult>;

/**
 * useAbortableAsync
 * - Manages an AbortController per call and a requestId to ignore out-of-order responses.
 * - run(...) returns an object: { ok: true, result } or { ok: false, reason }.
 */
export function useAbortableAsync<TArgs extends unknown[], TResult>(asyncFn: AsyncFn<TArgs, TResult>) {
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  const run = useCallback(
    async (...args: TArgs) => {
      // cancel previous request
      controllerRef.current?.abort();

      const id = ++requestIdRef.current;
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const result = await asyncFn(...args, controller.signal);
        if (id === requestIdRef.current) {
          return { ok: true as const, result };
        } else {
          return { ok: false as const, reason: "stale" as const };
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          return { ok: false as const, reason: "aborted" as const };
        }
        return { ok: false as const, reason: err };
      }
    },
    [asyncFn]
  );

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  return { run, abort };
}
