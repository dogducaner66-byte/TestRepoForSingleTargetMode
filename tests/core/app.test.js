const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rootDir = path.join(__dirname, "..", "..");
const indexPath = path.join(rootDir, "index.html");
const stylePath = path.join(rootDir, "style.css");
const appPath = path.join(rootDir, "app.js");
const readmePath = path.join(rootDir, "README.md");

class Element {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.attributes = new Map();
    this.className = "";
    this.textContent = "";
    this.value = "";
    this.type = "";
    this.checked = false;
    this.disabled = false;
    this.ariaPressed = "";
    this._id = "";
  }

  get id() {
    return this._id;
  }

  set id(value) {
    this._id = value;
    if (value) {
      this.ownerDocument.elementsById.set(value, this);
    }
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  dispatchEvent(event) {
    const typedEvent = {
      type: event.type,
      key: event.key,
      target: this,
      currentTarget: this,
      preventDefault() {}
    };

    for (const handler of this.listeners.get(event.type) || []) {
      handler(typedEvent);
    }
  }

  click() {
    this.dispatchEvent({ type: "click" });
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  set innerHTML(value) {
    if (value !== "") {
      throw new Error("Test DOM only supports clearing innerHTML.");
    }

    this.children = [];
  }

  get innerHTML() {
    return "";
  }
}

class Document {
  constructor() {
    this.listeners = new Map();
    this.elementsById = new Map();
    this.activeElement = null;
    this.body = new Element("body", this);
  }

  createElement(tagName) {
    return new Element(tagName, this);
  }

  getElementById(id) {
    return this.elementsById.get(id) || null;
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  dispatchEvent(event) {
    for (const handler of this.listeners.get(event.type) || []) {
      handler({
        type: event.type,
        target: this,
        currentTarget: this,
        preventDefault() {}
      });
    }
  }
}

function createStorage(initialState = {}) {
  const state = { ...initialState };

  return {
    state,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(state, key) ? state[key] : null;
    },
    setItem(key, value) {
      state[key] = String(value);
    },
    removeItem(key) {
      delete state[key];
    }
  };
}

function findByClassName(node, className) {
  if (node.className.split(/\s+/).includes(className)) {
    return node;
  }

  for (const child of node.children) {
    const match = findByClassName(child, className);
    if (match) {
      return match;
    }
  }

  return null;
}

function collectByClassName(node, className, matches = []) {
  if (node.className.split(/\s+/).includes(className)) {
    matches.push(node);
  }

  for (const child of node.children) {
    collectByClassName(child, className, matches);
  }

  return matches;
}

function findButtonByText(node, buttonText) {
  for (const child of node.children) {
    if (child.tagName === "BUTTON" && child.textContent === buttonText) {
      return child;
    }

    const match = findButtonByText(child, buttonText);
    if (match) {
      return match;
    }
  }

  return null;
}

function createFixedDate(nowValue) {
  const RealDate = Date;

  return class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(nowValue);
        return;
      }

      super(...args);
    }

    static now() {
      return nowValue;
    }
  };
}

