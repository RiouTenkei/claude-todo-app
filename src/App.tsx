import { useEffect, useState, type FormEvent } from "react";
import { KEYS, get, set, remove, loadData, saveData } from "./storage";
import { useGistSync } from "./useGistSync";
import type { Filter, SyncStatus, Todo, TodoData } from "./types";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "done", label: "Done" },
];

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export default function App() {
  const [data, setData] = useState<TodoData>(loadData);
  const [filter, setFilter] = useState<Filter>("all");
  const [text, setText] = useState("");
  const [token, setToken] = useState<string | null>(() => get(KEYS.token));

  const { status, gistUrl, sync, schedulePush } = useGistSync({ data, setData, token });

  // Mirror every change (local or from the gist) into localStorage.
  useEffect(() => {
    saveData(data);
  }, [data]);

  // Apply a local edit, stamp the time, and queue a push to the gist.
  function edit(change: (todos: Todo[]) => Todo[]) {
    setData(prev => ({ todos: change(prev.todos), updatedAt: Date.now() }));
    schedulePush();
  }

  function addTodo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    edit(todos => [...todos, { id: newId(), text: value, done: false }]);
    setText("");
  }

  const { todos } = data;
  const visible = todos.filter(t =>
    filter === "all" ? true : filter === "done" ? t.done : !t.done
  );
  const left = todos.filter(t => !t.done).length;

  return (
    <main className="app">
      <h1>Todo</h1>

      <form className="new-todo" onSubmit={addTodo} autoComplete="off">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What needs doing?"
          aria-label="New todo"
        />
        <button type="submit">Add</button>
      </form>

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
        {visible.map(todo => (
          <li key={todo.id} className={"todo" + (todo.done ? " done" : "")}>
            <input
              type="checkbox"
              checked={todo.done}
              aria-label="Mark done"
              onChange={() =>
                edit(all => all.map(t => (t.id === todo.id ? { ...t, done: !t.done } : t)))
              }
            />
            <span className="text">{todo.text}</span>
            <button
              type="button"
              className="delete"
              aria-label="Delete"
              onClick={() => edit(all => all.filter(t => t.id !== todo.id))}
            >
              ×
            </button>
          </li>
        ))}
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
