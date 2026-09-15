import React, { useCallback, useEffect, useRef } from 'react';
import { SessionDurationEditBox } from './SessionDurationEditBox';

interface ElapsedTimeEditorProps {
  initialSeconds: number;
  onSave: (seconds: number) => void;
  onCancel: () => void;
}

/** Inline hours/minutes/seconds editor. Enter or leaving the editor saves; Escape cancels. */
export const ElapsedTimeEditor: React.FC<ElapsedTimeEditorProps> = ({
  initialSeconds,
  onSave,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const draftSecondsRef = useRef(initialSeconds);
  const hasFinishedRef = useRef(false);

  useEffect(() => {
    containerRef.current?.querySelector('input')?.focus();
  }, []);

  const handleDraftChange = useCallback((seconds: number) => {
    draftSecondsRef.current = seconds;
  }, []);

  // Enter or Escape can be followed by a blur, which must not finish a second time.
  const finish = (outcome: 'save' | 'cancel') => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;

    if (outcome === 'save') {
      onSave(draftSecondsRef.current);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish('save');
    } else if (event.key === 'Escape') {
      event.preventDefault();
      finish('cancel');
    }
  };

  const handleBlur = (event: React.FocusEvent) => {
    const focusStaysInside = containerRef.current?.contains(event.relatedTarget as Node | null);
    if (!focusStaysInside) {
      finish('save');
    }
  };

  // The arrow controls are not focusable, so clicking them would otherwise blur the editor.
  const keepFocusInside = (event: React.MouseEvent) => {
    if (!(event.target instanceof HTMLInputElement)) {
      event.preventDefault();
    }
  };

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Elapsed time"
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onMouseDown={keepFocusInside}
    >
      <SessionDurationEditBox initialDuration={initialSeconds} onChange={handleDraftChange} />
    </div>
  );
};
