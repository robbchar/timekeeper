import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SessionControls from './SessionControls';
import { AppState, Project } from '@/types/state';
import type { Session } from '@/types/session';
import { TestProviders } from '@/test-utils/test-db-context';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { setupTestDatabase, teardownTestDatabase } from '@/test-utils/db-test-setup';
import { seedProjects } from '@/test-utils/db-test-data-setup';
import { AppContext } from '@/contexts/AppContext';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import * as useAppState from '@/state/hooks/useAppState';
import { initialState } from '@/state/initialState';

vi.mock('@/state/hooks/useAppState');

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

type RenderWithThemeOptions = {
  projects?: Project[];
  sessions?: Session[];
  projectSelected?: (projectId: number) => void;
  selectedProjectId?: number;
  isProjectsLoading?: boolean;
  isSessionsLoading?: boolean;
  sessionCompleted?: () => void;
  sessionEdited?: () => void;
};

const renderWithTheme = (
  props: Partial<RenderWithThemeOptions> = {},
  wrapper: React.ComponentType<{ children: React.ReactNode }> = TestProviders
) => {
  const {
    projects = mockProjects,
    sessions = mockSessions,
    projectSelected = vi.fn(),
    selectedProjectId = -1,
    isProjectsLoading = false,
    isSessionsLoading = false,
    sessionCompleted = vi.fn(),
    sessionEdited = vi.fn(),
  } = props;

  return render(
    <SessionControls
      projects={projects}
      sessions={sessions}
      projectSelected={projectSelected}
      selectedProjectId={selectedProjectId}
      isProjectsLoading={isProjectsLoading}
      isSessionsLoading={isSessionsLoading}
      sessionCompleted={sessionCompleted}
      sessionEdited={sessionEdited}
    />,
    { wrapper }
  );
};

