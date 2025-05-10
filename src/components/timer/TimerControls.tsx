import styled from 'styled-components';

interface TimerControlsProps {
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
}

const ControlsContainer = styled.div`
  display: flex;
  justify-content: center;
  margin: 2rem 0;
`;

const CircularButton = styled.button<{ isRunning: boolean }>`
  width: 280px;
  height: 280px;
  border-radius: 50%;
  border: none;
  background-color: ${({ isRunning }) => (isRunning ? '#dc3545' : '#28a745')};
  color: white;
  font-size: 1.2rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const TimerControls = ({ isRunning, onStart, onStop }: TimerControlsProps) => {
  const handleClick = () => {
    if (isRunning) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <ControlsContainer>
      <CircularButton isRunning={isRunning} onClick={handleClick}>
        {isRunning ? 'Pause' : 'Start'}
      </CircularButton>
    </ControlsContainer>
  );
};

export default TimerControls;
