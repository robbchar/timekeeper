import React, { useEffect } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
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
    const select = screen.getByRole('button', { name: 'Select a project Select a project' });
    userEvent.click(select);

    const option = await screen.findByRole('option', { name: /Project 1/i });
    userEvent.click(option);

    await waitFor(() => {
      const startButton = screen.getByText('Start Session');
      expect(startButton).toBeInTheDocument();
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