function createAppHarness(options = {}) {
  const document = new Document();
  const taskInput = document.createElement("input");
  taskInput.id = "taskInput";
  taskInput.type = "text";
  const priorityInput = document.createElement("select");
  priorityInput.id = "priorityInput";
  priorityInput.value = "normal";
  const dueDateInput = document.createElement("input");
  dueDateInput.id = "dueDateInput";
  dueDateInput.type = "date";
  const addBtn = document.createElement("button");
  addBtn.id = "addBtn";
  const searchInput = document.createElement("input");
  searchInput.id = "searchInput";
  searchInput.type = "search";
  const clearSearchBtn = document.createElement("button");
  clearSearchBtn.id = "clearSearchBtn";
  const resultsSummary = document.createElement("p");
  resultsSummary.id = "resultsSummary";
  const filterAll = document.createElement("button");
  filterAll.id = "filterAll";
  const filterActive = document.createElement("button");
  filterActive.id = "filterActive";
  const filterCompleted = document.createElement("button");
  filterCompleted.id = "filterCompleted";
  const filterHighPriority = document.createElement("button");
  filterHighPriority.id = "filterHighPriority";
  const filterDueToday = document.createElement("button");
  filterDueToday.id = "filterDueToday";
  const taskList = document.createElement("div");
  taskList.id = "taskList";

  document.body.appendChild(taskInput);
  document.body.appendChild(priorityInput);
  document.body.appendChild(dueDateInput);
  document.body.appendChild(addBtn);
  document.body.appendChild(searchInput);
  document.body.appendChild(clearSearchBtn);
  document.body.appendChild(resultsSummary);
  document.body.appendChild(filterAll);
  document.body.appendChild(filterActive);
  document.body.appendChild(filterCompleted);
  document.body.appendChild(filterHighPriority);
  document.body.appendChild(filterDueToday);
  document.body.appendChild(taskList);

  const localStorage = options.localStorage || createStorage(options.storageState);
  const script = fs.readFileSync(appPath, "utf8");
  const loggedErrors = [];

  vm.runInNewContext(script, {
    document,
    localStorage,
    console: {
      error(message) {
        loggedErrors.push(message);
      }
    },
    Date: createFixedDate(options.nowValue || Date.UTC(2026, 3, 17, 12, 0, 0))
  }, {
    filename: appPath
  });

  document.dispatchEvent({ type: "DOMContentLoaded" });

  return {
    document,
    taskInput,
    priorityInput,
    dueDateInput,
    addBtn,
    searchInput,
    clearSearchBtn,
    resultsSummary,
    filterAll,
    filterActive,
    filterCompleted,
    filterHighPriority,
    filterDueToday,
    taskList,
    localStorage,
    loggedErrors
  };
}

function getTaskRows(taskList) {
  return collectByClassName(taskList, "task-item");
}

function getTaskText(taskRow) {
  return findByClassName(taskRow, "task-text");
}

function getTaskMeta(taskRow) {
  return findByClassName(taskRow, "task-meta");
}

function getPriorityBadge(taskRow) {
  return findByClassName(taskRow, "priority-badge");
}

function getDueDateChip(taskRow) {
  return findByClassName(taskRow, "due-date-chip");
}

function getDeleteButton(taskRow) {
  return findButtonByText(taskRow, "Delete");
}

function getEditButton(taskRow) {
  return findButtonByText(taskRow, "Edit");
}

function getSaveButton(taskRow) {
  return findButtonByText(taskRow, "Save");
}

function getCancelButton(taskRow) {
  return findButtonByText(taskRow, "Cancel");
}

function getToggle(taskRow) {
  return findByClassName(taskRow, "task-toggle");
}

function getEditInput(taskRow) {
  return findByClassName(taskRow, "edit-input");
}

