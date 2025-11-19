import React, { useState } from 'react';
import styled from 'styled-components';
import { formatDate, formatDuration } from '@/utils/time';
import type { Session } from '@/types/session';
import { Button } from '@heroui/react';
import { useSessions } from '@/state/hooks/useAppState';
import { EditSessionsModal } from './EditSessionModal';
import { ConfirmModal } from '@/components/ConfirmModal';

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

const SessionStartDate = styled.span`
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: 0.875rem;
  margin-right: 1rem;
`;

const RecentSessions: React.FC<{
  sessions: Session[];
  sessionEdited: () => void;
}> = ({ sessions, sessionEdited }) => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const { updateSessionNotes, updateSessionDuration, deleteSession } = useSessions();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const handleEditClick = (sessionId: number) => {
    setSelectedSession(sessions.find(s => s.sessionId === sessionId) || null);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (sessionId: number) => {
    setSessionToDelete(sessions.find(s => s.sessionId === sessionId) || null);
    setIsDeleteModalOpen(true);
  };

  const handleEditSubmit = (notes: string, duration: number) => {
    if (selectedSession) {
      updateSessionNotes(selectedSession.sessionId, notes);
      updateSessionDuration(selectedSession.sessionId, duration);
      sessionEdited();
      setIsEditModalOpen(false);
      setSelectedSession(null);
    }
  };

  return (
    <SessionList>
      <SessionListHeader>Recent Sessions</SessionListHeader>
      {sessions.map((session: Session) => (
        <SessionItem key={session.sessionId}>
          <SessionInfo>
            <SessionStartDate>{formatDate(session.startTime.toString())}</SessionStartDate>
            <SessionNotes>{session.notes || 'No notes'}</SessionNotes>
            <SessionDuration>{formatDuration(session.duration)}</SessionDuration>
            <Button
              className="bg-transparent"
              isIconOnly
              aria-label="Edit Session"
              onPress={() => handleEditClick(session.sessionId)}
              title="Edit Session"
            >
              ✏️
            </Button>
            <Button
              className="bg-transparent"
              isIconOnly
              onPress={() => handleDeleteClick(session.sessionId)}
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
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={async () => {
          if (sessionToDelete) {
            await deleteSession(sessionToDelete.sessionId);
            sessionEdited();
          }
          setIsDeleteModalOpen(false);
          setSessionToDelete(null);
        }}
        title="Delete Session"
        message="Are you sure you want to delete this session? This action cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete"
      />
    </SessionList>
  );
};

export default RecentSessions;
