import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns a function whose identity never changes but which always invokes the
 * latest version of `callback`.
 *
 * Use it for callbacks handed to long-lived subscriptions — event listeners,
 * intervals, timers — that must read current props and state without being torn
 * down and re-registered on every render. Passing such a callback directly
 * forces a choice between a stale closure (empty dependency array) and
 * resubscribing constantly, which for an interval means it never fires.
 *
 * Do not use it for values consumed during render; the returned function is
 * only safe to call from effects and event handlers.
 */
export function useEventCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result
): (...args: Args) => Result {
  const callbackRef = useRef(callback);

  // Deliberately no dependency array: the ref tracks every render.
  useEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback((...args: Args) => callbackRef.current(...args), []);
}
