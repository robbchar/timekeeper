import React, { useState } from 'react';
import styled, { css } from 'styled-components';
import { Button } from '@heroui/react';
import { formatClockTime } from '@/utils/time';
import { ElapsedTimeEditor } from './ElapsedTimeEditor';

interface TimerControlsProps {
  isSessionActive: boolean;
  isTimingActive: boolean;
  elapsedTime: number;
  onStartTimer: () => void;
  onStopTimer: () => void;
  onStopSession: (totalDuration?: number) => void;
  onElapsedTimeEdited: (seconds: number) => void;
}

const ControlsContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin: 2rem 0;
`;

const clockStyles = css`
  font-size: 2.5rem;
  font-weight: 300;
  font-family: 'Roboto Mono', monospace;
  color: ${({ theme }) => theme.colors.text.primary};
  margin-top: 1rem;
`;

const TimerDisplay = styled.div`
  ${clockStyles}
`;

const EditableTimerDisplay = styled.button`
  ${clockStyles}
  background: none;
  border: none;
  border-bottom: 1px dashed transparent;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    border-bottom-color: currentColor;
  }
`;

const TimerControls: React.FC<TimerControlsProps> = ({
  isSessionActive,
  isTimingActive,
  elapsedTime,
  onStartTimer,
  onStopTimer,
  onStopSession,
  onElapsedTimeEdited,
}) => {
  const [isEditingTime, setIsEditingTime] = useState(false);
  const canEditTime = isSessionActive && !isTimingActive;

  const handleTimerClick = () => {
    if (isTimingActive) {
      onStopTimer();
    } else {
      onStartTimer();
    }
  };

  const handleTimeSaved = (seconds: number) => {
    setIsEditingTime(false);
    if (seconds !== elapsedTime) {
      onElapsedTimeEdited(seconds);
    }
  };

  const renderClock = () => {
    const formattedTime = formatClockTime(elapsedTime);

    if (!canEditTime) {
      return <TimerDisplay>{formattedTime}</TimerDisplay>;
    }

    if (isEditingTime) {
      return (
        <ElapsedTimeEditor
          initialSeconds={elapsedTime}
          onSave={handleTimeSaved}
          onCancel={() => setIsEditingTime(false)}
        />
      );
    }

    return (
      <EditableTimerDisplay
        type="button"
        aria-label="Edit elapsed time"
        onClick={() => setIsEditingTime(true)}
      >
        {formattedTime}
      </EditableTimerDisplay>
    );
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
      {renderClock()}
      {isSessionActive && (
        <Button className="bg-red-500" radius="full" onPress={() => onStopSession(elapsedTime)}>
          Stop Session
        </Button>
      )}
    </ControlsContainer>
  );
};

export default TimerControls;
