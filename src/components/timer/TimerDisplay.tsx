import styled from 'styled-components';

interface TimerDisplayProps {
  elapsedTime: number; // in milliseconds
}

const DisplayContainer = styled.div`
  font-size: 4rem;
  font-weight: 300;
  font-family: 'Roboto Mono', monospace;
  text-align: center;
  color: #333;
  margin: 2rem 0;
`;

const formatTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map(num => num.toString().padStart(2, '0')).join(':');
};

const TimerDisplay = ({ elapsedTime }: TimerDisplayProps) => {
  return <DisplayContainer>{formatTime(elapsedTime)}</DisplayContainer>;
};

export default TimerDisplay;
