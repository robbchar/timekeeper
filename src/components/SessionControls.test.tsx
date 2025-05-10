import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SessionControls from './SessionControls';
import { useAppContext } from '@/state/context/AppContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { ActionType, Theme } from '@/types/state';
import type { AppContextType } from '@/state/context/AppContext';

// Mock the hooks
vi.mock('@/state/context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('@/contexts/DatabaseContext', () => ({
  useDatabase: vi.fn(),
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

const mockDatabaseValue = {
  createProject: vi.fn(),
  getProject: vi.fn(),
  getAllProjects: vi.fn(),
  createSession: vi.fn(),
  endSession: vi.fn(),
  getSessionsForProject: vi.fn(),
  createTag: vi.fn(),
  getAllTags: vi.fn(),
  getSetting: vi.fn(),
  setSetting: vi.fn(),
};

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('SessionControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAppContext as ReturnType<typeof vi.fn>).mockReturnValue(mockContextValue);
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue(mockDatabaseValue);
  });

  it('renders project selection and controls', () => {
    renderWithTheme(<SessionControls />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add notes...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Session' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop Session' })).toBeInTheDocument();
  });

  it('disables start button when no project is selected', () => {
    renderWithTheme(<SessionControls />);

    const startButton = screen.getByRole('button', { name: 'Start Session' });
    expect(startButton).toBeDisabled();
  });

  it('creates a new session when start button is clicked', async () => {
    const mockSessionId = 123;
    mockDatabaseValue.createSession.mockResolvedValue(mockSessionId);

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
      expect(mockDatabaseValue.createSession).toHaveBeenCalledWith(
        1,
        expect.any(String),
        'Test session'
      );
      expect(mockContextValue.dispatch).toHaveBeenCalledWith({
        type: ActionType.CREATE_SESSION,
        payload: {
          projectId: '1',
          notes: 'Test session',
        },
      });
    });

    // Check that notes are cleared
    expect(notesInput).toHaveValue('');
  });

  it('shows error message when session creation fails', async () => {
    mockDatabaseValue.createSession.mockRejectedValue(new Error('Failed to create session'));

    renderWithTheme(<SessionControls />);

    // Select a project
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });

    // Click start button
    const startButton = screen.getByRole('button', { name: 'Start Session' });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to start session. Please try again.')).toBeInTheDocument();
    });
  });

  it('ends current session when stop button is clicked', async () => {
    const mockCurrentSession = {
      id: '123',
      projectId: '1',
      startTime: new Date().toISOString(),
      duration: 0,
      status: 'active',
      totalPausedTime: 0,
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
      expect(mockDatabaseValue.endSession).toHaveBeenCalledWith(
        123,
        expect.any(String),
        expect.any(Number)
      );
      expect(mockContextValue.dispatch).toHaveBeenCalledWith({
        type: ActionType.END_SESSION,
      });
    });
  });

  it('shows error message when session ending fails', async () => {
    const mockCurrentSession = {
      id: '123',
      projectId: '1',
      startTime: new Date().toISOString(),
      duration: 0,
      status: 'active',
      totalPausedTime: 0,
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

    mockDatabaseValue.endSession.mockRejectedValue(new Error('Failed to end session'));

    renderWithTheme(<SessionControls />);

    const stopButton = screen.getByRole('button', { name: 'Stop Session' });
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to stop session. Please try again.')).toBeInTheDocument();
    });
  });

  it('disables controls during loading state', async () => {
    const mockCurrentSession = {
      id: '123',
      projectId: '1',
      startTime: new Date().toISOString(),
      duration: 0,
      status: 'active',
      totalPausedTime: 0,
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
