import { ActionType } from './state';

export interface Tag {
  id: number;
  name: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Database-specific types (shape of rows in the `tags` table)
export interface TagDatabase {
  tagId: number;
  name: string;
  color?: string;
}

// Type for database operations
export type TagCreate = Pick<Tag, 'name' | 'color'>;
export type TagUpdate = Partial<TagCreate>;

// Tag action types
export interface AddTagAction {
  type: ActionType.ADD_TAG;
  payload: Tag;
}

export interface UpdateTagAction {
  type: ActionType.UPDATE_TAG;
  payload: Tag;
}

export interface DeleteTagAction {
  type: ActionType.DELETE_TAG;
  payload: string;
}

export type TagAction = AddTagAction | UpdateTagAction | DeleteTagAction;
