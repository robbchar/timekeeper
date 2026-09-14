import React from 'react';
import { render, screen, act } from '@testing-library/react';
import SessionControls from './SessionControls';
import { AppState, Project } from '@/types/state';
import type { Tag } from '@/types/tag';
import type { Session } from '@/types/session';
import { TestProviders } from '@/test-utils/test-db-context';
import userEvent, { UserEvent } from '@testing-library/user-event';
import type { Mock } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from '@/test-utils/db-test-setup';
import { seedProjects } from '@/test-utils/db-test-data-setup';
import { AppContext } from '@/contexts/AppContext';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import * as useAppState from '@/state/hooks/useAppState';
import { initialState } from '@/state/initialState';
import { createTestAppWindow } from '@/test-utils/appWindow';

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
  projectTags?: Tag[];
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
    projectTags = [],
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
      projectTags={projectTags}
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
      restoreSession: vi.fn(),
      continueSession: vi.fn().mockResolvedValue(undefined),
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
      restoreSession: vi.fn(),
      continueSession: vi.fn().mockResolvedValue(undefined),
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
      restoreSession: vi.fn(),
      continueSession: vi.fn().mockResolvedValue(undefined),
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

  it('displays project tags when provided', () => {
    const tags: Tag[] = [
      { id: 1, name: 'Frontend', color: '#007bff', createdAt: new Date(), updatedAt: new Date() },
      { id: 2, name: 'Backend', color: '#22c55e', createdAt: new Date(), updatedAt: new Date() },
    ];

    renderWithTheme({ selectedProjectId: 1, projectTags: tags });

    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('Backend')).toBeInTheDocument();
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
        restoredSessionId: null,
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
      restoreSession: vi.fn(),
      continueSession: vi.fn().mockResolvedValue(undefined),
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

  describe('duration checkpointing', () => {
    // A restored session starts its timer on mount, which avoids driving the
    // timer through userEvent — that deadlocks against fake timers here.
    const timingSession: Session = { ...mockSessions[0], sessionId: 7, duration: 0 };

    const renderTimingSession = (updateSessionDuration: Mock<UpdateSessionDuration>) => {
      vi.mocked(useAppState.useSessions).mockReturnValue({
        ...vi.mocked(useAppState.useSessions)(),
        updateSessionDuration,
        state: {
          ...initialState,
          sessions: {
            ...initialState.sessions,
            currentSession: timingSession,
            restoredSessionId: timingSession.sessionId,
          },
        },
      });

      return renderWithTheme({ selectedProjectId: 1 });
    };

    afterEach(() => {
      vi.useRealTimers();
    });

    it('writes the elapsed duration every 30 seconds while timing', async () => {
      const updateSessionDuration = vi.fn<UpdateSessionDuration>().mockResolvedValue(undefined);

      vi.useFakeTimers();
      await act(async () => {
        renderTimingSession(updateSessionDuration);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      expect(updateSessionDuration).toHaveBeenCalledWith(timingSession.sessionId, 30);
    });

    it('keeps checkpointing on each interval', async () => {
      const updateSessionDuration = vi.fn<UpdateSessionDuration>().mockResolvedValue(undefined);

      vi.useFakeTimers();
      await act(async () => {
        renderTimingSession(updateSessionDuration);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(90_000);
      });

      expect(updateSessionDuration).toHaveBeenCalledTimes(3);
      expect(updateSessionDuration).toHaveBeenLastCalledWith(timingSession.sessionId, 90);
    });

    it('stops checkpointing once unmounted', async () => {
      const updateSessionDuration = vi.fn<UpdateSessionDuration>().mockResolvedValue(undefined);

      vi.useFakeTimers();
      let view!: ReturnType<typeof renderWithTheme>;
      await act(async () => {
        view = renderTimingSession(updateSessionDuration);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      view.unmount();
      const callsAfterLeaving = updateSessionDuration.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      expect(updateSessionDuration).toHaveBeenCalledTimes(callsAfterLeaving);
    });
  });

  describe('adopting a restored session', () => {
    const restoredSession: Session = { ...mockSessions[0], sessionId: 42, duration: 120 };

    const renderAdopted = async (session: Session) => {
      vi.mocked(useAppState.useSessions).mockReturnValue({
        ...vi.mocked(useAppState.useSessions)(),
        state: {
          ...initialState,
          sessions: {
            ...initialState.sessions,
            currentSession: session,
            restoredSessionId: session.sessionId,
          },
        },
      });

      await act(async () => {
        renderWithTheme({ selectedProjectId: 1 });
      });
    };

    it('waits to be started when the session was adopted paused', async () => {
      await renderAdopted({ ...restoredSession, status: 'paused' });

      expect(screen.getByText('Start Timing')).toBeInTheDocument();
    });

    it('shows the saved time of a session adopted paused', async () => {
      await renderAdopted({ ...restoredSession, status: 'paused' });

      expect(screen.getByText('00:02:00')).toBeInTheDocument();
    });

    it('does not auto-resume a session that was not restored', async () => {
      vi.mocked(useAppState.useSessions).mockReturnValue({
        ...vi.mocked(useAppState.useSessions)(),
        state: {
          ...initialState,
          sessions: {
            ...initialState.sessions,
            currentSession: restoredSession,
            restoredSessionId: null,
          },
        },
      });

      await act(async () => {
        renderWithTheme({ selectedProjectId: 1 });
      });

      expect(screen.getByText('Start Timing')).toBeInTheDocument();
    });

    it('picks the clock up from the last checkpoint', async () => {
      vi.mocked(useAppState.useSessions).mockReturnValue({
        ...vi.mocked(useAppState.useSessions)(),
        state: {
          ...initialState,
          sessions: {
            ...initialState.sessions,
            currentSession: restoredSession,
            restoredSessionId: restoredSession.sessionId,
          },
        },
      });

      await act(async () => {
        renderWithTheme({ selectedProjectId: 1 });
      });

      expect(screen.getByText('00:02:00')).toBeInTheDocument();
    });

    it('resumes counting a running session rather than waiting to be started', async () => {
      vi.mocked(useAppState.useSessions).mockReturnValue({
        ...vi.mocked(useAppState.useSessions)(),
        state: {
          ...initialState,
          sessions: {
            ...initialState.sessions,
            currentSession: restoredSession,
            restoredSessionId: restoredSession.sessionId,
          },
        },
      });

      await act(async () => {
        renderWithTheme({ selectedProjectId: 1 });
      });

      expect(screen.getByText('Stop Timing')).toBeInTheDocument();
    });
  });

  describe('editing notes during a session', () => {
    type UpdateSessionNotes = (sessionId: number, notes: string) => Promise<void>;
    const sessionWithNotes: Session = {
      ...mockSessions[0],
      sessionId: 11,
      notes: 'Existing notes',
    };

    const renderSessionWithNotes = async (updateSessionNotes: Mock<UpdateSessionNotes>) => {
      vi.mocked(useAppState.useSessions).mockReturnValue({
        ...vi.mocked(useAppState.useSessions)(),
        updateSessionNotes,
        state: {
          ...initialState,
          sessions: { ...initialState.sessions, currentSession: sessionWithNotes },
        },
      });

      await act(async () => {
        renderWithTheme({ selectedProjectId: 1 });
      });

      return screen.getByLabelText('Session notes');
    };

    it('shows the current session notes in an editable field', async () => {
      const notesField = await renderSessionWithNotes(
        vi.fn<UpdateSessionNotes>().mockResolvedValue(undefined)
      );

      expect(notesField).toHaveValue('Existing notes');
      expect(notesField).toBeEnabled();
    });

    it('saves edited notes when the field loses focus', async () => {
      const updateSessionNotes = vi.fn<UpdateSessionNotes>().mockResolvedValue(undefined);
      const notesField = await renderSessionWithNotes(updateSessionNotes);

      await user.clear(notesField);
      await user.type(notesField, 'Refined notes');
      await user.click(document.body);

      expect(updateSessionNotes).toHaveBeenCalledWith(11, 'Refined notes');
    });

    it('saves edited notes on Enter', async () => {
      const updateSessionNotes = vi.fn<UpdateSessionNotes>().mockResolvedValue(undefined);
      const notesField = await renderSessionWithNotes(updateSessionNotes);

      await user.type(notesField, ' today{Enter}');

      expect(updateSessionNotes).toHaveBeenCalledWith(11, 'Existing notes today');
    });

    it('does not save notes that did not change', async () => {
      const updateSessionNotes = vi.fn<UpdateSessionNotes>().mockResolvedValue(undefined);
      const notesField = await renderSessionWithNotes(updateSessionNotes);

      await user.click(notesField);
      await user.click(document.body);

      expect(updateSessionNotes).not.toHaveBeenCalled();
    });
  });

  describe('editing the elapsed time', () => {
    const pausedSession: Session = { ...mockSessions[0], sessionId: 3 };

    const renderPausedSession = async (updateSessionDuration: Mock<UpdateSessionDuration>) => {
      vi.mocked(useAppState.useSessions).mockReturnValue({
        ...vi.mocked(useAppState.useSessions)(),
        updateSessionDuration,
        state: {
          ...initialState,
          sessions: { ...initialState.sessions, currentSession: pausedSession },
        },
      });

      await act(async () => {
        renderWithTheme({ selectedProjectId: 1 });
      });
    };

    const openEditorAndSetMinutes = async (minutes: string) => {
      await user.click(screen.getByRole('button', { name: 'Edit elapsed time' }));
      await user.tripleClick(screen.getByLabelText('Minutes'));
      await user.keyboard(minutes);
    };

    it('writes the typed time to the session', async () => {
      const updateSessionDuration = vi.fn<UpdateSessionDuration>().mockResolvedValue(undefined);
      await renderPausedSession(updateSessionDuration);

      await openEditorAndSetMinutes('5');
      await user.keyboard('{Enter}');

      expect(updateSessionDuration).toHaveBeenCalledWith(3, 300);
    });

    it('shows the typed time on the clock', async () => {
      await renderPausedSession(vi.fn<UpdateSessionDuration>().mockResolvedValue(undefined));

      await openEditorAndSetMinutes('5');
      await user.keyboard('{Enter}');

      expect(screen.getByText('00:05:00')).toBeInTheDocument();
    });

    it('leaves the time untouched when the edit is cancelled', async () => {
      const updateSessionDuration = vi.fn<UpdateSessionDuration>().mockResolvedValue(undefined);
      await renderPausedSession(updateSessionDuration);

      await openEditorAndSetMinutes('5');
      await user.keyboard('{Escape}');

      expect(updateSessionDuration).not.toHaveBeenCalled();
      expect(screen.getByText('00:00:00')).toBeInTheDocument();
    });

    it('saves an open edit when timing is started', async () => {
      const updateSessionDuration = vi.fn<UpdateSessionDuration>().mockResolvedValue(undefined);
      await renderPausedSession(updateSessionDuration);

      await openEditorAndSetMinutes('5');
      await user.click(screen.getByText('Start Timing'));

      expect(updateSessionDuration).toHaveBeenCalledWith(3, 300);
    });

    it('counts on from the typed time once timing starts', async () => {
      await renderPausedSession(vi.fn<UpdateSessionDuration>().mockResolvedValue(undefined));

      await openEditorAndSetMinutes('5');
      await user.click(screen.getByText('Start Timing'));
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100));
      });

      expect(screen.getByText('00:05:01')).toBeInTheDocument();
    });
  });

  describe('keeping the session status in step with the timer', () => {
    const renderPausedSession = async (overrides: {
      pauseSession?: () => void;
      resumeSession?: () => void;
    }) => {
      vi.mocked(useAppState.useSessions).mockReturnValue({
        ...vi.mocked(useAppState.useSessions)(),
        ...overrides,
        state: {
          ...initialState,
          sessions: {
            ...initialState.sessions,
            currentSession: { ...mockSessions[0], status: 'paused' },
          },
        },
      });

      await act(async () => {
        renderWithTheme({ selectedProjectId: 1 });
      });
    };

    it('marks the session running when timing starts', async () => {
      const resumeSession = vi.fn();
      await renderPausedSession({ resumeSession });

      await user.click(screen.getByText('Start Timing'));

      expect(resumeSession).toHaveBeenCalledTimes(1);
    });

    it('marks the session paused when timing stops', async () => {
      const pauseSession = vi.fn();
      await renderPausedSession({ pauseSession });

      await user.click(screen.getByText('Start Timing'));
      await user.click(screen.getByText('Stop Timing'));

      expect(pauseSession).toHaveBeenCalledTimes(1);
    });
  });

  type StopSession = (totalDuration?: number) => Promise<void>;
  type UpdateSessionDuration = (sessionId: number, duration: number) => Promise<void>;

  describe('leaving the timer page', () => {
    // Restored running, so the timer starts on mount without userEvent under fake timers.
    const timingSession: Session = { ...mockSessions[0], sessionId: 42, duration: 120 };

    afterEach(() => {
      vi.useRealTimers();
    });

    const mockSessionsHook = (
      currentSession: Session | null,
      overrides: {
        pauseSession?: () => void;
        updateSessionDuration?: Mock<UpdateSessionDuration>;
        restoredSessionId?: number;
      } = {}
    ) => {
      const { restoredSessionId = null, ...hookOverrides } = overrides;
      vi.mocked(useAppState.useSessions).mockReturnValue({
        ...vi.mocked(useAppState.useSessions)(),
        ...hookOverrides,
        state: {
          ...initialState,
          sessions: { ...initialState.sessions, currentSession, restoredSessionId },
        },
      });
    };

    const timeFiveSecondsThenLeave = async (overrides: {
      pauseSession?: () => void;
      updateSessionDuration?: Mock<UpdateSessionDuration>;
    }) => {
      mockSessionsHook(timingSession, { ...overrides, restoredSessionId: 42 });

      vi.useFakeTimers();
      let view!: ReturnType<typeof renderWithTheme>;
      await act(async () => {
        view = renderWithTheme({ selectedProjectId: 1 });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
      view.unmount();
    };

    it('saves the time counted so far when leaving mid-timing', async () => {
      const updateSessionDuration = vi.fn<UpdateSessionDuration>().mockResolvedValue(undefined);

      await timeFiveSecondsThenLeave({ updateSessionDuration });

      expect(updateSessionDuration).toHaveBeenCalledWith(42, 125);
    });

    it('marks the session paused when leaving mid-timing', async () => {
      const pauseSession = vi.fn();

      await timeFiveSecondsThenLeave({ pauseSession });

      expect(pauseSession).toHaveBeenCalledTimes(1);
    });

    it('leaves a paused session untouched', async () => {
      const updateSessionDuration = vi.fn<UpdateSessionDuration>().mockResolvedValue(undefined);
      const pauseSession = vi.fn();
      mockSessionsHook(
        { ...timingSession, status: 'paused' },
        { updateSessionDuration, pauseSession }
      );

      let view!: ReturnType<typeof renderWithTheme>;
      await act(async () => {
        view = renderWithTheme({ selectedProjectId: 1 });
      });
      view.unmount();

      expect(updateSessionDuration).not.toHaveBeenCalled();
      expect(pauseSession).not.toHaveBeenCalled();
    });

    it('shows the saved time, paused, on coming back', async () => {
      mockSessionsHook({ ...timingSession, status: 'paused', duration: 125 });

      await act(async () => {
        renderWithTheme({ selectedProjectId: 1 });
      });

      expect(screen.getByText('00:02:05')).toBeInTheDocument();
      expect(screen.getByText('Start Timing')).toBeInTheDocument();
    });

    it('counts on from the saved time once started again', async () => {
      mockSessionsHook({ ...timingSession, status: 'paused', duration: 125 });
      await act(async () => {
        renderWithTheme({ selectedProjectId: 1 });
      });

      await user.click(screen.getByText('Start Timing'));
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100));
      });

      expect(screen.getByText('00:02:06')).toBeInTheDocument();
    });

    it('keeps a continued session timing through a StrictMode remount', async () => {
      mockSessionsHook(timingSession, { restoredSessionId: 42 });
      const StrictProviders = ({ children }: { children: React.ReactNode }) => (
        <React.StrictMode>
          <TestProviders>{children}</TestProviders>
        </React.StrictMode>
      );

      await act(async () => {
        renderWithTheme({ selectedProjectId: 1 }, StrictProviders);
      });

      expect(screen.getByText('Stop Timing')).toBeInTheDocument();
    });

    it('starts a session continued after being stopped on the same visit', async () => {
      const renderControls = () => (
        <SessionControls
          projects={mockProjects}
          sessions={mockSessions}
          projectSelected={vi.fn()}
          selectedProjectId={1}
          isProjectsLoading={false}
          isSessionsLoading={false}
          sessionCompleted={vi.fn()}
          sessionEdited={vi.fn()}
          projectTags={[]}
        />
      );
      mockSessionsHook({ ...timingSession, status: 'paused' });
      let view!: ReturnType<typeof renderWithTheme>;
      await act(async () => {
        view = renderWithTheme({ selectedProjectId: 1 });
      });

      mockSessionsHook(null);
      await act(async () => {
        view.rerender(renderControls());
      });
      mockSessionsHook(timingSession, { restoredSessionId: 42 });
      await act(async () => {
        view.rerender(renderControls());
      });

      expect(screen.getByText('Stop Timing')).toBeInTheDocument();
    });
  });

  describe('saving before the window closes', () => {
    let appWindow: ReturnType<typeof createTestAppWindow>;

    beforeEach(() => {
      appWindow = createTestAppWindow();
      window.appWindow = appWindow.bridge;
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const closeWindow = async () => {
      await act(async () => {
        await appWindow.requestClose();
      });
    };

    const mockSessionsHook = (
      currentSession: Session | null,
      overrides: {
        stopSession?: Mock<StopSession>;
        updateSessionDuration?: Mock<UpdateSessionDuration>;
        restoredSessionId?: number;
      } = {}
    ) => {
      const { restoredSessionId = null, ...hookOverrides } = overrides;
      vi.mocked(useAppState.useSessions).mockReturnValue({
        ...vi.mocked(useAppState.useSessions)(),
        ...hookOverrides,
        state: {
          ...initialState,
          sessions: { ...initialState.sessions, currentSession, restoredSessionId },
        },
      });
    };

    it('saves the time counted so far, including the run in progress', async () => {
      const updateSessionDuration = vi.fn<UpdateSessionDuration>().mockResolvedValue(undefined);
      const timingSession: Session = { ...mockSessions[0], sessionId: 42, duration: 120 };
      mockSessionsHook(timingSession, { updateSessionDuration, restoredSessionId: 42 });

      vi.useFakeTimers();
      await act(async () => {
        renderWithTheme({ selectedProjectId: 1 });
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      await closeWindow();

      expect(updateSessionDuration).toHaveBeenCalledWith(42, 125);
    });

    it('leaves the session open', async () => {
      const stopSession = vi.fn<StopSession>().mockResolvedValue(undefined);
      mockSessionsHook(mockSessions[0], { stopSession });

      await act(async () => {
        renderWithTheme({ selectedProjectId: 1 });
      });
      await closeWindow();

      expect(stopSession).not.toHaveBeenCalled();
    });

    it('saves nothing when no session is in progress', async () => {
      const updateSessionDuration = vi.fn<UpdateSessionDuration>().mockResolvedValue(undefined);
      mockSessionsHook(null, { updateSessionDuration });

      await act(async () => {
        renderWithTheme({ selectedProjectId: 1 });
      });
      await closeWindow();

      expect(updateSessionDuration).not.toHaveBeenCalled();
    });

    it('stops saving once the timer screen is gone', async () => {
      const updateSessionDuration = vi.fn<UpdateSessionDuration>().mockResolvedValue(undefined);
      mockSessionsHook(mockSessions[0], { updateSessionDuration });

      let view!: ReturnType<typeof renderWithTheme>;
      await act(async () => {
        view = renderWithTheme({ selectedProjectId: 1 });
      });
      view.unmount();
      await closeWindow();

      expect(updateSessionDuration).not.toHaveBeenCalled();
    });

    // The session begins after mount, so the registered handler must read current state.
    const renderThenStartSession = async (updateSessionDuration: Mock<UpdateSessionDuration>) => {
      const hookValue = (currentSession: Session | null) => ({
        ...vi.mocked(useAppState.useSessions)(),
        updateSessionDuration,
        state: {
          ...initialState,
          sessions: { ...initialState.sessions, currentSession },
        },
      });

      vi.mocked(useAppState.useSessions).mockReturnValue(hookValue(null));

      let view!: ReturnType<typeof renderWithTheme>;
      await act(async () => {
        view = renderWithTheme({ selectedProjectId: 1 });
      });

      vi.mocked(useAppState.useSessions).mockReturnValue(hookValue(mockSessions[0]));
      await act(async () => {
        view.rerender(
          <SessionControls
            projects={mockProjects}
            sessions={mockSessions}
            projectSelected={vi.fn()}
            selectedProjectId={1}
            isProjectsLoading={false}
            isSessionsLoading={false}
            sessionCompleted={vi.fn()}
            sessionEdited={vi.fn()}
            projectTags={[]}
          />
        );
      });
    };

    it('saves a session that started after mount', async () => {
      const updateSessionDuration = vi.fn<UpdateSessionDuration>().mockResolvedValue(undefined);
      await renderThenStartSession(updateSessionDuration);

      await closeWindow();

      expect(updateSessionDuration).toHaveBeenCalledWith(mockSessions[0].sessionId, 0);
    });
  });
});
