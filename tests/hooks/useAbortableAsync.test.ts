import { renderHook, act } from "@testing-library/react";
import { useAbortableAsync } from "../../hooks/useAbortableAsync";
import { vi } from "vitest";

describe("useAbortableAsync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns latest result and marks previous as stale", async () => {
    // The asyncFn deliberately ignores abort and still resolves, so the first
    // in-flight call settles and is detected as stale via the requestId guard.
    const asyncFn = vi.fn(async (val: number, _signal: AbortSignal) => {
      void _signal;
      return new Promise<number>((resolve) => {
        setTimeout(() => {
          resolve(val * 10);
        }, 100);
      });
    });

    const { result } = renderHook(() => useAbortableAsync(asyncFn));

    let firstRes;
    let secondRes;
    act(() => {
      firstRes = result.current.run(1);
      secondRes = result.current.run(2);
      vi.advanceTimersByTime(150);
    });

    const r1 = await firstRes;
    const r2 = await secondRes;

    expect(r1.ok).toBe(false);
    expect(r1.reason).toBe("stale");
    expect(r2.ok).toBe(true);
    expect(r2.result).toBe(20);
  });

  it("returns aborted when cancelled", async () => {
    const asyncFn = vi.fn(async (_val: number, signal: AbortSignal) => {
      return new Promise<number>((resolve, reject) => {
        const t = setTimeout(() => {
          if (signal.aborted) reject(new Error("aborted"));
          else resolve(42);
        }, 100);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new Error("aborted"));
        });
      });
    });

    const { result } = renderHook(() => useAbortableAsync(asyncFn));

    let resPromise;
    act(() => {
      resPromise = result.current.run(1);
      result.current.abort();
      vi.advanceTimersByTime(150);
    });

    const res = await resPromise;
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("aborted");
  });
});
