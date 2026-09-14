import { appReducer } from './appReducer';
import { sessionReducer } from './sessionReducer';
import { initialState } from '@/state/initialState';
import { ActionType } from '@/types/state';
import type { Session, SessionAction } from '@/types/session';

const session: Session = {
  sessionId: 3,
  projectId: 1,
  startTime: new Date('2026-08-13T09:00:00.000Z'),
  duration: 120,
  status: 'active',
};

/**
 * appReducer dispatches to the slice reducers from an explicit case list, so a
 * session action that is not listed falls through to `default` and is silently
 * dropped. That is exactly how RESTORE_SESSION shipped inert. Rather than
 * testing one action, assert the routing contract for every session action:
 * whatever the slice reducer would produce is what appReducer must return.
 */
const sessionActions: SessionAction[] = [
  { type: ActionType.CREATE_SESSION, payload: { sessionId: 1, projectId: 1 } },
  { type: ActionType.RESTORE_SESSION, payload: session },
  { type: ActionType.END_SESSION, payload: { sessionId: 1, duration: 60 } },
  { type: ActionType.PAUSE_SESSION },
  { type: ActionType.RESUME_SESSION },
  { type: ActionType.UPDATE_SESSION_NOTES, payload: { sessionId: 1, notes: 'note' } },
  { type: ActionType.UPDATE_SESSION_DURATION, payload: { sessionId: 1, duration: 90 } },
  { type: ActionType.DELETE_SESSION, payload: { sessionId: 1 } },
  { type: ActionType.SET_SESSIONS, payload: [session] },
];

describe('appReducer session routing', () => {
  // CREATE_SESSION stamps startTime from the clock; pin it so both reducer calls agree.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(sessionActions.map(action => [action.type, action] as const))(
    'routes %s to the session reducer',
    (_type, action) => {
      const routed = appReducer(initialState, action);

      expect(routed.sessions).toEqual(sessionReducer(initialState.sessions, action));
    }
  );

  it('adopts a restored session as the current one', () => {
    const restored = appReducer(initialState, {
      type: ActionType.RESTORE_SESSION,
      payload: session,
    });

    expect(restored.sessions.currentSession).toEqual(session);
    expect(restored.sessions.restoredSessionId).toBe(session.sessionId);
  });

  it('leaves other slices untouched when handling a session action', () => {
    const restored = appReducer(initialState, {
      type: ActionType.RESTORE_SESSION,
      payload: session,
    });

    expect(restored.projects).toBe(initialState.projects);
    expect(restored.tags).toBe(initialState.tags);
    expect(restored.ui).toBe(initialState.ui);
  });
});
