import React, { useState } from 'react';
import styled from 'styled-components';
import { useAppContext } from '@/state/context/AppContext';
import { ActionType } from '@/types/state';
import type { Project } from '@/types/state';
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
  transition: all 0.2s ease;
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
  const { createSession, endSession } = useDatabase();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartSession = async () => {
    if (!selectedProjectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const startTime = new Date().toISOString();
      await createSession(Number(selectedProjectId), startTime, notes);

      dispatch({
        type: ActionType.CREATE_SESSION,
        payload: {
          projectId: selectedProjectId,
          notes,
        },
      });

      // Clear form
      setNotes('');
    } catch (err) {
      setError('Failed to start session. Please try again.');
      console.error('Error starting session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopSession = async () => {
    if (!state.sessions.currentSession) return;

    setIsLoading(true);
    setError(null);

    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(state.sessions.currentSession.startTime);
      const duration = Math.floor((new Date(endTime).getTime() - startTime.getTime()) / 1000);

      await endSession(Number(state.sessions.currentSession.id), endTime, duration);
      dispatch({ type: ActionType.END_SESSION });
    } catch (err) {
      setError('Failed to stop session. Please try again.');
      console.error('Error stopping session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <Controls>
        <Select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
          <option value="">Select a project</option>
          {state.projects.map((project: Project) => (
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
          <Button
            variant="start"
            onClick={handleStartSession}
            disabled={!selectedProjectId || !!state.sessions.currentSession || isLoading}
          >
            {isLoading ? 'Starting...' : 'Start Session'}
          </Button>
          <Button
            variant="stop"
            onClick={handleStopSession}
            disabled={!state.sessions.currentSession || isLoading}
          >
            {isLoading ? 'Stopping...' : 'Stop Session'}
          </Button>
        </ButtonContainer>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {isLoading && <LoadingMessage>Processing...</LoadingMessage>}
      </Controls>
    </Container>
  );
};

export default SessionControls;
