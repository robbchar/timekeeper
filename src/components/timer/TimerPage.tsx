import styled from 'styled-components';
import SessionControls from '../SessionControls';
import { useAppContext } from '@/state/context/AppContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import type { Session, SessionStatus } from '@/types/session';
import { useEffect, useState, useCallback } from 'react';

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
  const { getSessionsForProject } = useDatabase();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Use currentProject from UI state
  const currentProjectId = state.ui.currentProject;
  // console.log('TimerPage: currentProjectId:', currentProjectId);

  const fetchSessions = useCallback(async () => {
    if (!currentProjectId) {
      console.log('TimerPage: No currentProjectId, skipping fetch');
      return;
    }
    // console.log('TimerPage: Fetching sessions for project:', currentProjectId);
    setIsLoading(true);
    setError(null);
    try {
      const dbSessions = (await getSessionsForProject(
        Number(currentProjectId)
      )) as unknown as Array<{
        id: number;
        projectId?: number;
        project_id?: number;
        startTime?: string;
        start_time?: string;
        endTime?: string | null;
        end_time?: string | null;
        duration?: number;
        notes?: string;
        status?: string;
        totalPausedTime?: number;
        total_paused_time?: number;
        createdAt?: string;
        created_at?: string;
        updatedAt?: string;
        updated_at?: string;
      }>;
      console.log('currentProjectId:', currentProjectId);
      console.log('TimerPage: Received sessions from database:', dbSessions);
      const mappedSessions: Session[] = dbSessions.map(s => ({
        id: s.id,
        projectId: s.project_id ?? Number(currentProjectId),
        startTime: new Date(s.startTime ?? s.start_time ?? new Date().toISOString()),
        endTime: (s.endTime ?? s.end_time) ? new Date(String(s.endTime ?? s.end_time)) : undefined,
        duration: typeof s.duration === 'number' ? s.duration : 0,
        notes: s.notes ?? '',
        status: (s.status ?? 'completed') as SessionStatus,
        totalPausedTime: s.totalPausedTime ?? s.total_paused_time ?? 0,
        createdAt: new Date(s.createdAt ?? s.created_at ?? new Date().toISOString()),
        updatedAt: new Date(s.updatedAt ?? s.updated_at ?? new Date().toISOString()),
      }));
      // console.log('TimerPage: Mapped sessions:', mappedSessions);
      setSessions(mappedSessions);
    } catch (error) {
      console.error('TimerPage: Error fetching sessions:', error);
      setError('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, [currentProjectId, getSessionsForProject]);

  // Helper to format duration in seconds to HH:MM:SS
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
      .toString()
      .padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);
  // console.log('state.projects', state.projects);
  return (
    <PageContainer>
      {/* TODO: Add onSessionChange to SessionControls when supported */}
      <SessionControls />
      <SessionList>
        <SessionListHeader>Recent Sessions</SessionListHeader>
        {isLoading && <div>Loading...</div>}
        {error && <div style={{ color: 'red' }}>{error}</div>}
        {!isLoading &&
          !error &&
          sessions.map((session: Session) => (
            <SessionItem key={session.id}>
              <SessionInfo>
                <SessionProject>
                  {state.projects.find(p => p.id === session.projectId)?.name || 'Unknown Project'}
                </SessionProject>
                {session.notes && <SessionNotes>{session.notes}</SessionNotes>}
              </SessionInfo>
              <SessionDuration>{formatDuration(session.duration)}</SessionDuration>
            </SessionItem>
          ))}
      </SessionList>
    </PageContainer>
  );
};

export default TimerPage;
