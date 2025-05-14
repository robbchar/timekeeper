import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SessionControls from './SessionControls';
import { useAppContext } from '@/state/context/AppContext';
import { useSessions } from '@/state/hooks/useAppState';
import { useProjects } from '@/contexts/ProjectsContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { ProjectsProvider } from '@/contexts/ProjectsContext';
import { Theme } from '@/types/state';
import type { AppContextType } from '@/state/context/AppContext';

// Mock the hooks
vi.mock('@/state/context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('@/state/hooks/useAppState', () => ({
  useSessions: vi.fn(),
}));

vi.mock('@/contexts/ProjectsContext', () => ({
  useProjects: vi.fn(),
  ProjectsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/DatabaseContext', () => ({
  useDatabase: vi.fn(),
  DatabaseProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockProjects = [
  {
    id: 1,
    name: 'Project 1',
    description: '',
    totalTime: 0,
    sessionCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
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

const mockProjectsValue = {
  projects: mockProjects,
  isLoading: false,
  error: null,
  refreshProjects: vi.fn(),
};

const mockDatabaseValue = {
  getSessionsForProject: vi.fn().mockResolvedValue([]),
  createSession: vi.fn(),
  endSession: vi.fn(),
};

const renderWithTheme = (component: React.ReactNode) => {
  return render(
    <ThemeProvider theme={theme}>
      <DatabaseProvider>
        <ProjectsProvider>{component}</ProjectsProvider>
      </DatabaseProvider>
    </ThemeProvider>
  );
};

describe('SessionControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (useAppContext as ReturnType<typeof vi.fn>).mockReturnValue(mockContextValue);
    (useSessions as ReturnType<typeof vi.fn>).mockReturnValue(mockSessionsValue);
    (useProjects as ReturnType<typeof vi.fn>).mockReturnValue(mockProjectsValue);
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue(mockDatabaseValue);
  });

  afterEach(() => {
    vi.useRealTimers();
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
    const mockGetSessions = vi.fn().mockResolvedValue([]);
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockDatabaseValue,
      getSessionsForProject: mockGetSessions,
    });

    await act(async () => {
      renderWithTheme(<SessionControls />);
    });

    // Select a project
    const select = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.change(select, { target: { value: '1' } });
    });

    // Add notes
    const notesInput = screen.getByPlaceholderText('Add notes...');
    fireEvent.change(notesInput, { target: { value: 'Test session' } });

    // Click start button
    const startButton = screen.getByRole('button', { name: 'Start Session' });
    await act(async () => {
      fireEvent.click(startButton);
    });

    expect(mockSessionsValue.startSession).toHaveBeenCalledWith({
      projectId: 1,
      notes: 'Test session',
    });
  });

  it('shows timer controls when session is active', async () => {
    const mockCurrentSession = {
      id: 1,
      projectId: 1,
      startTime: new Date(),
      duration: 0,
      status: 'active',
      totalPausedTime: 0,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
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

    expect(screen.getByText('Start Timing')).toBeInTheDocument();
    expect(screen.getByText('Stop Session')).toBeInTheDocument();
  });

  it('updates elapsed time when timer is running', async () => {
    const mockCurrentSession = {
      id: 1,
      projectId: 1,
      startTime: new Date(),
      duration: 0,
      status: 'active',
      totalPausedTime: 0,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
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

    // Start the timer
    const startButton = screen.getByText('Start Timing');
    fireEvent.click(startButton);

    // Advance time by 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('00:00:01')).toBeInTheDocument();

    // Advance time by another 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('00:00:03')).toBeInTheDocument();
  });

  it('stops timer when stop timing is clicked', async () => {
    const mockCurrentSession = {
      id: 1,
      projectId: 1,
      startTime: new Date(),
      duration: 0,
      status: 'active',
      totalPausedTime: 0,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
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

    // Start the timer
    const startButton = screen.getByText('Start Timing');
    fireEvent.click(startButton);

    // Advance time by 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('00:00:01')).toBeInTheDocument();

    // Stop the timer
    const stopButton = screen.getByText('Stop Timing');
    fireEvent.click(stopButton);

    // Advance time by another second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Time should still be 1 second
    expect(screen.getByText('00:00:01')).toBeInTheDocument();
  });

  it('shows recent sessions when no session is active', async () => {
    const mockSessions = [
      {
        id: 1,
        projectId: 1,
        startTime: new Date(),
        endTime: new Date(),
        duration: 3600, // 1 hour in seconds
        notes: 'Test session 1',
        status: 'completed',
        totalPausedTime: 0,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockGetSessions = vi.fn().mockResolvedValue(mockSessions);

    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockDatabaseValue,
      getSessionsForProject: mockGetSessions,
    });

    await act(async () => {
      renderWithTheme(<SessionControls />);
    });

    const select = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.change(select, { target: { value: '1' } });
    });

    expect(mockGetSessions).toHaveBeenCalledWith(1);

    expect(screen.getByText('Recent Sessions')).toBeInTheDocument();
    expect(screen.getByText('Test session 1')).toBeInTheDocument();
    expect(screen.getByText('1h 0m')).toBeInTheDocument();
  });

  it('stops session and clears timer when stop session is clicked', async () => {
    const mockCurrentSession = {
      id: 1,
      projectId: 1,
      startTime: new Date(),
      duration: 0,
      status: 'active',
      totalPausedTime: 0,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockStopSession = vi.fn().mockResolvedValue(undefined);
    (useSessions as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockSessionsValue,
      stopSession: mockStopSession,
    });

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

    await act(async () => {
      renderWithTheme(<SessionControls />);
    });

    // Start the timer
    const startButton = screen.getByText('Start Timing');
    await act(async () => {
      fireEvent.click(startButton);
    });

    // Advance time by 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('00:00:01')).toBeInTheDocument();

    // Stop the session
    const stopSessionButton = screen.getByText('Stop Session');
    await act(async () => {
      fireEvent.click(stopSessionButton);
    });

    expect(mockStopSession).toHaveBeenCalled();
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
  });

  it('disables project selection and notes when session is active', () => {
    const mockCurrentSession = {
      id: 1,
      projectId: 1,
      startTime: new Date(),
      duration: 0,
      status: 'active',
      totalPausedTime: 0,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
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

    const select = screen.getByRole('combobox');
    const notesInput = screen.getByPlaceholderText('Add notes...');

    expect(select).toBeDisabled();
    expect(notesInput).toBeDisabled();
  });

  it('handles window unload with active session', async () => {
    const mockCurrentSession = {
      id: 1,
      projectId: 1,
      startTime: new Date(),
      duration: 0,
      status: 'active',
      totalPausedTime: 0,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockStopSession = vi.fn().mockResolvedValue(undefined);
    (useSessions as ReturnType<typeof vi.fn>).mockReturnValue({
      ...mockSessionsValue,
      stopSession: mockStopSession,
    });

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

    await act(async () => {
      renderWithTheme(<SessionControls />);
    });

    // Start the timer
    const startButton = screen.getByText('Start Timing');
    await act(async () => {
      fireEvent.click(startButton);
    });

    // Simulate window unload
    const beforeUnloadEvent = new Event('beforeunload') as BeforeUnloadEvent;
    beforeUnloadEvent.preventDefault = vi.fn();
    beforeUnloadEvent.returnValue = '';

    await act(async () => {
      window.dispatchEvent(beforeUnloadEvent);
    });

    // Verify session was stopped
    expect(mockStopSession).toHaveBeenCalled();
  });
});
