import { KEYS, get, set, remove } from "./storage.js";

const API = "https://api.github.com";
const DESCRIPTION = "claude-todo-app data";
const FILE = "todos.json";

async function gh(token, path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    const err = new Error(`GitHub ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function toContent(data) {
  return JSON.stringify({ updatedAt: data.updatedAt, todos: data.todos }, null, 2);
}

// Find the data gist (by saved id, then by description), or create it.
export async function findOrCreateGist(token, data) {
  const saved = get(KEYS.gistId);
  if (saved) {
    try {
      return await gh(token, `/gists/${saved}`);
    } catch (e) {
      if (e.status !== 404) throw e;
      remove(KEYS.gistId);
    }
  }

  for (let page = 1; page <= 5; page++) {
    const gists = await gh(token, `/gists?per_page=100&page=${page}`);
    const match = gists.find(g => g.description === DESCRIPTION && g.files[FILE]);
    if (match) {
      set(KEYS.gistId, match.id);
      return gh(token, `/gists/${match.id}`);
    }
    if (gists.length < 100) break;
  }

  const created = await gh(token, "/gists", {
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

export function readGist(gist) {
  try {
    const parsed = JSON.parse(gist.files[FILE]?.content || "{}");
    return {
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
      updatedAt: Number(parsed.updatedAt) || 0,
    };
  } catch {
    return { todos: [], updatedAt: 0 };
  }
}

export async function pushGist(token, data) {
  const id = get(KEYS.gistId);
  if (!id) {
    await findOrCreateGist(token, data);
    return;
  }
  await gh(token, `/gists/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ files: { [FILE]: { content: toContent(data) } } }),
  });
}

export function errorMessage(e) {
  if (e.status === 401) return "Token rejected — reconnect";
  if (e.status === 403 || e.status === 404) return "Token can't access gists";
  return "Offline — saved on this device";
}
