import type { Todo, TodoData } from "./types";

// localStorage wrappers that never throw (private mode, blocked storage, etc.)

export const KEYS = {
  todos: "todos",
  updatedAt: "todos-updated-at",
  token: "gh-token",
  gistId: "gist-id",
} as const;

export function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function set(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export function loadData(): TodoData {
  let todos: Todo[] = [];
  try {
    const parsed: unknown = JSON.parse(get(KEYS.todos) ?? "[]");
    if (Array.isArray(parsed)) todos = parsed as Todo[];
  } catch {
    /* corrupt data — start fresh */
  }
  return { todos, updatedAt: Number(get(KEYS.updatedAt)) || 0 };
}

export function saveData({ todos, updatedAt }: TodoData): void {
  set(KEYS.todos, JSON.stringify(todos));
  set(KEYS.updatedAt, String(updatedAt));
}
