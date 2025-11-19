import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import RecentSessions from './RecentSessions';
import { ThemeProvider } from 'styled-components';
import { theme } from '@/styles/theme';
import type { Session } from '@/types/session';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { AppProvider } from '@/contexts/AppProvider.tsx';
import * as useAppState from '@/state/hooks/useAppState';
import type { AppState } from '@/types/state';

vi.mock('@/state/hooks/useAppState');

describe('RecentSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppState.useSessions).mockReturnValue({
      state: {
        sessions: { currentSession: null, sessions: [], isLoading: false, error: null },
      } as unknown as AppState,
      sessions: [],
      currentSession: null,
      getSessions: vi.fn(),
      startSession: vi.fn(),
      stopSession: vi.fn(),
      pauseSession: vi.fn(),
      resumeSession: vi.fn(),
      deleteSession: vi.fn(),
      updateSessionNotes: vi.fn(),
      updateSessionDuration: vi.fn(),
      setSessions: vi.fn(),
    });
  });

  afterEach(() => {});
  const mockSessions: Session[] = [
    {
      sessionId: 1,
      projectId: 1,
      startTime: new Date(),
      duration: 0,
      status: 'active',
      notes: 'Test notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const renderSessions = (
    sessions: Session[] = mockSessions,
    sessionEdited: () => void = () => {}
  ) => {
    render(
      <ThemeProvider theme={theme}>
        <DatabaseProvider>
          <AppProvider>
            <RecentSessions sessions={sessions} sessionEdited={sessionEdited} />
          </AppProvider>
        </DatabaseProvider>
      </ThemeProvider>
    );
  };

  it('renders the recent sessions', () => {
    renderSessions();
    expect(screen.getByText('Recent Sessions')).toBeInTheDocument();
  });

  it('renders the recent sessions  with no sessions', () => {
    renderSessions([]);
    expect(screen.getByText('No recent sessions')).toBeInTheDocument();
  });

  it('opens edit modal and saves changes, then closes modal', async () => {
    const updateSessionNotes = vi.fn().mockResolvedValue(undefined);
    const updateSessionDuration = vi.fn().mockResolvedValue(undefined);
    const sessionEdited = vi.fn();

    vi.mocked(useAppState.useSessions).mockReturnValue({
      state: {
        sessions: { currentSession: null, sessions: [], isLoading: false, error: null },
      } as unknown as AppState,
      sessions: [],
      currentSession: null,
      getSessions: vi.fn(),
      startSession: vi.fn(),
      stopSession: vi.fn(),
      pauseSession: vi.fn(),
      resumeSession: vi.fn(),
      deleteSession: vi.fn(),
      updateSessionNotes,
      updateSessionDuration,
      setSessions: vi.fn(),
    });

    renderSessions(mockSessions, sessionEdited);

    const editButton = screen.getByRole('button', { name: /edit session/i });
    fireEvent.click(editButton);

    const notesInput = await screen.findByLabelText(/session notes/i);
    fireEvent.change(notesInput, { target: { value: 'Updated notes' } });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateSessionNotes).toHaveBeenCalledWith(1, 'Updated notes');
      expect(updateSessionDuration).toHaveBeenCalled();
      expect(sessionEdited).toHaveBeenCalled();
    });

    expect(screen.queryByRole('heading', { name: /edit session/i })).not.toBeInTheDocument();
  });

  it('opens delete confirmation and deletes a session', async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined);
    const sessionEdited = vi.fn();

    vi.mocked(useAppState.useSessions).mockReturnValue({
      state: {
        sessions: { currentSession: null, sessions: [], isLoading: false, error: null },
      } as unknown as AppState,
      sessions: [],
      currentSession: null,
      getSessions: vi.fn(),
      startSession: vi.fn(),
      stopSession: vi.fn(),
      pauseSession: vi.fn(),
      resumeSession: vi.fn(),
      deleteSession,
      updateSessionNotes: vi.fn(),
      updateSessionDuration: vi.fn(),
      setSessions: vi.fn(),
    });

    renderSessions(mockSessions, sessionEdited);

    const deleteButton = screen.getByRole('button', { name: /delete session/i });
    fireEvent.click(deleteButton);

    expect(screen.getByText(/are you sure you want to delete this session/i)).toBeInTheDocument();

    const modal = screen.getByRole('dialog');
    const confirmButton = within(modal).getByRole('button', { name: /delete/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith(1);
      expect(sessionEdited).toHaveBeenCalled();
    });
  });
});
