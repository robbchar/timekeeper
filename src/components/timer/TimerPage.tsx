import styled from 'styled-components';
import SessionControls from '../SessionControls';
import { useAppContext } from '@/state/context/AppContext';
import type { Session } from '@/types/session';

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
`;

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

const SessionProject = styled.span`
  font-weight: 500;
  color: ${({ theme }) => theme.colors.text.primary};
`;

const SessionNotes = styled.span`
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: 0.875rem;
`;

const SessionDuration = styled.span`
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: 0.875rem;
`;

const TimerPage = () => {
  const { state } = useAppContext();
  const { sessions } = state;

  return (
    <PageContainer>
      <SessionControls />
      <SessionList>
        <SessionListHeader>Recent Sessions</SessionListHeader>
        {sessions.sessions.map((session: Session) => (
          <SessionItem key={session.id}>
            <SessionInfo>
              <SessionProject>
                {state.projects.find(p => p.id === session.projectId)?.name || 'Unknown Project'}
              </SessionProject>
              {session.notes && <SessionNotes>{session.notes}</SessionNotes>}
            </SessionInfo>
            <SessionDuration>{new Date(session.duration).toLocaleTimeString()}</SessionDuration>
          </SessionItem>
        ))}
      </SessionList>
    </PageContainer>
  );
};

export default TimerPage;
