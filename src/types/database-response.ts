// Base response type for database operations
export interface DatabaseResponse {
  changes: number;
}

// Response type for create operations
export interface CreateResponse extends DatabaseResponse {
  itemId: number; // More descriptive than lastInsertRowid
}

// Response type for update operations
export type UpdateResponse = DatabaseResponse;

// Response type for delete operations
export type DeleteResponse = DatabaseResponse;

// Specific response types that extend the base
export type ProjectDatabaseResponse = DatabaseResponse;
export type TagDatabaseResponse = DatabaseResponse;
export type SessionDatabaseResponse = DatabaseResponse;