let user: UserEvent;
describe('SessionControls', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    user = userEvent.setup();
    const db = await setupTestDatabase();
    await seedProjects(db, [
      {
        projectId: 1,
        name: 'Project 1',
        description: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    vi.mocked(useAppState.useSessions).mockReturnValue({
      startSession: vi.fn().mockResolvedValue(undefined),
      stopSession: vi.fn().mockResolvedValue(undefined),
      state: {
        ...initialState,
        sessions: {
          ...initialState.sessions,
          currentSession: mockSessions[0],
        },
      },
      sessions: [],
      currentSession: null,
      getSessions: vi.fn().mockResolvedValue(undefined),
      pauseSession: vi.fn().mockResolvedValue(undefined),
      resumeSession: vi.fn().mockResolvedValue(undefined),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      updateSessionNotes: vi.fn().mockResolvedValue(undefined),
      updateSessionDuration: vi.fn().mockResolvedValue(undefined),
      setSessions: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  it('renders no selected project initially', () => {
    renderWithTheme();
    expect(screen.getByLabelText('Select a project')).toBeInTheDocument();
  });

  it('renders start button when a project is selected', () => {
    // No active session by default -> show Start Session button
    vi.mocked(useAppState.useSessions).mockReturnValue({
      startSession: vi.fn().mockResolvedValue(undefined),
      stopSession: vi.fn().mockResolvedValue(undefined),
      state: initialState,
      sessions: [],
      currentSession: null,
      getSessions: vi.fn().mockResolvedValue(undefined),
      pauseSession: vi.fn().mockResolvedValue(undefined),
      resumeSession: vi.fn().mockResolvedValue(undefined),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      updateSessionNotes: vi.fn().mockResolvedValue(undefined),
      updateSessionDuration: vi.fn().mockResolvedValue(undefined),
      setSessions: vi.fn().mockResolvedValue(undefined),
    });

    renderWithTheme({ selectedProjectId: 1 });
    expect(screen.getByRole('button', { name: 'Start Session' })).toBeInTheDocument();
  });
  // projects: Project[] = mockProjects,
  // sessions: Session[] = mockSessions,
  // projectSelected: (projectId: number) => void = vi.fn(),
  // selectedProjectId: number = -1,
  // isProjectsLoading: boolean = false,
  // isSessionsLoading: boolean = false,
  // sessionCompleted: () => void = vi.fn(),
  // sessionEdited: () => void = vi.fn()

  it('creates a new session when start button is clicked', async () => {
    // Ensure there is no active session so that the notes input and Start Session button render
    const startSession = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useAppState.useSessions).mockReturnValue({
      startSession,
      stopSession: vi.fn().mockResolvedValue(undefined),
      state: initialState,
      sessions: [],
      currentSession: null,
      getSessions: vi.fn().mockResolvedValue(undefined),
      pauseSession: vi.fn().mockResolvedValue(undefined),
      resumeSession: vi.fn().mockResolvedValue(undefined),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      updateSessionNotes: vi.fn().mockResolvedValue(undefined),
      updateSessionDuration: vi.fn().mockResolvedValue(undefined),
      setSessions: vi.fn().mockResolvedValue(undefined),
    });

    renderWithTheme({ selectedProjectId: 1 });

    // Add notes
    const notesInput = screen.getByPlaceholderText('Add notes for session...');
    expect(notesInput).toBeInTheDocument();
    await user.type(notesInput, 'Test session');

    // Click start button
    const startButton = screen.getByRole('button', { name: 'Start Session' });
    expect(startButton).toBeInTheDocument();
    await user.click(startButton);

    expect(startSession).toHaveBeenCalledWith({ projectId: 1, notes: 'Test session' });
  });

  it('shows timer controls when session is active', async () => {
    const mockState: Partial<AppState> = {
      sessions: {
        currentSession: {
          sessionId: 1,
          projectId: 1,
          startTime: new Date(),
          duration: 0,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        sessions: [],
        isLoading: false,
        error: null,
      },
    };

    const MockAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      return (
        <DatabaseProvider>
          <AppContext.Provider
            value={{
              state: mockState as AppState,
              dispatch: vi.fn(),
              getState: () => mockState as AppState,
              createProject: vi.fn(),
              updateProject: vi.fn(),
              deleteProject: vi.fn(),
            }}
          >
            <ThemeProvider theme={theme}>{children}</ThemeProvider>
          </AppContext.Provider>
        </DatabaseProvider>
      );
    };

    renderWithTheme({ selectedProjectId: 1 }, MockAppProvider);

    expect(screen.getByText('Start Timing')).toBeInTheDocument();
    expect(screen.getByText('Stop Session')).toBeInTheDocument();
  });

  it('shows updated time after 3s', async () => {
    // Active session so that timer controls render
    vi.mocked(useAppState.useSessions).mockReturnValue({
      startSession: vi.fn().mockResolvedValue(undefined),
      stopSession: vi.fn().mockResolvedValue(undefined),
      state: {
        ...initialState,
        sessions: {
          ...initialState.sessions,
          currentSession: mockSessions[0],
        },
      },
      sessions: [],
      currentSession: mockSessions[0],
      getSessions: vi.fn().mockResolvedValue(undefined),
      pauseSession: vi.fn().mockResolvedValue(undefined),
      resumeSession: vi.fn().mockResolvedValue(undefined),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      updateSessionNotes: vi.fn().mockResolvedValue(undefined),
      updateSessionDuration: vi.fn().mockResolvedValue(undefined),
      setSessions: vi.fn().mockResolvedValue(undefined),
    });

    renderWithTheme({ selectedProjectId: 1 });

    await user.click(screen.getByText('Start Timing'));

    // Let the timer tick for 3 seconds in real time
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 3100));
    });

    expect(screen.getByText('00:00:03')).toBeInTheDocument();
  });

  it('handles window unload by registering a beforeunload listener', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    await act(async () => {
      renderWithTheme();
    });

    expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    addEventListenerSpy.mockRestore();
  });
});
