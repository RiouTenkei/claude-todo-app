export interface Todo {
  id: string;
  text: string;
  done: boolean;
}

export interface TodoData {
  todos: Todo[];
  /** Milliseconds since epoch of the last edit. The newest copy wins when syncing. */
  updatedAt: number;
}

export interface SyncStatus {
  text: string;
  error: boolean;
}

export type Filter = "all" | "active" | "done";
