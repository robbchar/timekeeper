import { KeyboardEvent, useRef, useState } from "react";

/**
 * Click-to-edit state: blur commits, Escape cancels (it leaves through blur too), and a draft that
 * fails to commit is kept until `value` changes elsewhere.
 */
export function useInlineEdit<V>(
  value: V,
  toDraft: (value: V) => string,
  commit: (draft: string) => Promise<void>,
  onError: (err: unknown) => void,
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(value));
  const cancelled = useRef(false);
  // The value a failed draft was based on.
  const [failedBase, setFailedBase] = useState<V | null>(null);
  const unsaved = failedBase === value;

  const open = () => {
    if (!unsaved) setDraft(toDraft(value));
    setEditing(true);
  };

  const cancel = (e: KeyboardEvent<HTMLElement>) => {
    cancelled.current = true;
    e.currentTarget.blur();
  };

  const finish = async () => {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      setFailedBase(null);
      setDraft(toDraft(value));
      return;
    }
    try {
      await commit(draft);
    } catch (err) {
      setFailedBase(value);
      onError(err);
      return;
    }
    setFailedBase(null);
  };

  return { editing, draft, setDraft, unsaved, open, cancel, finish };
}
