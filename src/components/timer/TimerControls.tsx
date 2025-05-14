import React from 'react';
import styled from 'styled-components';

interface TimerControlsProps {
  isSessionActive: boolean;
  isTimingActive: boolean;
  elapsedTime: number;
  onStartTimer: () => void;
  onStopTimer: () => void;
  onStopSession: () => void;
}

const ControlsContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin: 2rem 0;
`;

const CircularButton = styled.button<{ isTimingActive: boolean }>`
  width: 280px;
  height: 280px;
  border-radius: 50%;
  border: none;
  background-color: ${({ isTimingActive, theme }) =>
    isTimingActive ? theme.colors.error : theme.colors.success};
  color: white;
  font-size: 1.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    background-color: ${({ isTimingActive, theme }) =>
      isTimingActive ? theme.colors.errorHover : theme.colors.successHover};
  }

  &:active {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const TimerDisplay = styled.div`
  font-size: 2.5rem;
  font-weight: 300;
  font-family: 'Roboto Mono', monospace;
  color: ${({ theme }) => theme.colors.text.primary};
  margin-top: 1rem;
`;

const StopSessionButton = styled.button`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  background-color: ${({ theme }) => theme.colors.error};
  color: white;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${({ theme }) => theme.colors.errorHover};
  }
`;

const formatTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map(num => num.toString().padStart(2, '0')).join(':');
};

const TimerControls: React.FC<TimerControlsProps> = ({
  isSessionActive,
  isTimingActive,
  elapsedTime,
  onStartTimer,
  onStopTimer,
  onStopSession,
}) => {
  const handleTimerClick = () => {
    if (isTimingActive) {
      onStopTimer();
    } else {
      onStartTimer();
    }
  };

  return (
    <ControlsContainer>
      <CircularButton
        isTimingActive={isTimingActive}
        onClick={handleTimerClick}
        disabled={!isSessionActive}
      >
        {isTimingActive ? 'Stop Timing' : 'Start Timing'}
      </CircularButton>
      <TimerDisplay>{formatTime(elapsedTime)}</TimerDisplay>
      {isSessionActive && (
        <StopSessionButton onClick={onStopSession}>Stop Session</StopSessionButton>
      )}
    </ControlsContainer>
  );
};

export default TimerControls;
