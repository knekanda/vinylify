import { renderHook, act } from "@testing-library/react";
import { useSearch } from "../../hooks/useSearch";
import { vi } from "vitest";

describe("useSearch", () => {
  it("clears results for empty query and ignores stale responses", async () => {
    const fetcher = vi.fn(async (q: string, signal: AbortSignal) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ q, ts: Date.now() });
        }, q.length === 1 ? 100 : 50); // first call slower
      });
    });

    const { result } = renderHook(() => useSearch(fetcher));

    await act(async () => {
      // first, type 'a' (will take 100ms)
      const p1 = result.current.run("a");
      // then quickly type 'ab' (50ms)
      const p2 = result.current.run("ab");
      // wait long enough
      await p1;
      await p2;
    });

    // ensure the last data corresponds to 'ab'
    expect(result.current.data).not.toBeNull();
    // we know fetcher returns { q, ts }
    if (result.current.data) {
      const data = result.current.data as { q: string; ts: number };
      expect(data.q).toBe("ab");
    }

    // empty query clears
    await act(async () => {
      await result.current.run("");
    });
    expect(result.current.data).toBeNull();
  });
});
