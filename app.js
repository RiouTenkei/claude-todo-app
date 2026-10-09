const STORAGE_KEY = "todos";

const form = document.getElementById("new-todo");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const count = document.getElementById("count");
const clearDone = document.getElementById("clear-done");
const filterButtons = document.querySelectorAll(".filters button");

let todos = load();
let filter = "all";

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // Storage unavailable (e.g. private mode) – app still works for this visit.
  }
}

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
      update();
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
      update();
    });

    li.append(checkbox, text, del);
    list.append(li);
  }

  const left = todos.filter(t => !t.done).length;
  count.textContent = `${left} item${left === 1 ? "" : "s"} left`;
  clearDone.hidden = !todos.some(t => t.done);
}

function update() {
  save();
  render();
}

form.addEventListener("submit", e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  todos.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, done: false });
  input.value = "";
  update();
});

clearDone.addEventListener("click", () => {
  todos = todos.filter(t => !t.done);
  update();
});

filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    filterButtons.forEach(b => b.classList.toggle("active", b === btn));
    render();
  });
});

render();
