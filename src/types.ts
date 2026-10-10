export interface Todo {
  id: string;
  text: string;
  done: boolean;
  /** Local date-time, as from <input type="datetime-local"> (e.g. "2026-10-10T18:00"). */
  due?: string;
  /** Set once a reminder has been shown for this todo. */
  notified?: boolean;
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
