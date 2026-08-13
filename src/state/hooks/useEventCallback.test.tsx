import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useEventCallback } from './useEventCallback';

describe('useEventCallback', () => {
  it('keeps a stable identity across renders', () => {
    const { result, rerender } = renderHook(() => useEventCallback(() => undefined));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('calls the latest callback rather than the one from first render', () => {
    const { result, rerender } = renderHook(({ value }) => useEventCallback(() => value), {
      initialProps: { value: 'first' },
    });
    const stable = result.current;

    rerender({ value: 'second' });

    expect(stable()).toBe('second');
  });

  it('reads current state, not the state captured at subscription time', () => {
    // The shape that matters: a listener registered once still sees updates.
    const { result } = renderHook(() => {
      const [count, setCount] = useState(0);
      return { setCount, read: useEventCallback(() => count) };
    });
    const read = result.current.read;

    act(() => result.current.setCount(5));

    expect(read()).toBe(5);
  });

  it('forwards arguments and returns the result', () => {
    const { result } = renderHook(() => useEventCallback((a: number, b: number) => a + b));

    expect(result.current(2, 3)).toBe(5);
  });
});
