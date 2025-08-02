import type { Tag, Action } from '@/types/state';
import { ActionType } from '@/types/state';

export const tagReducer = (state: Tag[], action: Action): Tag[] => {
  switch (action.type) {
    case ActionType.ADD_TAG:
      return [...state, action.payload as Tag];

    case ActionType.UPDATE_TAG:
      return state.map(tag =>
        tag.id === (action.payload as Tag).id ? (action.payload as Tag) : tag
      );

    case ActionType.DELETE_TAG: {
      return state.filter(tag => tag.id !== Number(action.payload));
    }
    default:
      return state;
  }
};
