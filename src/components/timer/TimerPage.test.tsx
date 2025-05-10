import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TimerPage from './TimerPage';
import { ActionType } from '@/types/state';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { useAppContext } from '@/state/context/AppContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { DatabaseProvider } from '@/contexts/DatabaseContext';

// Mock the hooks
vi.mock('@/contexts/DatabaseContext', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useDatabase: vi.fn().mockReturnValue({
      getSessionsForProject: vi.fn(),
    }),
  };
});

// Mock the AppContext
vi.mock('@/state/context/AppContext', () => {
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

  const mockContextValue = {
    state: {
      projects: mockProjects,
      sessions: [],
      currentSession: null,
    },
    dispatch: vi.fn(),
  };

  const MockAppContext = React.createContext(mockContextValue);

  return {
    useAppContext: vi.fn().mockReturnValue(mockContextValue),
    AppProvider: ({ children }: { children: React.ReactNode }) => (
      <MockAppContext.Provider value={mockContextValue}>{children}</MockAppContext.Provider>
    ),
    AppContext: MockAppContext,
  };
});

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

const mockSessions = [
  {
    id: 1,
    project_id: '1',
    start_time: '2024-03-10T10:00:00Z',
    end_time: '2024-03-10T11:00:00Z',
    duration: 3600,
    notes: 'Test session 1',
  },
  {
    id: 2,
    project_id: '2',
    start_time: '2024-03-10T12:00:00Z',
    end_time: '2024-03-10T13:30:00Z',
    duration: 5400,
    notes: 'Test session 2',
  },
];

// Base wrapper that provides theme and context
const BaseWrapper = ({ children }: { children: React.ReactNode }) => (
  <DatabaseProvider>
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  </DatabaseProvider>
);

// Wrapper that also adds a project
const ProjectWrapper = ({ children }: { children: React.ReactNode }) => {
  const { dispatch } = useAppContext();

  // Add the project when the component mounts
  React.useEffect(() => {
    dispatch({ type: ActionType.ADD_PROJECT, payload: mockProjects[0] });
  }, [dispatch]);

  return <>{children}</>;
};

describe('TimerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      expect(screen.getByText('Project 1')).toBeInTheDocument();
    });

    // Select the project
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });

    // Wait for the button to be enabled
    const startButton = screen.getByText('Start Session');
    expect(startButton).not.toBeDisabled();
  });

  it('disables stop button when no session is active', () => {
    render(<TimerPage />, { wrapper: BaseWrapper });
    const stopButton = screen.getByText('Stop Session');
    expect(stopButton).toBeDisabled();
  });

  it('shows loading state while fetching sessions', async () => {
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getSessionsForProject: vi.fn().mockImplementation(() => new Promise(() => {})),
    });

    render(<TimerPage />, { wrapper: BaseWrapper });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state when session fetch fails', async () => {
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getSessionsForProject: vi.fn().mockRejectedValue(new Error('Failed to fetch')),
    });

    render(<TimerPage />, { wrapper: BaseWrapper });
    await waitFor(() => {
      expect(screen.getByText('Failed to load sessions')).toBeInTheDocument();
    });
  });

  it('displays sessions with correct project names and durations', async () => {
    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getSessionsForProject: vi.fn().mockResolvedValue(mockSessions),
    });

    render(<TimerPage />, { wrapper: BaseWrapper });

    // Wait for sessions to load
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Scope to the session list
    const sessionList = screen.getByText('Recent Sessions').closest('div');
    expect(sessionList).toBeTruthy();
    const sessionListWithin = within(sessionList!);

    // Check project names in session list only
    expect(sessionListWithin.getAllByText('Project 1').length).toBeGreaterThan(0);
    expect(sessionListWithin.getAllByText('Project 2').length).toBeGreaterThan(0);

    // Check session notes
    expect(sessionListWithin.getByText('Test session 1')).toBeInTheDocument();
    expect(sessionListWithin.getByText('Test session 2')).toBeInTheDocument();

    // Check formatted durations
    expect(sessionListWithin.getByText('01:00:00')).toBeInTheDocument();
    expect(sessionListWithin.getByText('01:30:00')).toBeInTheDocument();
  });

  it('shows "Unknown Project" for sessions with missing project', async () => {
    const sessionsWithMissingProject = [
      {
        id: 1,
        project_id: '999', // Non-existent project ID
        start_time: '2024-03-10T10:00:00Z',
        end_time: '2024-03-10T11:00:00Z',
        duration: 3600,
        notes: 'Test session 1',
      },
    ];

    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getSessionsForProject: vi.fn().mockResolvedValue(sessionsWithMissingProject),
    });

    render(<TimerPage />, { wrapper: BaseWrapper });

    await waitFor(() => {
      const sessionList = screen.getByText('Recent Sessions').closest('div');
      expect(sessionList).toBeTruthy();
      const sessionListWithin = within(sessionList!);
      expect(
        sessionListWithin.getByText(content => content.includes('Unknown Project'))
      ).toBeInTheDocument();
    });
  });

  it('handles sessions with missing optional fields', async () => {
    const incompleteSession = [
      {
        id: 3,
        project_id: '1',
        start_time: '2024-03-10T14:00:00Z',
        // Missing end_time, duration, and notes
      },
    ];

    (useDatabase as ReturnType<typeof vi.fn>).mockReturnValue({
      getSessionsForProject: vi.fn().mockResolvedValue(incompleteSession),
    });

    render(<TimerPage />, { wrapper: BaseWrapper });

    await waitFor(() => {
      const sessionList = screen.getByText('Recent Sessions').closest('div');
      expect(sessionList).toBeTruthy();
      const sessionListWithin = within(sessionList!);
      expect(sessionListWithin.getAllByText('Project 1').length).toBeGreaterThan(0);
      expect(sessionListWithin.getByText('00:00:00')).toBeInTheDocument();
    });
  });
});
