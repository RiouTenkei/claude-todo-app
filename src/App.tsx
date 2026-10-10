import { useEffect, useRef, useState, type FormEvent } from "react";
import { KEYS, get, set, remove, loadData, saveData } from "./storage";
import { useGistSync } from "./useGistSync";
import {
  applyUpdate,
  notificationPermission,
  notify,
  readLaunchParams,
  requestNotifications,
  setBadge,
  useUpdateAvailable,
  type Permission,
} from "./pwa";
import type { Filter, SyncStatus, Todo, TodoData } from "./types";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "done", label: "Done" },
];

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function dueTime(todo: Todo): number | null {
  if (!todo.due) return null;
  const t = new Date(todo.due).getTime();
  return Number.isNaN(t) ? null : t;
}

function formatDue(due: string): string {
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Current time, refreshed every 30 seconds (drives overdue styling and reminders). */
function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
  return now;
}

export default function App() {
  const [data, setData] = useState<TodoData>(loadData);
  const [filter, setFilter] = useState<Filter>("all");
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [token, setToken] = useState<string | null>(() => get(KEYS.token));
  const [permission, setPermission] = useState<Permission>(notificationPermission);
  const inputRef = useRef<HTMLInputElement>(null);
  const now = useNow();
  const updateReady = useUpdateAvailable();

  const { status, gistUrl, sync, schedulePush } = useGistSync({ data, setData, token });

  // Apply a local edit, stamp the time, and queue a push to the gist.
  function edit(change: (todos: Todo[]) => Todo[]) {
    setData(prev => ({ todos: change(prev.todos), updatedAt: Date.now() }));
    schedulePush();
  }

  // Mirror every change (local or from the gist) into localStorage.
  useEffect(() => {
    saveData(data);
  }, [data]);

  // Opened from the share sheet or the "Add todo" shortcut.
  useEffect(() => {
    const { shared, focus } = readLaunchParams();
    if (shared) setText(shared);
    if (focus) inputRef.current?.focus();
  }, []);

  const { todos } = data;
  const left = todos.filter(t => !t.done).length;

  // Unfinished count on the app icon.
  useEffect(() => {
    setBadge(left);
  }, [left]);

  // Show a reminder for anything that has come due.
  useEffect(() => {
    if (permission !== "granted") return;
    const dueNow = todos.filter(t => {
      const time = dueTime(t);
      return time !== null && time <= now && !t.done && !t.notified;
    });
    if (dueNow.length === 0) return;

    for (const t of dueNow) {
      void notify(t.text, {
        body: `Due ${formatDue(t.due ?? "")}`,
        tag: t.id,
        icon: "./icon-192.png",
      });
    }
    const ids = new Set(dueNow.map(t => t.id));
    edit(all => all.map(t => (ids.has(t.id) ? { ...t, notified: true } : t)));
  }, [todos, now, permission]);

  function addTodo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const todo: Todo = { id: newId(), text: value, done: false };
    if (due) todo.due = due;
    edit(all => [...all, todo]);
    setText("");
    setDue("");
  }

  const visible = todos.filter(t =>
    filter === "all" ? true : filter === "done" ? t.done : !t.done
  );
  const hasDueDates = todos.some(t => t.due && !t.done);

  return (
    <main className="app">
      {updateReady && (
        <div className="banner" role="status">
          <span>A new version is available.</span>
          <button type="button" onClick={applyUpdate}>
            Refresh
          </button>
        </div>
      )}

      <h1>Todo</h1>

      <form className="new-todo" onSubmit={addTodo} autoComplete="off">
        <input
          ref={inputRef}
          className="new-todo-text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What needs doing?"
          aria-label="New todo"
        />
        <input
          type="datetime-local"
          className="new-todo-due"
          value={due}
          onChange={e => setDue(e.target.value)}
          aria-label="Due date (optional)"
        />
        <button type="submit">Add</button>
      </form>

      {hasDueDates && permission === "default" && (
        <button
          type="button"
          className="reminders-prompt"
          onClick={() => void requestNotifications().then(setPermission)}
        >
          🔔 Turn on reminders for due todos
        </button>
      )}
      {hasDueDates && permission === "denied" && (
        <p className="hint">Reminders are blocked. Allow notifications for this site to get them.</p>
      )}

      <div className="filters">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            className={filter === f.id ? "active" : ""}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="todo-list">
        {visible.map(todo => {
          const time = dueTime(todo);
          const overdue = time !== null && time <= now && !todo.done;
          return (
            <li key={todo.id} className={"todo" + (todo.done ? " done" : "")}>
              <input
                type="checkbox"
                checked={todo.done}
                aria-label="Mark done"
                onChange={() =>
                  edit(all => all.map(t => (t.id === todo.id ? { ...t, done: !t.done } : t)))
                }
              />
              <div className="body">
                <span className="text">{todo.text}</span>
                {todo.due && (
                  <span className={"due" + (overdue ? " overdue" : "")}>
                    {overdue ? "Overdue · " : ""}
                    {formatDue(todo.due)}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="delete"
                aria-label="Delete"
                onClick={() => edit(all => all.filter(t => t.id !== todo.id))}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="footer">
        <span>
          {left} item{left === 1 ? "" : "s"} left
        </span>
        {todos.some(t => t.done) && (
          <button
            type="button"
            className="clear-done"
            onClick={() => edit(all => all.filter(t => !t.done))}
          >
            Clear done
          </button>
        )}
      </footer>

      <SyncPanel
        token={token}
        status={status}
        gistUrl={gistUrl}
        onConnect={value => {
          set(KEYS.token, value);
          setToken(value);
        }}
        onSyncNow={() => void sync()}
        onDisconnect={() => {
          remove(KEYS.token);
          remove(KEYS.gistId);
          setToken(null);
        }}
      />

      <p className="version">Build {__BUILD_ID__}</p>
    </main>
  );
}

interface SyncPanelProps {
  token: string | null;
  status: SyncStatus;
  gistUrl: string;
  onConnect: (token: string) => void;
  onSyncNow: () => void;
  onDisconnect: () => void;
}

function SyncPanel({ token, status, gistUrl, onConnect, onSyncNow, onDisconnect }: SyncPanelProps) {
  const [value, setValue] = useState("");

  function connect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    onConnect(v);
    setValue("");
  }

  return (
    <details className="sync">
      <summary>
        <span>Sync</span>
        <span className={"sync-status" + (status.error ? " error" : "")}>{status.text}</span>
      </summary>

      {token ? (
        <div>
          <p>
            Connected. Your list is stored in a{" "}
            <a href={gistUrl} target="_blank" rel="noopener noreferrer">
              private gist
            </a>
            .
          </p>
          <div className="row">
            <button type="button" onClick={onSyncNow}>
              Sync now
            </button>
            <button type="button" className="secondary" onClick={onDisconnect}>
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <form autoComplete="off" onSubmit={connect}>
          <p>
            Sync your list across devices using a private GitHub gist.{" "}
            <a
              href="https://github.com/settings/tokens/new?scopes=gist&description=Todo%20app%20sync"
              target="_blank"
              rel="noopener noreferrer"
            >
              Create a token
            </a>{" "}
            with only the <strong>gist</strong> scope, then paste it here on each device.
          </p>
          <div className="row">
            <input
              type="password"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder="ghp_…"
              aria-label="GitHub token"
            />
            <button type="submit">Connect</button>
          </div>
        </form>
      )}
    </details>
  );
}
