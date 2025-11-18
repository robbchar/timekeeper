import React from 'react';
import styled from 'styled-components';
import { Button } from '@heroui/react';

interface TimerControlsProps {
  isSessionActive: boolean;
  isTimingActive: boolean;
  elapsedTime: number;
  onStartTimer: () => void;
  onStopTimer: () => void;
  onStopSession: (totalDuration?: number) => void;
}

const ControlsContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin: 2rem 0;
`;

const TimerDisplay = styled.div`
  font-size: 2.5rem;
  font-weight: 300;
  font-family: 'Roboto Mono', monospace;
  color: ${({ theme }) => theme.colors.text.primary};
  margin-top: 1rem;
`;

const formatTime = (totalSeconds: number): string => {
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

  const buttonColor = isTimingActive
    ? 'bg-red-500 hover:bg-red-600'
    : 'bg-green-500 hover:bg-green-600';

  return (
    <ControlsContainer>
      <Button
        radius="full"
        className={`w-[280px] h-[280px] ${buttonColor} text-white border-0`}
        onPress={handleTimerClick}
        isDisabled={!isSessionActive}
      >
        {isTimingActive ? 'Stop Timing' : 'Start Timing'}
      </Button>
      <TimerDisplay>{formatTime(elapsedTime)}</TimerDisplay>
      {isSessionActive && (
        <Button className="bg-red-500" radius="full" onPress={() => onStopSession(elapsedTime)}>
          Stop Session
        </Button>
      )}
    </ControlsContainer>
  );
};

export default TimerControls;
