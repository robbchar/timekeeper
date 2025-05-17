import React, { useEffect, useState, useRef } from 'react';
import styled from 'styled-components';
import { useAppContext } from '@/state/context/AppContext';
import { useSessions } from '@/state/hooks/useAppState';
import { ActionType } from '@/types/state';
import type { Project } from '@/types/project';
import type { Session } from '@/types/session';
import TimerControls from './TimerControls';
import { Textarea, Select, SelectItem, Button } from '@heroui/react';
import RecentSessions from './RecentSessions';

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

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
`;

const SessionControls: React.FC<{
  projects: Project[];
  sessions: Session[];
  projectSelected: (projectId: number) => void;
  selectedProjectId: number;
  isProjectsLoading: boolean;
  isSessionsLoading: boolean;
  sessionCompleted: () => void;
}> = ({
  projects,
  sessions,
  projectSelected,
  selectedProjectId,
  isProjectsLoading,
  isSessionsLoading,
  sessionCompleted,
}) => {
  const { state, dispatch } = useAppContext();
  const { startSession, stopSession } = useSessions();
  const [notes, setNotes] = useState<string>('');
  const [isTiming, setIsTiming] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  // const [sessions, setSessions] = useState<Session[]>([]);
  const timerRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);

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

    try {
      await startSession({ projectId: selectedProjectId, notes });
      setElapsedTime(0);
    } catch {
      dispatch({
        type: ActionType.SET_ERROR,
        payload: 'Failed to start session. Please try again.',
      });
    }
  };

  const handleStopSession = async (totalDuration: number = 0) => {
    if (!state.sessions.currentSession) return;

    try {
      if (isTiming) {
        handleStopTimer();
      }

      await stopSession(totalDuration);
      setNotes('');
      setElapsedTime(0);
      sessionCompleted();
    } catch {
      dispatch({
        type: ActionType.SET_ERROR,
        payload: 'Failed to stop session. Please try again.',
      });
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
      {!isProjectsLoading && (
        <Controls>
          <Select
            className="max-w-full bg-white"
            value={selectedProjectId}
            onChange={e => projectSelected(Number(e.target.value))}
            isDisabled={isSessionActive}
            placeholder="Select a project"
            aria-label="Select a project"
            selectedKeys={[projects.find(p => p.id === selectedProjectId)?.id?.toString() ?? '']}
            popoverProps={{
              classNames: {
                base: 'before:bg-default-200',
                content: 'p-0 border-small border-divider',
              },
            }}
          >
            {projects.map((project: Project) => (
              <SelectItem key={project.id}>{project.name}</SelectItem>
            ))}
          </Select>
          {isSessionActive && notes !== '' && <input type="text" value={notes} disabled />}
          {!isSessionsLoading && !isSessionActive && (
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="max-w-full bg-white"
              placeholder="Add notes..."
            />
          )}
          {!isSessionsLoading && !isSessionActive && (
            <ButtonContainer>
              <Button
                onPress={handleStartSession}
                isDisabled={selectedProjectId < 0}
                color="primary"
              >
                Start Session
              </Button>
            </ButtonContainer>
          )}
          {!isSessionsLoading && isSessionActive && (
            <TimerControls
              isSessionActive={isSessionActive}
              isTimingActive={isTiming}
              elapsedTime={elapsedTime}
              onStartTimer={handleStartTimer}
              onStopTimer={handleStopTimer}
              onStopSession={handleStopSession}
            />
          )}
          {!isSessionsLoading && !isSessionActive && !isTiming && selectedProjectId > 0 && (
            <RecentSessions sessions={sessions} />
          )}
        </Controls>
      )}
    </Container>
  );
};

export default SessionControls;
