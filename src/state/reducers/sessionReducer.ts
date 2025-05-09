import type { Session, Action } from '@/types/state';
import { ActionType } from '@/types/state';

export const sessionReducer = (state: Session[], action: Action): Session[] => {
  switch (action.type) {
    case ActionType.START_SESSION:
      return [...state, action.payload];

    case ActionType.STOP_SESSION:
      return state.map(session =>
        session.id === action.payload.id
          ? { ...session, endTime: new Date(), updatedAt: new Date() }
          : session
      );

    case ActionType.UPDATE_SESSION:
      return state.map(session =>
        session.id === action.payload.id
          ? { ...session, ...action.payload, updatedAt: new Date() }
          : session
      );

    case ActionType.DELETE_SESSION:
      return state.filter(session => session.id !== action.payload);

    default:
      return state;
  }
}; 