import React, { useState } from 'react';
import { Textarea } from '@heroui/react';

interface ActiveSessionNotesProps {
  initialNotes: string;
  onSave: (notes: string) => void;
}

/** Notes for the session in progress. Saves on blur or Enter; Shift+Enter adds a line. */
const ActiveSessionNotes: React.FC<ActiveSessionNotesProps> = ({ initialNotes, onSave }) => {
  const [draftNotes, setDraftNotes] = useState(initialNotes);

  const saveIfChanged = () => {
    if (draftNotes !== initialNotes) {
      onSave(draftNotes);
    }
  };

  return (
    <Textarea
      aria-label="Session notes"
      value={draftNotes}
      onChange={event => setDraftNotes(event.target.value)}
      onBlur={saveIfChanged}
      onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      className="max-w-full bg-white"
      placeholder="Add notes for session..."
      minRows={1}
    />
  );
};

export default ActiveSessionNotes;
