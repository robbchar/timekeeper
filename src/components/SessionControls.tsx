import React, { useState } from 'react';
import styled from 'styled-components';
import { useAppContext } from '@/state/context/AppContext';
import { useSessions } from '@/state/hooks/useAppState';
import { useProjects } from '@/contexts/ProjectsContext';
import { ActionType } from '@/types/state';
import type { Project } from '@/types/project';

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

const LoadingMessage = styled.div`
  color: ${({ theme }) => theme.colors.text.secondary};
  margin-top: 0.5rem;
  font-size: 0.875rem;
`;

const SessionControls: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { startSession, stopSession } = useSessions();
  const { projects, isLoading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<number>();
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleStartSession = async () => {
    if (!selectedProjectId) return;

    setIsLoading(true);
    try {
      await startSession({ projectId: selectedProjectId, notes });
      setNotes('');
    } catch {
      dispatch({
        type: ActionType.SET_ERROR,
        payload: 'Failed to start session. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopSession = async () => {
    if (!state.sessions.currentSession) return;

    setIsLoading(true);
    try {
      await stopSession();
    } catch {
      dispatch({
        type: ActionType.SET_ERROR,
        payload: 'Failed to stop session. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <Controls>
        <Select
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(Number(e.target.value))}
          disabled={!!state.sessions.currentSession || isLoading || projectsLoading}
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
          disabled={isLoading}
        />
        <ButtonContainer>
          {!state.sessions.currentSession && (
            <Button
              variant="start"
              onClick={handleStartSession}
              disabled={!selectedProjectId || isLoading || projectsLoading}
            >
              {isLoading ? 'Starting...' : 'Start Session'}
            </Button>
          )}
          {state.sessions.currentSession && (
            <Button variant="stop" onClick={handleStopSession} disabled={isLoading}>
              {isLoading ? 'Stopping...' : 'Stop Session'}
            </Button>
          )}
        </ButtonContainer>
        {state.ui.error && <ErrorMessage>{state.ui.error}</ErrorMessage>}
        {(isLoading || projectsLoading) && <LoadingMessage>Processing...</LoadingMessage>}
      </Controls>
    </Container>
  );
};

export default SessionControls;
