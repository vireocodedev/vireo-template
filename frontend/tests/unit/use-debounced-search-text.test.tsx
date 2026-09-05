import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedSearchText } from "@/features/entity-query-filters/public";

describe("useDebouncedSearchText", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("synchronizes an externally changed value without committing it back", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(({ value }) => useDebouncedSearchText(value, 300, onCommit), {
      initialProps: { value: "Portable" },
    });

    rerender({ value: "Thermal" });
    act(() => vi.advanceTimersByTime(300));

    expect(result.current.input).toBe("Thermal");
    expect(result.current.committed).toBe("Thermal");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("reports debounced, immediate, and cleared commits", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDebouncedSearchText("", 300, onCommit));

    act(() => result.current.setInput("  Portable  "));
    act(() => vi.advanceTimersByTime(300));
    expect(onCommit).toHaveBeenLastCalledWith("Portable");

    act(() => result.current.commitNow("  Thermal  "));
    expect(onCommit).toHaveBeenLastCalledWith("Thermal");

    act(() => result.current.clear());
    expect(onCommit).toHaveBeenLastCalledWith("");
  });
});
