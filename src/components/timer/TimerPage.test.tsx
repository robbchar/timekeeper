import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TimerPage from './TimerPage';
import { ActionType } from '@/types/state';
import { AppProvider } from '@/state/context/AppContext';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { useAppContext } from '@/state/context/AppContext';

const mockProject = {
  id: 'project-1',
  name: 'Test Project',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Base wrapper that provides context and theme
const BaseWrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  </AppProvider>
);

// Wrapper that also adds a project
const ProjectWrapper = ({ children }: { children: React.ReactNode }) => {
  const { dispatch } = useAppContext();

  // Add the project when the component mounts
  React.useEffect(() => {
    dispatch({ type: ActionType.ADD_PROJECT, payload: mockProject });
  }, [dispatch]);

  return <>{children}</>;
};

describe('TimerPage', () => {
  it('renders session controls and list', () => {
    render(<TimerPage />, { wrapper: BaseWrapper });

    // Check for session controls
    expect(screen.getByRole('combobox')).toBeInTheDocument(); // Project select
    expect(screen.getByPlaceholderText('Add notes...')).toBeInTheDocument(); // Notes textarea
    expect(screen.getByText('Start Session')).toBeInTheDocument();
    expect(screen.getByText('Stop Session')).toBeInTheDocument();

    // Check for session list
    expect(screen.getByText('Recent Sessions')).toBeInTheDocument();
  });

  it('disables start button when no project is selected', () => {
    render(<TimerPage />, { wrapper: BaseWrapper });
    const startButton = screen.getByText('Start Session');
    expect(startButton).toBeDisabled();
  });

  it('enables start button when project is selected', async () => {
    render(
      <ProjectWrapper>
        <TimerPage />
      </ProjectWrapper>,
      { wrapper: BaseWrapper }
    );

    // Wait for the project to be added
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    // Select the project
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'project-1' } });

    // Wait for the button to be enabled
    const startButton = screen.getByText('Start Session');
    expect(startButton).not.toBeDisabled();
  });

  it('disables stop button when no session is active', () => {
    render(<TimerPage />, { wrapper: BaseWrapper });
    const stopButton = screen.getByText('Stop Session');
    expect(stopButton).toBeDisabled();
  });
});
