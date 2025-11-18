// Base "changes only" response type used for simple write operations
export interface ChangesOnlyResponse {
  changes: number;
}

// Response type for create operations that return the inserted record
export interface CreateResponse<T = unknown> extends ChangesOnlyResponse {
  itemId: number;
  record: T;
}

// Response type for update operations that return the updated record
export interface UpdateResponse<T = unknown> extends ChangesOnlyResponse {
  record: T;
}

// Response type for delete operations that return the deleted record
export interface DeleteResponse<T = unknown> extends ChangesOnlyResponse {
  deleted: T;
}
