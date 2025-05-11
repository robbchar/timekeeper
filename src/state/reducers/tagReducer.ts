import { Tag, Action, ActionType } from '@/types/state';

export const tagReducer = (state: Tag[] = [], action: Action): Tag[] => {
  switch (action.type) {
    case ActionType.ADD_TAG: {
      if (
        !action.payload ||
        typeof action.payload === 'string' ||
        typeof action.payload === 'boolean'
      ) {
        return state;
      }
      return [...state, action.payload as Tag];
    }

    case ActionType.UPDATE_TAG: {
      if (
        !action.payload ||
        typeof action.payload === 'string' ||
        typeof action.payload === 'boolean'
      ) {
        return state;
      }
      const updatedTag = action.payload as Partial<Tag>;
      if (!updatedTag.id) return state;
      return state.map(tag =>
        tag.id === updatedTag.id ? { ...tag, ...updatedTag, updatedAt: new Date() } : tag
      );
    }

    case ActionType.DELETE_TAG: {
      if (typeof action.payload !== 'string') return state;
      return state.filter(tag => tag.id !== action.payload);
    }

    default:
      return state;
  }
};
