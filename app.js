// ---------- Storage keys ----------
const KEYS = {
  todos: "todos",
  updatedAt: "todos-updated-at",
  token: "gh-token",
  gistId: "gist-id",
};

const GIST_DESCRIPTION = "claude-todo-app data";
const GIST_FILE = "todos.json";
const API = "https://api.github.com";

// ---------- Elements ----------
const form = document.getElementById("new-todo");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const count = document.getElementById("count");
const clearDone = document.getElementById("clear-done");
const filterButtons = document.querySelectorAll(".filters button");

const syncStatus = document.getElementById("sync-status");
const syncForm = document.getElementById("sync-form");
const tokenInput = document.getElementById("token-input");
const syncConnected = document.getElementById("sync-connected");
const syncNow = document.getElementById("sync-now");
const syncDisconnect = document.getElementById("sync-disconnect");
const gistLink = document.getElementById("gist-link");

// ---------- Safe localStorage ----------
function get(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function set(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}
function remove(key) {
  try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
}

// ---------- State ----------
let todos = loadLocal();
let updatedAt = Number(get(KEYS.updatedAt)) || 0;
let filter = "all";
let pushTimer = null;
let syncing = false;

function loadLocal() {
  try {
    return JSON.parse(get(KEYS.todos)) || [];
  } catch {
    return [];
  }
}

function saveLocal() {
  set(KEYS.todos, JSON.stringify(todos));
  set(KEYS.updatedAt, String(updatedAt));
}

// ---------- Rendering ----------
function render() {
  list.innerHTML = "";

  const visible = todos.filter(t =>
    filter === "all" ? true : filter === "done" ? t.done : !t.done
  );

  for (const todo of visible) {
    const li = document.createElement("li");
    li.className = "todo" + (todo.done ? " done" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.setAttribute("aria-label", "Mark done");
    checkbox.addEventListener("change", () => {
      todo.done = checkbox.checked;
      changed();
    });

    const text = document.createElement("span");
    text.className = "text";
    text.textContent = todo.text;

    const del = document.createElement("button");
    del.className = "delete";
    del.type = "button";
    del.textContent = "×";
    del.setAttribute("aria-label", "Delete");
    del.addEventListener("click", () => {
      todos = todos.filter(t => t.id !== todo.id);
      changed();
    });

    li.append(checkbox, text, del);
    list.append(li);
  }

  const left = todos.filter(t => !t.done).length;
  count.textContent = `${left} item${left === 1 ? "" : "s"} left`;
  clearDone.hidden = !todos.some(t => t.done);
}

// Called after every local edit.
function changed() {
  updatedAt = Date.now();
  saveLocal();
  render();
  schedulePush();
}

// ---------- Todo events ----------
form.addEventListener("submit", e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  todos.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    done: false,
  });
  input.value = "";
  changed();
});

clearDone.addEventListener("click", () => {
  todos = todos.filter(t => !t.done);
  changed();
});

filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    filterButtons.forEach(b => b.classList.toggle("active", b === btn));
    render();
  });
});

// ---------- GitHub Gist sync ----------
function token() {
  return get(KEYS.token);
}

async function gh(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token()}`,
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

function payload() {
  return JSON.stringify({ updatedAt, todos }, null, 2);
}

// Find the data gist (by saved id, or by description), or create it.
async function findOrCreateGist() {
  const saved = get(KEYS.gistId);
  if (saved) {
    try {
      return await gh(`/gists/${saved}`);
    } catch (e) {
      if (e.status !== 404) throw e;
      remove(KEYS.gistId);
    }
  }

  for (let page = 1; page <= 5; page++) {
    const gists = await gh(`/gists?per_page=100&page=${page}`);
    const match = gists.find(g => g.description === GIST_DESCRIPTION && g.files[GIST_FILE]);
    if (match) {
      set(KEYS.gistId, match.id);
      return gh(`/gists/${match.id}`);
    }
    if (gists.length < 100) break;
  }

  const created = await gh("/gists", {
    method: "POST",
    body: JSON.stringify({
      description: GIST_DESCRIPTION,
      public: false,
      files: { [GIST_FILE]: { content: payload() } },
    }),
  });
  set(KEYS.gistId, created.id);
  return created;
}

// Pull from the gist; whichever side was edited most recently wins.
async function sync() {
  if (!token() || syncing) return;
  syncing = true;
  setStatus("Syncing…");

  try {
    const gist = await findOrCreateGist();
    gistLink.href = gist.html_url;

    let remote = { updatedAt: 0, todos: [] };
    try {
      remote = JSON.parse(gist.files[GIST_FILE]?.content || "{}");
    } catch { /* bad remote data — local will overwrite it */ }

    if ((remote.updatedAt || 0) > updatedAt) {
      todos = Array.isArray(remote.todos) ? remote.todos : [];
      updatedAt = remote.updatedAt;
      saveLocal();
      render();
    } else if (updatedAt > (remote.updatedAt || 0)) {
      await push();
    }
    setStatus("Synced");
  } catch (e) {
    handleError(e);
  } finally {
    syncing = false;
  }
}

async function push() {
  const id = get(KEYS.gistId);
  if (!id) return sync();
  await gh(`/gists/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ files: { [GIST_FILE]: { content: payload() } } }),
  });
}

// Wait for a short pause in editing before pushing.
function schedulePush() {
  if (!token()) return;
  setStatus("Saving…");
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      await push();
      setStatus("Synced");
    } catch (e) {
      handleError(e);
    }
  }, 800);
}

function handleError(e) {
  if (e.status === 401) {
    setStatus("Token rejected — reconnect", true);
  } else if (e.status === 403 || e.status === 404) {
    setStatus("Token can't access gists", true);
  } else {
    setStatus("Offline — saved on this device", true);
  }
}

function setStatus(text, isError = false) {
  syncStatus.textContent = text;
  syncStatus.classList.toggle("error", isError);
}

function showSyncUI() {
  const connected = Boolean(token());
  syncForm.hidden = connected;
  syncConnected.hidden = !connected;
  if (!connected) setStatus("Not synced");
}

syncForm.addEventListener("submit", e => {
  e.preventDefault();
  const value = tokenInput.value.trim();
  if (!value) return;
  set(KEYS.token, value);
  tokenInput.value = "";
  showSyncUI();
  sync();
});

syncNow.addEventListener("click", () => sync());

syncDisconnect.addEventListener("click", () => {
  remove(KEYS.token);
  remove(KEYS.gistId);
  showSyncUI();
});

// Pick up changes from other devices when you come back to the tab.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") sync();
});
window.addEventListener("online", () => sync());

// ---------- Start ----------
render();
showSyncUI();
sync();
