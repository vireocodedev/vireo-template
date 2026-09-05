import React from "react";

export function useDebouncedSearchText(initialValue: string, delay = 300, onCommit?: (value: string) => void) {
  const createSynchronizedState = React.useCallback(
    () => ({ committed: initialValue.trim(), dirty: false, input: initialValue, source: initialValue }),
    [initialValue],
  );
  const [state, setState] = React.useState(createSynchronizedState);
  const synchronizedState = state.source === initialValue ? state : createSynchronizedState();
  const { committed, dirty, input } = synchronizedState;

  const setInput = React.useCallback<React.Dispatch<React.SetStateAction<string>>>(
    update => {
      setState(current => {
        const synchronized = current.source === initialValue ? current : createSynchronizedState();
        const nextInput = typeof update === "function" ? update(synchronized.input) : update;
        return { ...synchronized, dirty: true, input: nextInput };
      });
    },
    [createSynchronizedState, initialValue],
  );

  React.useEffect(() => {
    if (!dirty) return;
    const timeout = window.setTimeout(() => {
      const normalized = input.trim();
      setState(current => ({
        ...(current.source === initialValue ? current : createSynchronizedState()),
        committed: normalized,
        dirty: false,
      }));
      onCommit?.(normalized);
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [createSynchronizedState, delay, dirty, initialValue, input, onCommit]);

  const commitNow = React.useCallback(
    (value = input) => {
      const normalized = value.trim();
      setState({ committed: normalized, dirty: false, input: value, source: initialValue });
      onCommit?.(normalized);
    },
    [initialValue, input, onCommit],
  );

  const clear = React.useCallback(() => {
    setState({ committed: "", dirty: false, input: "", source: initialValue });
    onCommit?.("");
  }, [initialValue, onCommit]);

  return React.useMemo(
    () => ({ input, committed, setInput, commitNow, clear }) as const,
    [clear, commitNow, committed, input, setInput],
  );
}
