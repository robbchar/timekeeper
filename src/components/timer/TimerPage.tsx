import { useState, useEffect } from 'react';
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
  const [seconds, setSeconds] = useState(0);
  const [pausedSeconds, setPausedSeconds] = useState<number | null>(null);

  useEffect(() => {
    let intervalId: number;

    if (isRunning) {
      intervalId = window.setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning]);

  const handleStart = () => {
    if (pausedSeconds !== null) {
      // Resume from pause
      setSeconds(pausedSeconds);
      setPausedSeconds(null);
    } else {
      // Start new session
      setSeconds(0);
    }
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
    setPausedSeconds(seconds);
  };

  return (
    <PageContainer>
      <TimerDisplay elapsedTime={seconds * 1000} />
      <TimerControls isRunning={isRunning} onStart={handleStart} onStop={handleStop} />
    </PageContainer>
  );
};

export default TimerPage;
