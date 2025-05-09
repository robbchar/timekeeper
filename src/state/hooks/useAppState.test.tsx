import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider } from '@/state/context/AppContext';
import { useProjects, useSessions, useTags, useSettings, useUI } from './useAppState';
import { Theme } from '@/types/state';
import type { Project, Session, Tag } from '@/types/state';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

describe('useProjects', () => {
  it('should add a project', () => {
    const { result } = renderHook(() => useProjects(), { wrapper });
    const mockProject: Project = {
      id: '1',
      name: 'Test Project',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    act(() => {
      result.current.addProject(mockProject);
    });

    expect(result.current.projects).toHaveLength(1);
    expect(result.current.projects[0]).toEqual(mockProject);
  });
});

describe('useSessions', () => {
  it('should start and stop a session', () => {
    const { result } = renderHook(() => useSessions(), { wrapper });
    const mockSession: Session = {
      id: '1',
      projectId: '1',
      startTime: new Date(),
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    act(() => {
      result.current.startSession(mockSession);
    });

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0]).toEqual(mockSession);

    act(() => {
      result.current.stopSession('1');
    });

    expect(result.current.sessions[0].endTime).toBeInstanceOf(Date);
  });
});

describe('useTags', () => {
  it('should add a tag', () => {
    const { result } = renderHook(() => useTags(), { wrapper });
    const mockTag: Tag = {
      id: '1',
      name: 'Test Tag',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    act(() => {
      result.current.addTag(mockTag);
    });

    expect(result.current.tags).toHaveLength(1);
    expect(result.current.tags[0]).toEqual(mockTag);
  });
});

describe('useSettings', () => {
  it('should update settings', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    act(() => {
      result.current.updateSettings({ timeFormat: '12h' });
    });

    expect(result.current.settings.timeFormat).toBe('12h');
  });
});

describe('useUI', () => {
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