import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useSessions } from '@/state/hooks/useAppState';
import type { Tag } from '@/types/tag';
import type { Project } from '@/types/project';
import type { Session } from '@/types/session';
import TimerControls from './TimerControls';
import { Select, SelectItem, Button, Textarea } from '@heroui/react';
import RecentSessions from './RecentSessions';
import { now } from '@/utils/time';

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
  sessionEdited: () => void;
  projectTags: Tag[];
}> = ({
  projects,
  sessions,
  projectSelected,
  selectedProjectId,
  isProjectsLoading,
  isSessionsLoading,
  sessionCompleted,
  sessionEdited,
  projectTags,
}) => {
  const { startSession, stopSession, state } = useSessions();
  const [notes, setNotes] = useState<string>('');
  const [, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTiming, setIsTiming] = useState(false);
  const timerIdRef = useRef<NodeJS.Timeout | null>(null);

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
  }, []);

  const handleStartSession = async () => {
    if (!selectedProjectId) return;
    await startSession({ projectId: selectedProjectId, notes });
    setElapsedTime(0);
  };

  const handleStopSession = async (totalDuration: number = 0) => {
    if (!state.sessions.currentSession) return;

    if (isTiming) {
      handleStopTimer();
    }

    await stopSession(totalDuration);
    setNotes('');
    setElapsedTime(0);
    sessionCompleted();
  };

  const handleStartTimer = () => {
    console.log('handleStartTimer');
    const nowTime = now();
    setStartTime(nowTime);
    setIsTiming(true);

    timerIdRef.current = setInterval(() => {
      setElapsedTime(prev => {
        const newVal = prev + 1;
        console.log('⏱️ elapsed tick', newVal);
        return newVal;
      });
    }, 1000);
  };

  const handleStopTimer = useCallback(() => {
    console.log('handleStopTimer');
    if (timerIdRef.current) {
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    setIsTiming(false);
  }, []);

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
            selectedKeys={[
              projects.find(p => p.projectId === selectedProjectId)?.projectId?.toString() ?? '',
            ]}
            popoverProps={{
              classNames: {
                base: 'before:bg-default-200',
                content: 'p-0 border-small border-divider',
              },
            }}
          >
            {projects.map((project: Project) => (
              <SelectItem key={project.projectId}>{project.name}</SelectItem>
            ))}
          </Select>
          {projectTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {projectTags.map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center rounded-full bg-gray-700 px-2 py-0.5 text-xs text-white"
                  style={tag.color ? { backgroundColor: tag.color, color: '#ffffff' } : undefined}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          {isSessionActive && notes !== '' && <input type="text" value={notes} disabled />}
          {!isSessionsLoading && !isSessionActive && selectedProjectId > 0 && (
            <>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="max-w-full bg-white"
                placeholder="Add notes for session..."
              />
              <ButtonContainer>
                <Button
                  onPress={handleStartSession}
                  isDisabled={selectedProjectId < 0}
                  color="primary"
                >
                  Start Session
                </Button>
              </ButtonContainer>
            </>
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
          {!isSessionsLoading &&
            !isSessionActive &&
            !timerIdRef.current &&
            selectedProjectId > 0 && (
              <RecentSessions sessions={sessions} sessionEdited={sessionEdited} />
            )}
        </Controls>
      )}
    </Container>
  );
};

export default SessionControls;
