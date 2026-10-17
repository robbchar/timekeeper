import { useState } from "react";

export interface Pending<T> {
  shown: T;
  hold: (value: T) => void;
  drop: () => void;
}

/** A value being saved, shown in place of `actual` until a refresh moves `actual` off its base. */
export function usePending<T>(actual: T): Pending<T> {
  const [pending, setPending] = useState<{ base: T; value: T } | null>(null);
  if (pending && pending.base !== actual) setPending(null);
  return {
    shown: pending ? pending.value : actual,
    hold: (value) => setPending({ base: actual, value }),
    drop: () => setPending(null),
  };
}
