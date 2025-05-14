import React, { useEffect } from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TimerPage from './TimerPage';
import { ActionType } from '@/types/state';
import { useAppContext } from '@/state/context/AppContext';
import { useProjects } from '@/contexts/ProjectsContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { AllTheProviders } from '@/test-utils';

// Mock the useProjects hook and provider
vi.mock('@/contexts/ProjectsContext', () => {
  const mockProjectsContext = {
    projects: [],
    isLoading: false,
    error: null,
    refreshProjects: vi.fn().mockResolvedValue(undefined),
  };

  return {
    useProjects: vi.fn().mockReturnValue(mockProjectsContext),
    ProjectsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// Mock the useDatabase hook and provider
vi.mock('@/contexts/DatabaseContext', () => {
  const mockDatabase = {
    getSessions: vi.fn().mockResolvedValue([]),
    getAllProjects: vi.fn().mockResolvedValue([]),
    createProject: vi.fn().mockResolvedValue(1),
    updateProject: vi.fn().mockResolvedValue(undefined),
    deleteProject: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue(1),
    endSession: vi.fn().mockResolvedValue(undefined),
    getSessionsForProject: vi.fn().mockResolvedValue([]),
    getProject: vi.fn().mockResolvedValue([]),
  };

  return {
    useDatabase: vi.fn().mockReturnValue(mockDatabase),
    DatabaseProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// Create a wrapper that provides all contexts
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <AllTheProviders>{children}</AllTheProviders>
);

describe('TimerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock projects context
    const mockProjectsContext = useProjects();
    mockProjectsContext.projects = [];
    mockProjectsContext.isLoading = false;
    mockProjectsContext.error = null;
  });

  it('renders without crashing', () => {
    render(<TimerPage />, { wrapper: TestWrapper });
    expect(screen.getByText('Select a project')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<TimerPage />, { wrapper: TestWrapper });
    expect(screen.getByText('Start Session')).toBeInTheDocument();
  });

  it('displays sessions when loaded', async () => {
    // Set up the mock projects context with a project
    const mockProjectsContext = useProjects();
    mockProjectsContext.projects = [
      {
        id: 1,
        name: 'Project 1',
        description: '',
        totalTime: 3600,
        sessionCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Set up the database mock to return a session
    const mockDatabase = useDatabase();
    (mockDatabase.getAllProjects as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 1,
        name: 'Project 1',
        description: '',
        created_at: '2024-03-10T10:00:00Z',
      },
    ]);
    (mockDatabase.getSessionsForProject as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 1,
        project_id: 1,
        start_time: '2024-03-10T10:00:00Z',
        end_time: '2024-03-10T11:00:00Z',
        duration: 3600,
        notes: 'Test session 1',
      },
    ]);

    // Create a wrapper that sets up the context before rendering
    const TestWrapperWithContext = ({ children }: { children: React.ReactNode }) => {
      const { dispatch } = useAppContext();

      useEffect(() => {
        // Set up the app context with the project
        dispatch({ type: ActionType.SET_CURRENT_PROJECT, payload: '1' });
        dispatch({
          type: ActionType.ADD_PROJECT,
          payload: {
            id: 1,
            name: 'Project 1',
            description: '',
            totalTime: 3600,
            sessionCount: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }, [dispatch]);

      return <>{children}</>;
    };

    // Create a combined wrapper
    const CombinedWrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper>
        <TestWrapperWithContext>{children}</TestWrapperWithContext>
      </TestWrapper>
    );

    render(<TimerPage />, { wrapper: CombinedWrapper });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Select the project
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });

    // Then check for session content
    await waitFor(() => {
      const sessionList = screen.getByText('Recent Sessions').closest('div');
      expect(sessionList).toBeTruthy();
      const sessionListWithin = within(sessionList!);
      expect(sessionListWithin.getByText('Test session 1')).toBeInTheDocument();
      expect(sessionListWithin.getByText('1h 0m')).toBeInTheDocument();
    });
  });

  it('handles sessions with missing optional fields', async () => {
    // Set up the mock projects context with a project
    const mockProjectsContext = useProjects();
    mockProjectsContext.projects = [
      {
        id: 1,
        name: 'Project 1',
        description: '',
        totalTime: 45,
        sessionCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Set up the database mock to return a session
    const mockDatabase = useDatabase();
    (mockDatabase.getAllProjects as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 1,
        name: 'Project 1',
        description: '',
        created_at: '2024-03-10T10:00:00Z',
      },
    ]);
    (mockDatabase.getSessionsForProject as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 1,
        project_id: 1,
        start_time: '2024-03-10T10:00:00Z',
        end_time: '2024-03-10T10:00:45Z',
        duration: 45,
        notes: 'Minimal session test',
      },
    ]);

    // Create a wrapper that sets up the context before rendering
    const TestWrapperWithContext = ({ children }: { children: React.ReactNode }) => {
      const { dispatch } = useAppContext();

      useEffect(() => {
        // Set up the app context with the project
        dispatch({ type: ActionType.SET_CURRENT_PROJECT, payload: '1' });
        dispatch({
          type: ActionType.ADD_PROJECT,
          payload: {
            id: 1,
            name: 'Project 1',
            description: '',
            totalTime: 45,
            sessionCount: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }, [dispatch]);

      return <>{children}</>;
    };

    // Create a combined wrapper
    const CombinedWrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper>
        <TestWrapperWithContext>{children}</TestWrapperWithContext>
      </TestWrapper>
    );

    render(<TimerPage />, { wrapper: CombinedWrapper });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Select the project
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });

    // Then check for session content
    await waitFor(() => {
      const sessionList = screen.getByText('Recent Sessions').closest('div');
      expect(sessionList).toBeTruthy();
      const sessionListWithin = within(sessionList!);
      expect(sessionListWithin.getByText('Minimal session test')).toBeInTheDocument();
      expect(sessionListWithin.getByText('45s')).toBeInTheDocument();
    });
  });

  it('renders session controls and list', () => {
    render(<TimerPage />, { wrapper: TestWrapper });

    // Check for session controls
    expect(screen.getByRole('combobox')).toBeInTheDocument(); // Project select
    expect(screen.getByPlaceholderText('Add notes...')).toBeInTheDocument(); // Notes textarea
    expect(screen.getByText('Start Session')).toBeInTheDocument();
    // Stop Session button should not be visible when no session is active
    expect(screen.queryByText('Stop Session')).not.toBeInTheDocument();

    // Check for session list to not be in the document when a project has not been chosen
    expect(screen.queryByText('Recent Sessions')).not.toBeInTheDocument();
  });

  it('disables start button when no project is selected', () => {
    render(<TimerPage />, { wrapper: TestWrapper });
    const startButton = screen.getByText('Start Session');
    expect(startButton).toBeDisabled();
  });

  it('enables start button when project is selected', async () => {
    // Set up the mock projects context with a project
    const mockProjectsContext = useProjects();
    mockProjectsContext.projects = [
      {
        id: 1,
        name: 'Project 1',
        description: '',
        totalTime: 0,
        sessionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    render(<TimerPage />, { wrapper: TestWrapper });

    // Wait for the project to be added to the select options
    await waitFor(() => {
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    // Select the project
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });

    // Verify the selection
    expect(select).toHaveValue('1');
    await waitFor(() => {
      // Now check that the start button is enabled
      const startButton = screen.getByText('Start Session');
      expect(startButton).not.toBeDisabled();
    });
  });

  it('shows start button when no session is active', async () => {
    // Set up the mock projects context with a project
    const mockProjectsContext = useProjects();
    mockProjectsContext.projects = [
      {
        id: 1,
        name: 'Project 1',
        description: '',
        totalTime: 0,
        sessionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Set up the database mock to return a session
    const mockDatabase = useDatabase();
    (mockDatabase.getAllProjects as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 1,
        name: 'Project 1',
        description: '',
        created_at: '2024-03-10T10:00:00Z',
      },
    ]);
    (mockDatabase.getSessionsForProject as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    (mockDatabase.createSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

    // Create a wrapper that sets up the context before rendering
    const TestWrapperWithContext = ({ children }: { children: React.ReactNode }) => {
      const { dispatch } = useAppContext();

      useEffect(() => {
        dispatch({ type: ActionType.SET_CURRENT_PROJECT, payload: '1' });
      }, [dispatch]);

      return <>{children}</>;
    };

    // Create a combined wrapper
    const CombinedWrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper>
        <TestWrapperWithContext>{children}</TestWrapperWithContext>
      </TestWrapper>
    );

    render(<TimerPage />, { wrapper: CombinedWrapper });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Select a project
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });

    await waitFor(() => {
      const startButton = screen.getByText('Start Session');
      expect(startButton).toBeInTheDocument();
    });
  });

  it('shows stop button when session is active', async () => {
    // Set up the mock projects context with a project
    const mockProjectsContext = useProjects();
    mockProjectsContext.projects = [
      {
        id: 1,
        name: 'Project 1',
        description: '',
        totalTime: 0,
        sessionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Set up the database mock to return a session
    const mockDatabase = useDatabase();
    (mockDatabase.getAllProjects as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 1,
        name: 'Project 1',
        description: '',
        created_at: '2024-03-10T10:00:00Z',
      },
    ]);
    (mockDatabase.getSessionsForProject as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    (mockDatabase.createSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

    // Create a wrapper that sets up the context before rendering
    const TestWrapperWithContext = ({ children }: { children: React.ReactNode }) => {
      const { dispatch } = useAppContext();

      useEffect(() => {
        dispatch({ type: ActionType.SET_CURRENT_PROJECT, payload: '1' });
      }, [dispatch]);

      return <>{children}</>;
    };

    // Create a combined wrapper
    const CombinedWrapper = ({ children }: { children: React.ReactNode }) => (
      <TestWrapper>
        <TestWrapperWithContext>{children}</TestWrapperWithContext>
      </TestWrapper>
    );

    render(<TimerPage />, { wrapper: CombinedWrapper });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Select a project
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });

    // Start a session
    await waitFor(() => {
      const startButton = screen.getByText('Start Session');
      fireEvent.click(startButton);
    });

    // Wait for the stop button to appear
    await waitFor(() => {
      const stopButton = screen.getByText('Stop Session');
      expect(stopButton).toBeInTheDocument();
      expect(stopButton).not.toBeDisabled();
    });
  });

  it('shows loading state while fetching sessions', async () => {
    // Set up the mock projects context with loading state
    const mockProjectsContext = useProjects();
    mockProjectsContext.isLoading = true;

    render(<TimerPage />, { wrapper: TestWrapper });
    expect(screen.getByText('Start Session')).toBeDisabled();
  });
});
