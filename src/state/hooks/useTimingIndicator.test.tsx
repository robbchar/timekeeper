import React from 'react';
import { renderHook } from '@testing-library/react';
import { AppContext, type AppContextType } from '@/contexts/AppContext';
import { initialState } from '@/state/initialState';
import type { AppState } from '@/types/state';
import type { SessionStatus } from '@/types/session';
import { createTestAppWindow } from '@/test-utils/appWindow';
import { useTimingIndicator } from './useTimingIndicator';

const stateWithSession = (status: SessionStatus | null): AppState => ({
  ...initialState,
  sessions: {
    ...initialState.sessions,
    currentSession: status
      ? { sessionId: 1, projectId: 1, startTime: new Date(), duration: 0, status }
      : null,
  },
});

const renderIndicator = (initialStatus: SessionStatus | null) => {
  const appWindow = createTestAppWindow();
  window.appWindow = appWindow.bridge;

  let state = stateWithSession(initialStatus);
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const value: AppContextType = {
      state,
      dispatch: vi.fn(),
      getState: () => state,
      createProject: vi.fn(),
      updateProject: vi.fn(),
      deleteProject: vi.fn(),
    };
    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
  };

  const view = renderHook(() => useTimingIndicator(), { wrapper });

  const changeStatus = (nextStatus: SessionStatus | null) => {
    state = stateWithSession(nextStatus);
    view.rerender();
  };

  return { updates: appWindow.timingIndicatorUpdates, changeStatus };
};

describe('useTimingIndicator', () => {
  it('shows the indicator while the current session is timing', () => {
    const { updates } = renderIndicator('active');

    expect(updates).toEqual([true]);
  });

  it('hides the indicator while the session is paused', () => {
    const { updates } = renderIndicator('paused');

    expect(updates).toEqual([false]);
  });

  it('hides the indicator when there is no session', () => {
    const { updates } = renderIndicator(null);

    expect(updates).toEqual([false]);
  });

  it('shows the indicator once timing starts', () => {
    const { updates, changeStatus } = renderIndicator('paused');

    changeStatus('active');

    expect(updates).toEqual([false, true]);
  });

  it('hides the indicator once the session ends', () => {
    const { updates, changeStatus } = renderIndicator('active');

    changeStatus(null);

    expect(updates).toEqual([true, false]);
  });

  it('does not resend while timing continues', () => {
    const { updates, changeStatus } = renderIndicator('active');

    changeStatus('active');

    expect(updates).toEqual([true]);
  });
});
