import { KEYS, get, set, remove } from "./storage";
import type { Todo, TodoData } from "./types";

const API = "https://api.github.com";
const DESCRIPTION = "claude-todo-app data";
const FILE = "todos.json";

export interface Gist {
  id: string;
  html_url: string;
  description: string | null;
  files: Record<string, { content?: string } | undefined>;
}

export class GitHubError extends Error {
  status: number;

  constructor(status: number) {
    super(`GitHub ${status}`);
    this.status = status;
  }
}

async function gh<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
  };
  if (options.body) headers["Content-Type"] = "application/json";

  const res = await fetch(API + path, { ...options, headers });
  if (!res.ok) throw new GitHubError(res.status);
  return (await res.json()) as T;
}

function toContent(data: TodoData): string {
  return JSON.stringify({ updatedAt: data.updatedAt, todos: data.todos }, null, 2);
}

/** Find the data gist (by saved id, then by description), or create it. */
export async function findOrCreateGist(token: string, data: TodoData): Promise<Gist> {
  const saved = get(KEYS.gistId);
  if (saved) {
    try {
      return await gh<Gist>(token, `/gists/${saved}`);
    } catch (e) {
      if (!(e instanceof GitHubError) || e.status !== 404) throw e;
      remove(KEYS.gistId);
    }
  }

  for (let page = 1; page <= 5; page++) {
    const gists = await gh<Gist[]>(token, `/gists?per_page=100&page=${page}`);
    const match = gists.find(g => g.description === DESCRIPTION && g.files[FILE]);
    if (match) {
      set(KEYS.gistId, match.id);
      // The list endpoint omits file contents, so fetch the full gist.
      return gh<Gist>(token, `/gists/${match.id}`);
    }
    if (gists.length < 100) break;
  }

  const created = await gh<Gist>(token, "/gists", {
    method: "POST",
    body: JSON.stringify({
      description: DESCRIPTION,
      public: false,
      files: { [FILE]: { content: toContent(data) } },
    }),
  });
  set(KEYS.gistId, created.id);
  return created;
}

export function readGist(gist: Gist): TodoData {
  try {
    const parsed = JSON.parse(gist.files[FILE]?.content ?? "{}") as Partial<TodoData>;
    return {
      todos: Array.isArray(parsed.todos) ? (parsed.todos as Todo[]) : [],
      updatedAt: Number(parsed.updatedAt) || 0,
    };
  } catch {
    return { todos: [], updatedAt: 0 };
  }
}

export async function pushGist(token: string, data: TodoData): Promise<void> {
  const id = get(KEYS.gistId);
  if (!id) {
    await findOrCreateGist(token, data);
    return;
  }
  await gh<Gist>(token, `/gists/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ files: { [FILE]: { content: toContent(data) } } }),
  });
}

export function errorMessage(e: unknown): string {
  if (e instanceof GitHubError) {
    if (e.status === 401) return "Token rejected — reconnect";
    if (e.status === 403 || e.status === 404) return "Token can't access gists";
  }
  return "Offline — saved on this device";
}
