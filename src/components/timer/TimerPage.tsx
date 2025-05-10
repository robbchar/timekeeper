import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import TimerDisplay from './TimerDisplay';
import TimerControls from './TimerControls';

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
`;

const TimerPage = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pausedTime, setPausedTime] = useState<number | null>(null);

  const updateTimer = useCallback(() => {
    if (isRunning && startTime) {
      const currentTime = Date.now();
      setElapsedTime(currentTime - startTime);
    }
  }, [isRunning, startTime]);

  useEffect(() => {
    let intervalId: number;

    if (isRunning) {
      intervalId = window.setInterval(updateTimer, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning, updateTimer]);

  const handleStart = () => {
    if (pausedTime) {
      // Resume from pause
      setStartTime(Date.now() - pausedTime);
      setPausedTime(null);
    } else {
      // Start new timer
      setStartTime(Date.now());
      setElapsedTime(0);
    }
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
    setPausedTime(elapsedTime);
  };

  return (
    <PageContainer>
      <TimerDisplay elapsedTime={elapsedTime} />
      <TimerControls
        isRunning={isRunning}
        onStart={handleStart}
        onStop={handleStop}
        onResume={handleStart}
      />
    </PageContainer>
  );
};

export default TimerPage;
