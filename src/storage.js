// localStorage wrappers that never throw (private mode, blocked storage, etc.)

export const KEYS = {
  todos: "todos",
  updatedAt: "todos-updated-at",
  token: "gh-token",
  gistId: "gist-id",
};

export function get(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function set(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
}

export function loadData() {
  let todos = [];
  try {
    todos = JSON.parse(get(KEYS.todos)) || [];
  } catch { /* corrupt data — start fresh */ }
  return { todos, updatedAt: Number(get(KEYS.updatedAt)) || 0 };
}

export function saveData({ todos, updatedAt }) {
  set(KEYS.todos, JSON.stringify(todos));
  set(KEYS.updatedAt, String(updatedAt));
}
