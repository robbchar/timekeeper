import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider } from '@/state/context/AppContext';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { useProjects, useSessions, useTags, useSettings, useUI } from './useAppState';
import { Theme } from '@/types/state';
import type { Project, Tag } from '@/types/state';
import type { CreateSessionParams } from '@/types/session';
import { setupMockDatabase } from '@/components/timer/__mocks__/setup';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>
    <DatabaseProvider>{children}</DatabaseProvider>
  </AppProvider>
);

describe('useProjects', () => {
  beforeEach(() => {
    setupMockDatabase();
  });

  it('should add a project', () => {
    const { result } = renderHook(() => useProjects(), { wrapper });
    const mockProject: Project = {
      id: 1,
      name: 'Test Project',
      description: 'Test Description',
      totalTime: 0,
      sessionCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    act(() => {
      result.current.addProject(mockProject);
    });

    expect(result.current.projects).toHaveLength(1);
    expect(result.current.projects[0]).toEqual(mockProject);
  });
});

describe('useSessions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupMockDatabase();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('should start and stop a session', async () => {
    const { result } = renderHook(() => useSessions(), { wrapper });
    const startTime = new Date('2024-01-01T10:00:00');
    vi.setSystemTime(startTime);

    const sessionParams: CreateSessionParams = {
      projectId: 1,
      notes: 'Test session',
    };

    await act(async () => {
      await result.current.startSession(sessionParams);
    });

    expect(result.current.currentSession).toBeDefined();
    expect(result.current.currentSession?.projectId).toBe(1);
    expect(result.current.currentSession?.notes).toBe('Test session');
    expect(result.current.currentSession?.status).toBe('active');

    // Advance time by 1 hour
    vi.advanceTimersByTime(3600000);

    await act(async () => {
      await result.current.stopSession();
    });

    expect(result.current.currentSession).toBeNull();
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0].status).toBe('completed');
    expect(result.current.sessions[0].endTime).toBeDefined();
    expect(result.current.sessions[0].duration).toBe(3600000); // 1 hour in milliseconds
  });
});

describe('useTags', () => {
  beforeEach(() => {
    setupMockDatabase();
  });

  it('should add a tag', () => {
    const { result } = renderHook(() => useTags(), { wrapper });
    const mockTag: Tag = {
      id: 1,
      name: 'Test Tag',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    act(() => {
      result.current.addTag(mockTag);
    });

    expect(result.current.tags).toHaveLength(1);
    expect(result.current.tags[0]).toEqual(mockTag);
  });
});

describe('useSettings', () => {
  beforeEach(() => {
    setupMockDatabase();
  });

  it('should update settings', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    act(() => {
      result.current.updateSettings({ timeFormat: '12h' });
    });

    expect(result.current.settings.timeFormat).toBe('12h');
  });
});

describe('useUI', () => {
  beforeEach(() => {
    setupMockDatabase();
  });

  it('should toggle theme', () => {
    const { result } = renderHook(() => useUI(), { wrapper });

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.ui.theme).toBe(Theme.DARK);

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.ui.theme).toBe(Theme.LIGHT);
  });

  it('should set error state', () => {
    const { result } = renderHook(() => useUI(), { wrapper });

    act(() => {
      result.current.setError('Test error');
    });

    expect(result.current.ui.error).toBe('Test error');
  });
});