test("static delivery assets exist and stay browser-openable without a build step", () => {
  for (const filePath of [indexPath, stylePath, appPath, readmePath]) {
    fs.accessSync(filePath);
  }

  const html = fs.readFileSync(indexPath, "utf8");
  const readme = fs.readFileSync(readmePath, "utf8");

  assert.match(html, /href="style\.css"/);
  assert.match(html, /<script src="app\.js"><\/script>/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.match(readme, /open `index\.html` in any modern browser/i);
});

test("the empty state appears when there are no tasks and the toolbar starts in a safe default state", () => {
  const { taskList, clearSearchBtn, resultsSummary, filterAll, loggedErrors } = createAppHarness();

  assert.equal(taskList.children.length, 1);
  assert.equal(taskList.children[0].className, "empty-state");
  assert.equal(taskList.children[0].textContent, "No tasks yet. Add one to get started.");
  assert.equal(clearSearchBtn.disabled, true);
  assert.equal(resultsSummary.textContent, "Showing 0 of 0 tasks · 0 completed");
  assert.equal(filterAll.ariaPressed, "true");
  assert.deepEqual(loggedErrors, []);
});

test("adding a task with the button preserves priority and due date metadata", () => {
  const { taskInput, priorityInput, dueDateInput, addBtn, taskList, localStorage } = createAppHarness();

  taskInput.value = "Buy groceries";
  priorityInput.value = "high";
  dueDateInput.value = "2026-04-17";
  addBtn.click();

  const taskRows = getTaskRows(taskList);
  assert.equal(taskRows.length, 1);
  assert.equal(getTaskText(taskRows[0]).textContent, "Buy groceries");
  assert.equal(getPriorityBadge(taskRows[0]).textContent, "High priority");
  assert.equal(getDueDateChip(taskRows[0]).textContent, "Due 2026-04-17");

  const savedTasks = JSON.parse(localStorage.getItem("tasks"));
  assert.equal(savedTasks.length, 1);
  assert.equal(savedTasks[0].text, "Buy groceries");
  assert.equal(savedTasks[0].completed, false);
  assert.equal(savedTasks[0].priority, "high");
  assert.equal(savedTasks[0].dueDate, "2026-04-17");
});

test("pressing Enter adds a task and whitespace-only input is ignored", () => {
  const { taskInput, dueDateInput, taskList } = createAppHarness();

  taskInput.value = "   ";
  taskInput.dispatchEvent({ type: "keydown", key: "Enter" });
  assert.equal(getTaskRows(taskList).length, 0);
  assert.equal(taskList.children[0].className, "empty-state");

  taskInput.value = "Read a chapter";
  dueDateInput.dispatchEvent({ type: "keydown", key: "Enter" });
  assert.equal(getTaskRows(taskList).length, 1);
  assert.equal(getTaskText(getTaskRows(taskList)[0]).textContent, "Read a chapter");
});

test("live search filters tasks immediately and clear search restores the full list", () => {
  const { taskInput, addBtn, searchInput, clearSearchBtn, taskList, document } = createAppHarness();

  taskInput.value = "Plan vacation";
  addBtn.click();
  taskInput.value = "Pick up groceries";
  addBtn.click();

  searchInput.value = "gro";
  searchInput.dispatchEvent({ type: "input" });

  assert.equal(getTaskRows(taskList).length, 1);
  assert.equal(getTaskText(getTaskRows(taskList)[0]).textContent, "Pick up groceries");
  assert.equal(clearSearchBtn.disabled, false);

  clearSearchBtn.click();

  assert.equal(getTaskRows(taskList).length, 2);
  assert.equal(searchInput.value, "");
  assert.equal(document.activeElement, searchInput);
});

test("all active completed high-priority and due-today filters show the expected subset", () => {
  const { taskInput, priorityInput, dueDateInput, addBtn, taskList, filterActive, filterCompleted, filterHighPriority, filterDueToday, filterAll } = createAppHarness();

  taskInput.value = "Pay bills";
  dueDateInput.value = "2026-04-17";
  addBtn.click();

  taskInput.value = "Book dentist";
  priorityInput.value = "high";
  dueDateInput.value = "2026-04-18";
  addBtn.click();

  taskInput.value = "Archive notes";
  priorityInput.value = "normal";
  dueDateInput.value = "";
  addBtn.click();

  getToggle(getTaskRows(taskList)[2]).dispatchEvent({ type: "change" });

  filterActive.click();
  assert.equal(getTaskRows(taskList).length, 2);

  filterCompleted.click();
  assert.equal(getTaskRows(taskList).length, 1);
  assert.equal(getTaskText(getTaskRows(taskList)[0]).textContent, "Archive notes");

  filterHighPriority.click();
  assert.equal(getTaskRows(taskList).length, 1);
  assert.equal(getTaskText(getTaskRows(taskList)[0]).textContent, "Book dentist");

  filterDueToday.click();
  assert.equal(getTaskRows(taskList).length, 1);
  assert.equal(getTaskText(getTaskRows(taskList)[0]).textContent, "Pay bills");

  filterAll.click();
  assert.equal(getTaskRows(taskList).length, 3);
});

test("editing uses explicit save controls and Escape cancels without losing the original text", () => {
  const { taskInput, addBtn, taskList, document } = createAppHarness();

  taskInput.value = "Draft quarterly review";
  addBtn.click();

  const initialRow = getTaskRows(taskList)[0];
  getEditButton(initialRow).click();

  const editingRow = getTaskRows(taskList)[0];
  const editInput = getEditInput(editingRow);
  assert.equal(document.activeElement, editInput);

  editInput.value = "Draft quarterly review slides";
  editInput.dispatchEvent({ type: "input" });
  editInput.dispatchEvent({ type: "keydown", key: "Escape" });

  assert.equal(getTaskText(getTaskRows(taskList)[0]).textContent, "Draft quarterly review");

  getEditButton(getTaskRows(taskList)[0]).click();
  const secondEditInput = getEditInput(getTaskRows(taskList)[0]);
  secondEditInput.value = "Draft quarterly review slides";
  secondEditInput.dispatchEvent({ type: "input" });
  getSaveButton(getTaskRows(taskList)[0]).click();

  assert.equal(getTaskText(getTaskRows(taskList)[0]).textContent, "Draft quarterly review slides");
});

test("toggling a task updates its visual completed state and persisted value", () => {
  const { taskInput, addBtn, taskList, localStorage } = createAppHarness();

  taskInput.value = "Wash the car";
  addBtn.click();

  const taskRow = getTaskRows(taskList)[0];
  getToggle(taskRow).dispatchEvent({ type: "change" });

  const updatedRow = getTaskRows(taskList)[0];
  assert.match(updatedRow.className, /\bcompleted\b/);

  const savedTasks = JSON.parse(localStorage.getItem("tasks"));
  assert.equal(savedTasks[0].completed, true);
});

test("deleting the last task removes it and restores the empty state", () => {
  const { taskInput, addBtn, taskList } = createAppHarness();

  taskInput.value = "Pay rent";
  addBtn.click();

  getDeleteButton(getTaskRows(taskList)[0]).click();

  assert.equal(getTaskRows(taskList).length, 0);
  assert.equal(taskList.children.length, 1);
  assert.equal(taskList.children[0].className, "empty-state");
});

test("tasks persist across refreshes through localStorage", () => {
  const localStorage = createStorage();
  const firstPage = createAppHarness({ localStorage });

  firstPage.taskInput.value = "Plan weekend trip";
  firstPage.priorityInput.value = "high";
  firstPage.dueDateInput.value = "2026-04-17";
  firstPage.addBtn.click();

  const secondPage = createAppHarness({ localStorage });
  const taskRows = getTaskRows(secondPage.taskList);

  assert.equal(taskRows.length, 1);
  assert.equal(getTaskText(taskRows[0]).textContent, "Plan weekend trip");
  assert.equal(getPriorityBadge(taskRows[0]).textContent, "High priority");
  assert.equal(getDueDateChip(taskRows[0]).textContent, "Due 2026-04-17");
  assert.equal(secondPage.taskList.children[0].className, "task-item priority-high");
});

test("task storage stays anchored to the tasks key and normalizes legacy metadata for render filtering and save", () => {
  const { taskList, localStorage, filterDueToday, filterAll } = createAppHarness({
    storageState: {
      tasks: JSON.stringify([
        {
          id: "alpha",
          text: "  Plan trip  ",
          completed: 0,
          priority: "high",
          dueDate: "2026-04-17",
          tags: ["travel"]
        },
        {
          id: "beta",
          text: "Inbox zero",
          completed: false
        },
        {
          id: "gamma",
          text: "Review budget",
          completed: false,
          priority: "high",
          dueDate: "2026-5-01"
        },
        {
          id: "missing-text",
          completed: false
        }
      ])
    }
  });

  const taskRows = getTaskRows(taskList);
  assert.equal(taskRows.length, 3);
  assert.equal(getTaskText(taskRows[0]).textContent, "Plan trip");
  assert.equal(getPriorityBadge(taskRows[0]).textContent, "High priority");
  assert.equal(getDueDateChip(taskRows[0]).textContent, "Due 2026-04-17");
  assert.equal(getTaskMeta(taskRows[1]), null);
  assert.equal(getPriorityBadge(taskRows[2]).textContent, "High priority");
  assert.equal(getDueDateChip(taskRows[2]), null);

  filterDueToday.click();
  assert.equal(getTaskRows(taskList).length, 1);
  assert.equal(getTaskText(getTaskRows(taskList)[0]).textContent, "Plan trip");

  filterAll.click();

  getToggle(taskRows[0]).dispatchEvent({ type: "change" });

  assert.deepEqual(JSON.parse(localStorage.getItem("tasks")), [
    {
      id: "alpha",
      text: "Plan trip",
      completed: true,
      priority: "high",
      dueDate: "2026-04-17"
    },
    {
      id: "beta",
      text: "Inbox zero",
      completed: false,
      priority: "normal",
      dueDate: ""
    },
    {
      id: "gamma",
      text: "Review budget",
      completed: false,
      priority: "high",
      dueDate: ""
    }
  ]);
});

test("html and css expose the new control scaffold and task editing seams", () => {
  const html = fs.readFileSync(indexPath, "utf8");
  const css = fs.readFileSync(stylePath, "utf8");

  assert.match(html, /class="app-shell"/);
  assert.match(html, /class="composer-card"/);
  assert.match(html, /class="controls-card toolbar"/);
  assert.match(html, /class="task-list"/);
  assert.match(html, /id="searchInput"/);
  assert.match(html, /id="clearSearchBtn"/);
  assert.match(html, /id="filterHighPriority"/);
  assert.match(html, /id="filterDueToday"/);
  assert.match(html, /id="priorityInput"/);
  assert.match(html, /id="dueDateInput"/);
  assert.match(html, /id="resultsSummary"/);

  assert.match(css, /:root\s*\{/);
  assert.match(css, /\.toolbar\s*\{/);
  assert.match(css, /\.filter-btn\.active\s*\{/);
  assert.match(css, /\.task-content\s*\{/);
  assert.match(css, /\.task-meta\s*\{/);
  assert.match(css, /\.task-badge,\s*[\r\n]+\s*\.task-chip\s*\{/);
  assert.match(css, /\.due-date-chip\s*\{/);
  assert.match(css, /\.empty-state::before\s*\{/);
  assert.match(css, /\.edit-input\s*\{/);
  assert.match(css, /\.task-item\.priority-high::before\s*\{/);
});

test("invalid saved task data falls back to a safe empty state and logs the load error", () => {
  const { taskList, loggedErrors } = createAppHarness({
    storageState: {
      tasks: "{invalid-json"
    }
  });

  assert.equal(getTaskRows(taskList).length, 0);
  assert.equal(taskList.children[0].className, "empty-state");
  assert.equal(loggedErrors.length, 1);
  assert.equal(loggedErrors[0], "Failed to load tasks from localStorage.");
});

test("save failures are logged without blocking in-memory task updates", () => {
  const localStorage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("disk full");
    },
    removeItem() {}
  };
  const { taskInput, addBtn, taskList, loggedErrors } = createAppHarness({ localStorage });

  taskInput.value = "Write backup plan";
  addBtn.click();

  const taskRows = getTaskRows(taskList);
  assert.equal(taskRows.length, 1);
  assert.equal(getTaskText(taskRows[0]).textContent, "Write backup plan");
  assert.deepEqual(loggedErrors, ["Failed to save tasks to localStorage."]);
});
