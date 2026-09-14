import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useSessions } from '@/state/hooks/useAppState';
import type { Tag } from '@/types/tag';
import type { Project } from '@/types/project';
import type { Session } from '@/types/session';
import TimerControls from './TimerControls';
import ActiveSessionNotes from './ActiveSessionNotes';
import { Select, SelectItem, Button, Textarea } from '@heroui/react';
import RecentSessions from './RecentSessions';
import { now } from '@/utils/time';
import { useEventCallback } from '@/state/hooks/useEventCallback';

/**
 * How often a running session's elapsed time is written to the database. This
 * bounds how much tracked time an abnormal exit can lose.
 */
const CHECKPOINT_INTERVAL_MS = 30_000;

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
  const {
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    updateSessionDuration,
    updateSessionNotes,
    state,
  } = useSessions();
  const currentSession = state.sessions.currentSession;
  const [notes, setNotes] = useState<string>('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTiming, setIsTiming] = useState(false);
  const timerIdRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(0);

  /** Elapsed seconds including the run currently in progress, if any. */
  const readElapsedSeconds = useCallback(() => {
    const currentRun = startTimeRef.current === null ? 0 : now() - startTimeRef.current;
    return accumulatedTimeRef.current + Math.floor(currentRun / 1000);
  }, []);

  // Closing leaves the session open; save the time counted since the last checkpoint.
  const saveElapsedBeforeClose = useEventCallback(async () => {
    const session = state.sessions.currentSession;
    if (!session) return;

    await updateSessionDuration(session.sessionId, readElapsedSeconds());
  });

  useEffect(() => window.appWindow.onBeforeClose(saveElapsedBeforeClose), [saveElapsedBeforeClose]);

  // Persist elapsed time periodically so a crash loses at most one interval.
  const checkpointDuration = useEventCallback(() => {
    const session = state.sessions.currentSession;
    if (!session) return;

    updateSessionDuration(session.sessionId, readElapsedSeconds()).catch(error => {
      console.error('Failed to checkpoint session duration:', error);
    });
  });

  useEffect(() => {
    if (!isTiming) return;

    const checkpointId = setInterval(checkpointDuration, CHECKPOINT_INTERVAL_MS);
    return () => clearInterval(checkpointId);
  }, [isTiming, checkpointDuration]);

  const adoptedSessionIdRef = useRef<number | null>(null);

  // Keeps currentSession.status in step with the timer: 'active' only while counting.
  const markSessionRunning = useEventCallback(() => resumeSession());
  const markSessionPaused = useEventCallback(() => pauseSession());

  const handleStartSession = async () => {
    if (!selectedProjectId) return;
    await startSession({ projectId: selectedProjectId, notes });
    setElapsedTime(0);
    accumulatedTimeRef.current = 0;
  };

  const handleStopSession = async (totalDuration: number = 0) => {
    if (!state.sessions.currentSession) return;

    if (isTiming) {
      handleStopTimer();
    }

    await stopSession(totalDuration);
    setNotes('');
    setElapsedTime(0);
    accumulatedTimeRef.current = 0;
    sessionCompleted();
  };

  const handleStartTimer = useCallback(() => {
    startTimeRef.current = now();
    setIsTiming(true);
    markSessionRunning();

    timerIdRef.current = setInterval(() => {
      setElapsedTime(readElapsedSeconds());
    }, 1000);
  }, [readElapsedSeconds, markSessionRunning]);

  const handleStopTimer = useCallback(() => {
    if (timerIdRef.current) {
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    if (startTimeRef.current !== null) {
      accumulatedTimeRef.current = readElapsedSeconds();
      startTimeRef.current = null;
    }
    setIsTiming(false);
    markSessionPaused();
  }, [readElapsedSeconds, markSessionPaused]);

  // Seed the clock of a session adopted through RESTORE_SESSION from its last
  // checkpoint. Only one adopted running (a continued session) starts counting;
  // one left unfinished by a previous run arrives paused.
  useEffect(() => {
    const session = state.sessions.currentSession;
    const { restoredSessionId } = state.sessions;

    if (!session || restoredSessionId !== session.sessionId) return;
    if (adoptedSessionIdRef.current === session.sessionId) return;

    adoptedSessionIdRef.current = session.sessionId;
    accumulatedTimeRef.current = session.duration ?? 0;
    setElapsedTime(session.duration ?? 0);

    if (session.status === 'active') {
      handleStartTimer();
    }
  }, [state.sessions, handleStartTimer]);

  const handleNotesSaved = (updatedNotes: string) => {
    if (!currentSession) return;

    updateSessionNotes(currentSession.sessionId, updatedNotes).catch(error => {
      console.error('Failed to save session notes:', error);
    });
  };

  // Only reachable while paused, so there is no run in progress to fold in.
  const handleElapsedTimeEdited = (seconds: number) => {
    if (!currentSession) return;

    accumulatedTimeRef.current = seconds;
    setElapsedTime(seconds);
    updateSessionDuration(currentSession.sessionId, seconds).catch(error => {
      console.error('Failed to save edited session duration:', error);
    });
  };

  const isSessionActive = !!currentSession;

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
          {currentSession && (
            <ActiveSessionNotes
              key={currentSession.sessionId}
              initialNotes={currentSession.notes ?? ''}
              onSave={handleNotesSaved}
            />
          )}
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
              onElapsedTimeEdited={handleElapsedTimeEdited}
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
