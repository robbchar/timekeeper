// Base response type for database operations
export interface DatabaseResponse<T = unknown> {
  itemId?: number;
  changes: number;
  record?: T;
}

// Response type for create operations
export type CreateResponse<T = unknown> = DatabaseResponse<T>;

// Response type for update operations
export type UpdateResponse<T = unknown> = DatabaseResponse<T>;

// Response type for delete operations
export interface DeleteResponse<T = unknown> extends DatabaseResponse {
  deleted?: T;
}

// Specific response types that extend the base
export type ProjectDatabaseResponse<T = unknown> = DatabaseResponse<T>;
export type TagDatabaseResponse<T = unknown> = DatabaseResponse<T>;
export type SessionDatabaseResponse<T = unknown> = DatabaseResponse<T>;
