import React, { useState } from 'react';
import styled from 'styled-components';
import { formatDuration } from '@/utils/time';
import type { Session } from '@/types/session';
import { Button, ButtonGroup, Form, Input } from '@heroui/react';
import { useSessions } from '@/state/hooks/useAppState';
import { SessionDurationEditBox } from './SessionDurationEditBox';

const SessionList = styled.div`
  background-color: ${({ theme }) => theme.colors.background.secondary};
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const SessionListHeader = styled.h2`
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: 1rem;
  font-size: 1.25rem;
`;

const SessionItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:last-child {
    border-bottom: none;
  }
`;

const SessionInfo = styled.div`
  display: flex;
  gap: 0.25rem;
  align-items: center;
  width: 100%;
  justify-content: flex-end;
`;

const SessionNotes = styled.span`
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: 0.875rem;
  margin-right: auto;
`;

const SessionDuration = styled.span`
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: 0.875rem;
`;

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ModalContent = styled.div`
  background: ${({ theme }) => theme.colors.background.primary};
  padding: 2rem;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 500px;
`;

const ModalTitle = styled.h2`
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
`;

const ErrorMessage = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-size: 0.875rem;
  margin-top: 0.5rem;
`;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (notes: string, duration: number) => void;
  modalTitle: string;
  initialNotes: string | undefined;
  initialDuration: number | undefined;
}

const EditSessionsModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  modalTitle,
  initialNotes = '',
  initialDuration = 0,
}) => {
  const [sessionNotes, setSessionNotes] = useState(initialNotes);
  const [sessionDuration, setSessionDuration] = useState(initialDuration);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setSessionNotes(initialNotes);
    setError(null);
  }, [initialNotes, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNotes = sessionNotes.trim();
    if (!trimmedNotes) {
      setError('Session notes are required');
      return;
    }

    if (sessionDuration < 0) {
      setError('Session duration is required');
      return;
    }

    onSubmit(trimmedNotes, sessionDuration);
  };

  if (!isOpen) return null;

  return (
    <Modal onClick={onClose} role="dialog" aria-modal="true">
      <ModalContent onClick={e => e.stopPropagation()}>
        <Form onSubmit={handleSubmit}>
          <ModalTitle>{modalTitle}</ModalTitle>
          <Input
            type="text"
            placeholder="Session Notes"
            value={sessionNotes}
            onChange={e => {
              setSessionNotes(e.target.value);
              setError(null);
            }}
            autoFocus
            aria-label="Session Notes"
            aria-invalid={!!error}
            aria-describedby={error ? 'session-notes-error' : undefined}
          />
          <SessionDurationEditBox
            initialSeconds={sessionDuration}
            onChange={seconds => {
              setSessionDuration(seconds);
              setError(null);
            }}
          />
          {error && (
            <ErrorMessage id="session-notes-error" role="alert">
              {error}
            </ErrorMessage>
          )}
          <ButtonGroup>
            <Button type="button" onPress={onClose} color="primary">
              Cancel
            </Button>
            <Button type="submit" color="primary">
              {modalTitle === 'Add New Session' ? 'Add Session' : 'Save Changes'}
            </Button>
          </ButtonGroup>
        </Form>
      </ModalContent>
    </Modal>
  );
};

const RecentSessions: React.FC<{
  sessions: Session[];
}> = ({ sessions }) => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const { updateSessionNotes, updateSessionDuration } = useSessions();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const handleEditClick = (sessionId: number) => {
    setSelectedSession(sessions.find(s => s.id === sessionId) || null);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (sessionId: number) => {
    console.log('delete', sessionId);
  };

  const handleEditSubmit = (notes: string, duration: number) => {
    console.log('edit', notes, duration);
    if (selectedSession) {
      updateSessionNotes(selectedSession.id, notes);
      updateSessionDuration(selectedSession.id, duration);
    }
  };

  return (
    <SessionList>
      <SessionListHeader>Recent Sessions</SessionListHeader>
      {sessions.map((session: Session) => (
        <SessionItem key={session.id}>
          <SessionInfo>
            <SessionNotes>{session.notes || 'No notes'}</SessionNotes>
            <SessionDuration>{formatDuration(session.duration)}</SessionDuration>
            <Button
              className="bg-transparent"
              isIconOnly
              aria-label="Edit Session"
              onPress={() => handleEditClick(session.id)}
              title="Edit Session"
            >
              ✏️
            </Button>
            <Button
              className="bg-transparent"
              isIconOnly
              onPress={() => handleDeleteClick(session.id)}
              title="Delete Session"
              aria-label="Delete Session"
            >
              🗑️
            </Button>
          </SessionInfo>
        </SessionItem>
      ))}
      {sessions.length === 0 && (
        <SessionItem>
          <SessionInfo>
            <SessionNotes>No recent sessions</SessionNotes>
          </SessionInfo>
        </SessionItem>
      )}

      <EditSessionsModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditSubmit}
        modalTitle={'Edit Session'}
        initialNotes={selectedSession?.notes}
        initialDuration={selectedSession?.duration}
      />
    </SessionList>
  );
};

export default RecentSessions;
