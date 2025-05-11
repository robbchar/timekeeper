import React, { useEffect } from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TimerPage from './TimerPage';
import { ActionType } from '@/types/state';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import { useAppContext } from '@/state/context/AppContext';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { AppProvider } from '@/state/context/AppContext';
import {
  defaultProjects,
  defaultSessions,
  mockUseDatabase,
  setupMockDatabase,
} from './__mocks__/setup';

// Create a wrapper component that provides both contexts
const BaseWrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>
    <AppProvider>
      <DatabaseProvider>{children}</DatabaseProvider>
    </AppProvider>
  </ThemeProvider>
);

// Create a wrapper that adds a project to the context
const ProjectWrapper = ({ children }: { children: React.ReactNode }) => {
  const { dispatch } = useAppContext();
  useEffect(() => {
    // Add the project
    dispatch({ type: ActionType.ADD_PROJECT, payload: defaultProjects[0] });
    // Set it as the current project
    dispatch({ type: ActionType.SET_CURRENT_PROJECT, payload: '1' });
  }, [dispatch]);
  return <>{children}</>;
};

// Combined wrapper that provides both context and project
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BaseWrapper>
    <ProjectWrapper>{children}</ProjectWrapper>
  </BaseWrapper>
);

describe('TimerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset both database and IPC mocks to their default state
    // setupMockDatabase();
    // mockIpcRenderer.invoke.mockImplementation((channel: string, ...args: unknown[]) => {
    //   switch (channel) {
    //     case 'db:getSessionsForProject':
    //       return Promise.resolve(defaultSessions);
    //     default:
    //       return Promise.resolve([]);
    //   }
    // });
  });

  it('renders without crashing', () => {
    render(<TimerPage />, { wrapper: BaseWrapper });
    expect(screen.getByText('Recent Sessions')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<TimerPage />, { wrapper: BaseWrapper });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  // it('shows error state when database fails', async () => {
  //   const error = new Error('Database error');
  //   setupMockDatabase();
  //   // Mock both database and IPC to fail
  //   mockUseDatabase.mockReturnValue({
  //     getSessionsForProject: vi.fn().mockRejectedValue(error),
  //   });
  //   // Update IPC mock to also fail
  //   mockIpcRenderer.invoke.mockImplementation(() => Promise.reject(error));

  //   render(<TimerPage />, { wrapper: TestWrapper });

  //   await waitFor(() => {
  //     const sessionList = screen.getByText('Recent Sessions').closest('div');
  //     expect(sessionList).toBeTruthy();
  //     const sessionListWithin = within(sessionList!);
  //     expect(sessionListWithin.getByText('Failed to load sessions')).toBeInTheDocument();
  //   });
  // });

  it('displays sessions when loaded', async () => {
    setupMockDatabase();
    mockUseDatabase.mockReturnValue({
      getSessionsForProject: vi.fn().mockResolvedValue(defaultSessions),
    });

    render(<TimerPage />, { wrapper: TestWrapper });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Then check for session content
    await waitFor(() => {
      const sessionList = screen.getByText('Recent Sessions').closest('div');
      expect(sessionList).toBeTruthy();
      const sessionListWithin = within(sessionList!);
      expect(sessionListWithin.getByText('Project 1')).toBeInTheDocument();
      expect(sessionListWithin.getByText('01:00:00')).toBeInTheDocument();
    });
  });

  it('handles sessions with missing optional fields', async () => {
    const minimalSession = {
      id: 3,
      project_id: 1,
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      duration: 45,
      notes: 'Minimal session test',
    };

    // Set up the mock with our minimal session
    setupMockDatabase([minimalSession]);

    render(<TimerPage />, { wrapper: TestWrapper });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Then check for session content
    await waitFor(() => {
      const sessionList = screen.getByText('Recent Sessions').closest('div');
      expect(sessionList).toBeTruthy();
      const sessionListWithin = within(sessionList!);
      expect(sessionListWithin.getByText('Project 1')).toBeInTheDocument();
      expect(sessionListWithin.getByText('00:00:45')).toBeInTheDocument();
    });
  });

  it('renders session controls and list', () => {
    render(<TimerPage />, { wrapper: BaseWrapper });

    // Check for session controls
    expect(screen.getByRole('combobox')).toBeInTheDocument(); // Project select
    expect(screen.getByPlaceholderText('Add notes...')).toBeInTheDocument(); // Notes textarea
    expect(screen.getByText('Start Session')).toBeInTheDocument();
    // Stop Session button should not be visible when no session is active
    expect(screen.queryByText('Stop Session')).not.toBeInTheDocument();

    // Check for session list
    expect(screen.getByText('Recent Sessions')).toBeInTheDocument();
  });

  it('disables start button when no project is selected', () => {
    render(<TimerPage />, { wrapper: BaseWrapper });
    const startButton = screen.getByText('Start Session');
    expect(startButton).toBeDisabled();
  });

  it('enables start button when project is selected', async () => {
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

    // Now check that the start button is enabled
    const startButton = screen.getByText('Start Session');
    expect(startButton).not.toBeDisabled();
  });

  it('shows start button when no session is active', () => {
    render(<TimerPage />, { wrapper: BaseWrapper });
    const startButton = screen.getByText('Start Session');
    expect(startButton).toBeInTheDocument();
    expect(startButton).toBeDisabled();
  });

  it('shows stop button when session is active', async () => {
    // Mock an active session
    mockUseDatabase.mockReturnValue({
      getSessionsForProject: vi.fn().mockResolvedValue([]),
    });

    render(<TimerPage />, { wrapper: TestWrapper });

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Select a project
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1' } });

    // Start a session
    const startButton = screen.getByText('Start Session');
    fireEvent.click(startButton);

    // Wait for the stop button to appear
    await waitFor(() => {
      const stopButton = screen.getByText('Stop Session');
      expect(stopButton).toBeInTheDocument();
      expect(stopButton).not.toBeDisabled();
    });
  });

  it('shows loading state while fetching sessions', async () => {
    mockUseDatabase.mockReturnValue({
      getSessionsForProject: vi.fn().mockImplementation(() => new Promise(() => {})),
    });

    render(<TimerPage />, { wrapper: BaseWrapper });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows "Unknown Project" for sessions with missing project', async () => {
    const sessionsWithMissingProject = [
      {
        id: 1, // Database uses number IDs
        project_id: 999, // Database uses number IDs
        start_time: '2024-03-10T10:00:00Z',
        end_time: '2024-03-10T11:00:00Z',
        duration: 3600,
        notes: 'Test session 1',
      },
    ];

    setupMockDatabase(sessionsWithMissingProject);

    // Mock the useDatabase hook to return our test data
    mockUseDatabase.mockReturnValue({
      getSessionsForProject: vi.fn().mockResolvedValue(sessionsWithMissingProject),
    });

    render(<TimerPage />, { wrapper: TestWrapper });

    // First wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Then wait for the session to be displayed
    await waitFor(() => {
      const sessionList = screen.getByText('Recent Sessions').closest('div');
      expect(sessionList).toBeTruthy();
      const sessionListWithin = within(sessionList!);
      expect(sessionListWithin.getByText('Unknown Project')).toBeInTheDocument();
    });
  });
});
