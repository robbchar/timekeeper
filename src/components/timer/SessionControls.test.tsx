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
import { Project, Theme } from '@/types/state';
import type { Session } from '@/types/session';
import type { AppContextType } from '@/state/context/AppContext';
// Mock the hooks
vi.mock('@/state/context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

const mockSessionsValue = {
  startSession: vi.fn(),
  stopSession: vi.fn(),
  sessions: [],
  currentSession: null,
};

vi.mock('@/state/hooks/useAppState', () => ({
  useSessions: vi.fn().mockReturnValue({
    startSession: vi.fn(),
    stopSession: vi.fn(),
    sessions: [],
    currentSession: null,
  }),
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
    projectId: 1,
    name: 'Project 1',
    description: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    projectId: 2,
    name: 'Project 2',
    description: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockSessions: Session[] = [
  {
    sessionId: 1,
    projectId: 1,
    startTime: new Date(),
    duration: 0,
    status: 'active',
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

const renderWithTheme = (
  projects: Project[] = mockProjects,
  sessions: Session[] = mockSessions,
  projectSelected: (projectId: number) => void = vi.fn(),
  selectedProjectId: number = -1,
  isProjectsLoading: boolean = false,
  isSessionsLoading: boolean = false,
  sessionCompleted: () => void = vi.fn(),
  sessionEdited: () => void = vi.fn()
) => {
  return render(
    <ThemeProvider theme={theme}>
      <DatabaseProvider>
        <ProjectsProvider>
          <SessionControls
            projects={projects}
            sessions={sessions}
            projectSelected={projectSelected}
            selectedProjectId={selectedProjectId}
            isProjectsLoading={isProjectsLoading}
            isSessionsLoading={isSessionsLoading}
            sessionCompleted={sessionCompleted}
            sessionEdited={sessionEdited}
          />
        </ProjectsProvider>
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
    renderWithTheme();
    expect(screen.getByLabelText('Select a project')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add notes...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Session' })).toBeInTheDocument();
  });

  it('disables start button when no project is selected', () => {
    renderWithTheme();
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
      renderWithTheme(undefined, undefined, undefined, 1);
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
      sessionId: 1,
      projectId: 1,
      startTime: new Date(),
      duration: 0,
      status: 'active',
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

    renderWithTheme();

    expect(screen.getByText('Start Timing')).toBeInTheDocument();
    expect(screen.getByText('Stop Session')).toBeInTheDocument();
  });

  it('stops session and clears timer when stop session is clicked', async () => {
    const mockCurrentSession = {
      sessionId: 1,
      projectId: 1,
      startTime: new Date(),
      duration: 0,
      status: 'active',
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
      renderWithTheme();
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

  it('handles window unload with active session', async () => {
    const mockCurrentSession = {
      sessionId: 1,
      projectId: 1,
      startTime: new Date(),
      duration: 0,
      status: 'active',
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
      renderWithTheme();
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
