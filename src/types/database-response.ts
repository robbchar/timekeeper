// Common database response types
export interface DatabaseResponse {
  lastInsertRowid?: number;
  changes?: number;
}

// Specific response types that extend the base
export type ProjectDatabaseResponse = DatabaseResponse;
export type TagDatabaseResponse = DatabaseResponse;
export type SessionDatabaseResponse = DatabaseResponse;
