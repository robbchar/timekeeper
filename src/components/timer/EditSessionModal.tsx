import React, { useState } from 'react';
import { Button, Form, Input, ButtonGroup } from '@heroui/react';
import { SessionDurationEditBox } from './SessionDurationEditBox';
import styled from 'styled-components';

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ModalContent = styled.div`
  background: ${({ theme }) => theme.colors.background.primary};
  padding: 2rem;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 500px;
`;

const ModalTitle = styled.h2`
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
`;

const ErrorMessage = styled.p`
  color: ${({ theme }) => theme.colors.error};
  font-size: 0.875rem;
  margin-top: 0.5rem;
`;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (notes: string, duration: number) => void;
  modalTitle: string;
  initialNotes: string | undefined;
  initialDuration: number | undefined;
}

export const EditSessionsModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  modalTitle,
  initialNotes = '',
  initialDuration = 0,
}) => {
  const [sessionNotes, setSessionNotes] = useState(initialNotes);
  const [currentDuration, setCurrentDuration] = useState(initialDuration);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setSessionNotes(initialNotes);
    setError(null);
  }, [initialNotes, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentDuration < 0) {
      setError('Session duration is required');
      return;
    }

    onSubmit(sessionNotes.trim(), currentDuration);
  };

  if (!isOpen) return null;

  return (
    <Modal onClick={onClose} role="dialog" aria-modal="true">
      <ModalContent onClick={e => e.stopPropagation()}>
        <Form onSubmit={handleSubmit}>
          <ModalTitle>{modalTitle}</ModalTitle>
          <Input
            type="text"
            placeholder="Session Notes"
            value={sessionNotes}
            onChange={e => {
              setSessionNotes(e.target.value);
              setError(null);
            }}
            autoFocus
            aria-label="Session Notes"
            aria-invalid={!!error}
            aria-describedby={error ? 'session-notes-error' : undefined}
          />
          <SessionDurationEditBox
            initialDuration={initialDuration}
            onChange={seconds => {
              setCurrentDuration(seconds);
              setError(null);
            }}
          />
          {error && (
            <ErrorMessage id="session-notes-error" role="alert">
              {error}
            </ErrorMessage>
          )}
          <ButtonGroup>
            <Button type="button" onPress={onClose} color="primary">
              Cancel
            </Button>
            <Button type="submit" color="primary">
              {modalTitle === 'Add New Session' ? 'Add Session' : 'Save Changes'}
            </Button>
          </ButtonGroup>
        </Form>
      </ModalContent>
    </Modal>
  );
};
