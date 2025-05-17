import React from 'react';
import styled from 'styled-components';
import { formatDuration } from '@/utils/time';
import type { Session } from '@/types/session';

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
  flex-direction: column;
  gap: 0.25rem;
`;

const SessionNotes = styled.span`
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: 0.875rem;
`;

const SessionDuration = styled.span`
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: 0.875rem;
`;

const RecentSessions: React.FC<{
  sessions: Session[];
}> = ({ sessions }) => {
  return (
    <SessionList>
      <SessionListHeader>Recent Sessions</SessionListHeader>
      {sessions.map((session: Session) => (
        <SessionItem key={session.id}>
          <SessionInfo>
            <SessionNotes>{session.notes || 'No notes'}</SessionNotes>
          </SessionInfo>
          <SessionDuration>{formatDuration(session.duration)}</SessionDuration>
        </SessionItem>
      ))}
      {sessions.length === 0 && (
        <SessionItem>
          <SessionInfo>
            <SessionNotes>No recent sessions</SessionNotes>
          </SessionInfo>
        </SessionItem>
      )}
    </SessionList>
  );
};

export default RecentSessions;
