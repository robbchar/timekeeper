import React, { useState, useContext } from 'react';
import styled from 'styled-components';
import { AppContext } from '@/state/context/AppContext';
import { ActionType } from '@/types/state';
import type { Project } from '@/types/state';

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

const SessionControls: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  if (!state || !dispatch) {
    throw new Error('SessionControls must be used within an AppProvider');
  }

  const handleStartSession = () => {
    if (selectedProjectId) {
      dispatch({
        type: ActionType.CREATE_SESSION,
        payload: { projectId: selectedProjectId, notes },
      });
    }
  };

  const handleStopSession = () => {
    if (state.sessions.currentSession) {
      dispatch({ type: ActionType.END_SESSION });
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
        />
        <ButtonContainer>
          <Button
            variant="start"
            onClick={handleStartSession}
            disabled={!selectedProjectId || !!state.sessions.currentSession}
          >
            Start Session
          </Button>
          <Button
            variant="stop"
            onClick={handleStopSession}
            disabled={!state.sessions.currentSession}
          >
            Stop Session
          </Button>
        </ButtonContainer>
      </Controls>
    </Container>
  );
};

export default SessionControls;
