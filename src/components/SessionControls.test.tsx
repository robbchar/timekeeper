import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SessionControls from './SessionControls';
import { useAppContext } from '@/state/context/AppContext';
import { useSessions } from '@/state/hooks/useAppState';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { ActionType, Theme } from '@/types/state';
import type { AppContextType } from '@/state/context/AppContext';

// Mock the hooks
vi.mock('@/state/context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('@/state/hooks/useAppState', () => ({
  useSessions: vi.fn(),
}));

const mockProjects = [
  {
    id: '1',
    name: 'Project 1',
    description: '',
    totalTime: 0,
    sessionCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    name: 'Project 2',
    description: '',
    totalTime: 0,
    sessionCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockContextValue: AppContextType = {
  state: {
    projects: mockProjects,
    sessions: {
      currentSession: null,
      sessions: [],
      isLoading: false,
      error: null,
    },
    tags: [],
    settings: {
      timeFormat: '24h',
      defaultProject: undefined,
    },
    ui: {
      theme: Theme.LIGHT,
      error: undefined,
      currentProject: undefined,
      isTimerRunning: false,
      isLoading: false,
    },
  },
  dispatch: vi.fn(),
};

const mockSessionsValue = {
  startSession: vi.fn(),
  stopSession: vi.fn(),
  sessions: [],
  currentSession: null,
};

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('SessionControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAppContext as ReturnType<typeof vi.fn>).mockReturnValue(mockContextValue);
    (useSessions as ReturnType<typeof vi.fn>).mockReturnValue(mockSessionsValue);
  });

  it('renders project selection and controls', () => {
    renderWithTheme(<SessionControls />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add notes...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Session' })).toBeInTheDocument();
  });

  it('disables start button when no project is selected', () => {
    renderWithTheme(<SessionControls />);

    const startButton = screen.getByRole('button', { name: 'Start Session' });
    expect(startButton).toBeDisabled();
  });

  it('creates a new session when start button is clicked', async () => {
    renderWithTheme(<SessionControls />);

    // Select a project
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });

    // Add notes
    const notesInput = screen.getByPlaceholderText('Add notes...');
    fireEvent.change(notesInput, { target: { value: 'Test session' } });

    // Click start button
    const startButton = screen.getByRole('button', { name: 'Start Session' });
    fireEvent.click(startButton);

    // Check loading state
    expect(screen.getByText('Starting...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockSessionsValue.startSession).toHaveBeenCalledWith({
        projectId: '1',
        notes: 'Test session',
      });
    });

    // Check that notes are cleared
    expect(notesInput).toHaveValue('');
  });

  it('shows error message when session creation fails', async () => {
    const error = new Error('Failed to create session');
    mockSessionsValue.startSession.mockRejectedValue(error);

    renderWithTheme(<SessionControls />);

    // Select a project
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });

    // Click start button
    const startButton = screen.getByRole('button', { name: 'Start Session' });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockContextValue.dispatch).toHaveBeenCalledWith({
        type: ActionType.SET_ERROR,
        payload: 'Failed to start session. Please try again.',
      });
    });

    // Update context with error state
    (useAppContext as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockContextValue,
      state: {
        ...mockContextValue.state,
        ui: {
          ...mockContextValue.state.ui,
          error: 'Failed to start session. Please try again.',
        },
      },
    });

    // Re-render to show error
    renderWithTheme(<SessionControls />);

    expect(screen.getByText('Failed to start session. Please try again.')).toBeInTheDocument();
  });

  it('ends current session when stop button is clicked', async () => {
    const mockCurrentSession = {
      id: '123',
      projectId: '1',
      startTime: new Date().toISOString(),
      duration: 0,
      status: 'active',
    };

    (useAppContext as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockContextValue,
      state: {
        ...mockContextValue.state,
        sessions: {
          ...mockContextValue.state.sessions,
          currentSession: mockCurrentSession,
        },
      },
    });

    renderWithTheme(<SessionControls />);

    const stopButton = screen.getByRole('button', { name: 'Stop Session' });
    fireEvent.click(stopButton);

    // Check loading state
    expect(screen.getByText('Stopping...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockSessionsValue.stopSession).toHaveBeenCalled();
    });
  });

  it('shows error message when session ending fails', async () => {
    const mockCurrentSession = {
      id: '123',
      projectId: '1',
      startTime: new Date().toISOString(),
      duration: 0,
      status: 'active',
    };

    (useAppContext as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockContextValue,
      state: {
        ...mockContextValue.state,
        sessions: {
          ...mockContextValue.state.sessions,
          currentSession: mockCurrentSession,
        },
      },
    });

    const error = new Error('Failed to end session');
    mockSessionsValue.stopSession.mockRejectedValue(error);

    renderWithTheme(<SessionControls />);

    const stopButton = screen.getByRole('button', { name: 'Stop Session' });
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(mockContextValue.dispatch).toHaveBeenCalledWith({
        type: ActionType.SET_ERROR,
        payload: 'Failed to stop session. Please try again.',
      });
    });

    // Update context with error state
    (useAppContext as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockContextValue,
      state: {
        ...mockContextValue.state,
        sessions: {
          ...mockContextValue.state.sessions,
          currentSession: mockCurrentSession,
        },
        ui: {
          ...mockContextValue.state.ui,
          error: 'Failed to stop session. Please try again.',
        },
      },
    });

    // Re-render to show error
    renderWithTheme(<SessionControls />);

    expect(screen.getByText('Failed to stop session. Please try again.')).toBeInTheDocument();
  });

  it('disables controls during loading state', async () => {
    const mockCurrentSession = {
      id: '123',
      projectId: '1',
      startTime: new Date().toISOString(),
      duration: 0,
      status: 'active',
    };

    (useAppContext as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockContextValue,
      state: {
        ...mockContextValue.state,
        sessions: {
          ...mockContextValue.state.sessions,
          currentSession: mockCurrentSession,
        },
      },
    });

    renderWithTheme(<SessionControls />);

    const stopButton = screen.getByRole('button', { name: 'Stop Session' });
    const notesInput = screen.getByPlaceholderText('Add notes...');

    fireEvent.click(stopButton);

    expect(stopButton).toBeDisabled();
    expect(notesInput).toBeDisabled();
    expect(screen.getByText('Stopping...')).toBeInTheDocument();
  });
});
