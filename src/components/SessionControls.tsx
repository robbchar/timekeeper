import React, { useCallback, useEffect, useState, useRef } from 'react';
import styled from 'styled-components';
import { useAppContext } from '@/state/context/AppContext';
import { useSessions } from '@/state/hooks/useAppState';
import { useProjects } from '@/contexts/ProjectsContext';
import { ActionType } from '@/types/state';
import type { Project } from '@/types/project';
import type { Session, SessionStatus } from '@/types/session';
import { formatDuration } from '@/utils/time';
import TimerControls from './timer/TimerControls';
import { useDatabase } from '@/contexts/DatabaseContext';

const Container = styled.div`
  padding: 1.5rem;
  background-color: ${({ theme }) => theme.colors.background.secondary};
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const Controls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Select = styled.select`
  padding: 0.75rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background-color: ${({ theme }) => theme.colors.background.primary};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: 1rem;
  width: 100%;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const TextArea = styled.textarea`
  padding: 0.75rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 4px;
  background-color: ${({ theme }) => theme.colors.background.primary};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: 1rem;
  width: 100%;
  min-height: 100px;
  resize: vertical;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
`;

const Button = styled.button<{ variant: 'start' | 'stop' }>`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  flex: 1;
  background-color: ${({ theme, variant }) =>
    variant === 'start' ? theme.colors.success : theme.colors.error};
  color: white;

  &:hover:not(:disabled) {
    background-color: ${({ theme, variant }) =>
      variant === 'start' ? theme.colors.successHover : theme.colors.errorHover};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.error};
  margin-top: 0.5rem;
  font-size: 0.875rem;
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

const SessionNotes = styled.span`
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: 0.875rem;
`;

const SessionDuration = styled.span`
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: 0.875rem;
`;

const SessionControls: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { startSession, stopSession } = useSessions();
  const { projects, isLoading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<number>();
  const [notes, setNotes] = useState<string>('');
  const [isTiming, setIsTiming] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { getSessionsForProject } = useDatabase();
  const timerRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);

  const fetchSessions = useCallback(async () => {
    if (!selectedProjectId) {
      console.log('SessionControls No currentProjectId, skipping fetch');
      return;
    }
    console.log('SessionControls Fetching sessions for project:', selectedProjectId);
    setIsSessionsLoading(true);
    setError(null);
    try {
      const dbSessions = (await getSessionsForProject(
        Number(selectedProjectId)
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
      console.log('SessionControls Received sessions from database:', dbSessions);
      const mappedSessions: Session[] = dbSessions.map(s => ({
        id: s.id,
        projectId: Number(s.project_id ?? selectedProjectId),
        startTime: new Date(s.startTime ?? s.start_time ?? new Date().toISOString()),
        endTime: (s.endTime ?? s.end_time) ? new Date(String(s.endTime ?? s.end_time)) : undefined,
        duration: typeof s.duration === 'number' ? s.duration : 0,
        notes: s.notes ?? '',
        status: (s.status ?? 'completed') as SessionStatus,
        totalPausedTime: s.totalPausedTime ?? s.total_paused_time ?? 0,
        createdAt: new Date(s.createdAt ?? s.created_at ?? new Date().toISOString()),
        updatedAt: new Date(s.updatedAt ?? s.updated_at ?? new Date().toISOString()),
        tags: [], // Initialize with empty array since we don't have tag data yet
      }));
      console.log('SessionControls Mapped sessions:', mappedSessions);
      setSessions(mappedSessions);
    } catch {
      console.log('SessionControls Error fetching sessions:', error);
      setError('Failed to load sessions');
    } finally {
      console.log('SessionControls Finished fetching sessions');
      setIsSessionsLoading(false);
    }
  }, [selectedProjectId, getSessionsForProject]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  // Handle window unload
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (state.sessions.currentSession) {
        // Stop the timer if it's running
        if (isTiming) {
          handleStopTimer();
        }

        // Try to stop the session
        try {
          await stopSession();
        } catch (error) {
          console.error('Failed to stop session on window unload:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state.sessions.currentSession, isTiming, stopSession]);

  const handleStartSession = async () => {
    if (!selectedProjectId) return;

    setIsSessionsLoading(true);
    try {
      await startSession({ projectId: selectedProjectId, notes });
      setElapsedTime(0);
    } catch {
      dispatch({
        type: ActionType.SET_ERROR,
        payload: 'Failed to start session. Please try again.',
      });
    } finally {
      setIsSessionsLoading(false);
    }
  };

  const handleStopSession = async () => {
    if (!state.sessions.currentSession) return;

    setIsSessionsLoading(true);
    try {
      if (isTiming) {
        handleStopTimer();
      }
      await stopSession();
      setNotes('');
      setElapsedTime(0);
      fetchSessions();
    } catch {
      dispatch({
        type: ActionType.SET_ERROR,
        payload: 'Failed to stop session. Please try again.',
      });
    } finally {
      setIsSessionsLoading(false);
    }
  };

  const handleStartTimer = () => {
    setIsTiming(true);
    startTimeRef.current = Date.now() - elapsedTime;
    timerRef.current = window.setInterval(() => {
      if (startTimeRef.current) {
        setElapsedTime(Date.now() - startTimeRef.current);
      }
    }, 1000);
  };

  const handleStopTimer = () => {
    setIsTiming(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }
  };

  const isSessionActive = !!state.sessions.currentSession;

  return (
    <Container>
      <Controls>
        <Select
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(Number(e.target.value))}
          disabled={isSessionActive || projectsLoading}
        >
          <option value="">Select a project</option>
          {!projectsLoading &&
            projects.map((project: Project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
        </Select>
        <TextArea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add notes..."
          disabled={isSessionActive || !selectedProjectId}
        />
        {!isSessionActive && (
          <ButtonContainer>
            <Button
              variant="start"
              onClick={handleStartSession}
              disabled={projectsLoading || !selectedProjectId}
            >
              Start Session
            </Button>
          </ButtonContainer>
        )}
        {isSessionActive && (
          <TimerControls
            isSessionActive={isSessionActive}
            isTimingActive={isTiming}
            elapsedTime={elapsedTime}
            onStartTimer={handleStartTimer}
            onStopTimer={handleStopTimer}
            onStopSession={handleStopSession}
          />
        )}
        {!isSessionActive && !isTiming && !!selectedProjectId && (
          <SessionList>
            <SessionListHeader>Recent Sessions</SessionListHeader>
            {isSessionsLoading && <div>Sessions Loading...</div>}
            {error && <div style={{ color: 'red' }}>{error}</div>}
            {!isSessionsLoading &&
              !error &&
              sessions.map((session: Session) => (
                <SessionItem key={session.id}>
                  <SessionInfo>
                    <SessionNotes>{session.notes || 'No notes'}</SessionNotes>
                  </SessionInfo>
                  <SessionDuration>{formatDuration(session.duration)}</SessionDuration>
                </SessionItem>
              ))}
          </SessionList>
        )}
        {state.ui.error && <ErrorMessage>{state.ui.error}</ErrorMessage>}
      </Controls>
    </Container>
  );
};

export default SessionControls;
