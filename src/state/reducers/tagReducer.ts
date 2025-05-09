import type { Tag, Action } from '@/types/state';
import { ActionType } from '@/types/state';

export const tagReducer = (state: Tag[], action: Action): Tag[] => {
  switch (action.type) {
    case ActionType.ADD_TAG:
      return [...state, action.payload];

    case ActionType.UPDATE_TAG:
      return state.map(tag =>
        tag.id === action.payload.id ? { ...tag, ...action.payload, updatedAt: new Date() } : tag
      );

    case ActionType.DELETE_TAG:
      return state.filter(tag => tag.id !== action.payload);

    default:
      return state;
  }
};
