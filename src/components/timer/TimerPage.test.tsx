import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import TimerPage from './TimerPage';
import SessionControls from './SessionControls';
import { useProjects } from '@/contexts/ProjectsContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useSessions } from '@/state/hooks/useAppState';
import type { AppState } from '@/types/state';

vi.mock('./SessionControls', () => ({
  __esModule: true,
  default: vi.fn(() => <div data-testid="session-controls" />),
}));

vi.mock('@/contexts/ProjectsContext');
vi.mock('@/contexts/DatabaseContext');
vi.mock('@/state/hooks/useAppState');

describe('TimerPage', () => {
  const mockProjectsContext = {
    projects: [
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
    ],
    isLoading: false,
    error: null as string | null,
    selectedProjectId: 1,
    setSelectedProjectId: vi.fn(),
    refreshProjects: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useProjects).mockReturnValue(mockProjectsContext);
    vi.mocked(useDatabase).mockReturnValue({
      getSessionsForProject: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof useDatabase>);
    vi.mocked(useSessions).mockReturnValue({
      state: {} as AppState,
      sessions: [],
      currentSession: null,
      setSessions: vi.fn(),
      getSessions: vi.fn(),
      startSession: vi.fn(),
      stopSession: vi.fn(),
      pauseSession: vi.fn(),
      resumeSession: vi.fn(),
      deleteSession: vi.fn(),
      updateSessionNotes: vi.fn(),
      updateSessionDuration: vi.fn(),
    });
  });

  it('renders without crashing', () => {
    render(<TimerPage />);
    expect(screen.getByTestId('timer-page')).toBeInTheDocument();
  });

  it('passes selectedProjectId from context into SessionControls', () => {
    render(<TimerPage />);

    const mockSessionControls = SessionControls as unknown as Mock;
    expect(mockSessionControls).toHaveBeenCalled();
    const props = mockSessionControls.mock.calls[0][0];
    expect(props.selectedProjectId).toBe(1);
  });

  it('updates selectedProjectId when projectSelected is called', () => {
    mockProjectsContext.selectedProjectId = 1;
    mockProjectsContext.setSelectedProjectId.mockClear();

    render(<TimerPage />);

    const mockSessionControls = SessionControls as unknown as Mock;
    const props = mockSessionControls.mock.calls[0][0];

    props.projectSelected(2);

    expect(mockProjectsContext.setSelectedProjectId).toHaveBeenCalledWith(2);
  });
});
