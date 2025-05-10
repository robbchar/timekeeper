import styled from 'styled-components';

interface TimerControlsProps {
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  onResume: () => void;
}

const ControlsContainer = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin: 1rem 0;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: ${({ variant }) => (variant === 'primary' ? '#007bff' : '#6c757d')};
  color: white;

  &:hover {
    background-color: ${({ variant }) => (variant === 'primary' ? '#0056b3' : '#5a6268')};
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const TimerControls = ({ isRunning, onStart, onStop, onResume }: TimerControlsProps) => {
  return (
    <ControlsContainer>
      {!isRunning ? (
        <>
          <Button variant="primary" onClick={onStart}>
            Start
          </Button>
          <Button onClick={onResume} disabled={true}>
            Resume
          </Button>
        </>
      ) : (
        <Button onClick={onStop}>Stop</Button>
      )}
    </ControlsContainer>
  );
};

export default TimerControls;
