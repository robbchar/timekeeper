import styled from 'styled-components';
import { format } from 'date-fns';

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
  const date = new Date(milliseconds);
  return format(date, 'HH:mm:ss');
};

const TimerDisplay = ({ elapsedTime }: TimerDisplayProps) => {
  return <DisplayContainer>{formatTime(elapsedTime)}</DisplayContainer>;
};

export default TimerDisplay;
