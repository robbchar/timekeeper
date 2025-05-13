export interface Tag {
  id: number;
  name: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Database-specific types
export interface TagDatabase {
  id: number;
  name: string;
  color?: string;
}

// Type for database operations
export type TagCreate = Pick<Tag, 'name' | 'color'>;
export type TagUpdate = Partial<TagCreate>;
