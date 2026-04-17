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
    this.ariaExpanded = "";
    this.placeholder = "";
    this.style = {};
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
  const tagsInput = document.createElement("input");
  tagsInput.id = "tagsInput";
  tagsInput.type = "text";
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
  document.body.appendChild(tagsInput);
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
    tagsInput,
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

function getSubtaskProgressChip(taskRow) {
  return findByClassName(taskRow, "subtask-progress-chip");
}

function getTagChips(taskRow) {
  return collectByClassName(taskRow, "task-tag");
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

function getDetailsToggle(taskRow) {
  return findByClassName(taskRow, "details-toggle");
}

function getTaskDetails(taskRow) {
  return findByClassName(taskRow, "task-details");
}

function getSubtaskInput(taskRow) {
  return findByClassName(taskRow, "subtask-input");
}

function getSubtaskRows(taskRow) {
  return collectByClassName(taskRow, "subtask-item");
}

function getSubtaskText(subtaskRow) {
  return findByClassName(subtaskRow, "subtask-text");
}

function getSubtaskToggle(subtaskRow) {
  return findByClassName(subtaskRow, "subtask-toggle");
}

function getRemoveSubtaskButton(subtaskRow) {
  return findButtonByText(subtaskRow, "Remove");
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

test("adding a task with the button preserves priority, due date, and tag metadata", () => {
  const { taskInput, priorityInput, dueDateInput, tagsInput, addBtn, taskList, localStorage } = createAppHarness();

  taskInput.value = "Buy groceries";
  priorityInput.value = "high";
  dueDateInput.value = "2026-04-17";
  tagsInput.value = "Errands, Home, errands";
  addBtn.click();

  const taskRows = getTaskRows(taskList);
  assert.equal(taskRows.length, 1);
  assert.equal(getTaskText(taskRows[0]).textContent, "Buy groceries");
  assert.equal(getPriorityBadge(taskRows[0]).textContent, "High priority");
  assert.equal(getDueDateChip(taskRows[0]).textContent, "Due 2026-04-17");
  assert.deepEqual(getTagChips(taskRows[0]).map((chip) => chip.textContent), ["Errands", "Home"]);

  const savedTasks = JSON.parse(localStorage.getItem("tasks"));
  assert.equal(savedTasks.length, 1);
  assert.equal(savedTasks[0].text, "Buy groceries");
  assert.equal(savedTasks[0].completed, false);
  assert.equal(savedTasks[0].priority, "high");
  assert.equal(savedTasks[0].dueDate, "2026-04-17");
  assert.deepEqual(savedTasks[0].tags, ["Errands", "Home"]);
  assert.deepEqual(savedTasks[0].subtasks, []);
});

test("pressing Enter adds a task and whitespace-only input is ignored", () => {
  const { taskInput, tagsInput, taskList } = createAppHarness();

  taskInput.value = "   ";
  taskInput.dispatchEvent({ type: "keydown", key: "Enter" });
  assert.equal(getTaskRows(taskList).length, 0);
  assert.equal(taskList.children[0].className, "empty-state");

  taskInput.value = "Read a chapter";
  tagsInput.dispatchEvent({ type: "keydown", key: "Enter" });
  assert.equal(getTaskRows(taskList).length, 1);
  assert.equal(getTaskText(getTaskRows(taskList)[0]).textContent, "Read a chapter");
});

test("live search filters tasks by title, tags, and subtasks and clear search restores the full list", () => {
  const { taskInput, tagsInput, addBtn, searchInput, clearSearchBtn, taskList, document } = createAppHarness();

  taskInput.value = "Plan vacation";
  tagsInput.value = "Travel";
  addBtn.click();

  getDetailsToggle(getTaskRows(taskList)[0]).click();
  const subtaskInput = getSubtaskInput(getTaskRows(taskList)[0]);
  subtaskInput.value = "Book hotel";
  findButtonByText(getTaskRows(taskList)[0], "Add subtask").click();

  taskInput.value = "Pick up groceries";
  tagsInput.value = "Errands";
  addBtn.click();

  searchInput.value = "travel";
  searchInput.dispatchEvent({ type: "input" });
  assert.equal(getTaskRows(taskList).length, 1);
  assert.equal(getTaskText(getTaskRows(taskList)[0]).textContent, "Plan vacation");

  searchInput.value = "hotel";
  searchInput.dispatchEvent({ type: "input" });
  assert.equal(getTaskRows(taskList).length, 1);
  assert.equal(getTaskText(getTaskRows(taskList)[0]).textContent, "Plan vacation");

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

test("expanded checklist supports subtask progress while parent completion stays independent", () => {
  const { taskInput, addBtn, taskList, localStorage } = createAppHarness();

  taskInput.value = "Prepare launch";
  addBtn.click();

  getDetailsToggle(getTaskRows(taskList)[0]).click();
  let currentRow = getTaskRows(taskList)[0];
  let subtaskInput = getSubtaskInput(currentRow);
  subtaskInput.value = "Review analytics";
  findButtonByText(currentRow, "Add subtask").click();

  currentRow = getTaskRows(taskList)[0];
  subtaskInput = getSubtaskInput(currentRow);
  subtaskInput.value = "Queue announcement";
  subtaskInput.dispatchEvent({ type: "keydown", key: "Enter" });

  currentRow = getTaskRows(taskList)[0];
  assert.equal(getSubtaskRows(currentRow).length, 2);
  assert.equal(getSubtaskText(getSubtaskRows(currentRow)[0]).textContent, "Review analytics");
  assert.equal(getSubtaskProgressChip(currentRow).textContent, "0/2 subtasks done");

  getSubtaskToggle(getSubtaskRows(currentRow)[0]).dispatchEvent({ type: "change" });

  currentRow = getTaskRows(taskList)[0];
  assert.doesNotMatch(currentRow.className, /\bcompleted\b/);
  assert.equal(getSubtaskProgressChip(currentRow).textContent, "1/2 subtasks done");

  getDetailsToggle(currentRow).click();
  currentRow = getTaskRows(taskList)[0];
  assert.equal(getTaskDetails(currentRow), null);
  assert.equal(getSubtaskProgressChip(currentRow).textContent, "1/2 subtasks done");

  getToggle(currentRow).dispatchEvent({ type: "change" });
  currentRow = getTaskRows(taskList)[0];
  assert.match(currentRow.className, /\bcompleted\b/);

  const savedTasks = JSON.parse(localStorage.getItem("tasks"));
  assert.equal(savedTasks[0].completed, true);
  assert.deepEqual(savedTasks[0].subtasks, [
    { id: savedTasks[0].subtasks[0].id, title: "Review analytics", completed: true },
    { id: savedTasks[0].subtasks[1].id, title: "Queue announcement", completed: false }
  ]);
});

test("deterministic tag hashing gives the same tag the same color every time", () => {
  const { taskInput, tagsInput, addBtn, taskList } = createAppHarness();

  taskInput.value = "Morning review";
  tagsInput.value = "Focus";
  addBtn.click();

  taskInput.value = "Inbox zero";
  tagsInput.value = "Focus, Admin";
  addBtn.click();

  const taskRows = getTaskRows(taskList);
  const firstFocusChip = getTagChips(taskRows[0])[0];
  const secondFocusChip = getTagChips(taskRows[1])[0];
  const adminChip = getTagChips(taskRows[1])[1];

  assert.equal(firstFocusChip.style.backgroundColor, secondFocusChip.style.backgroundColor);
  assert.equal(firstFocusChip.style.borderColor, secondFocusChip.style.borderColor);
  assert.equal(firstFocusChip.style.color, secondFocusChip.style.color);
  assert.notEqual(firstFocusChip.style.backgroundColor, adminChip.style.backgroundColor);
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

test("tasks persist tags and subtasks across refreshes through localStorage", () => {
  const localStorage = createStorage();
  const firstPage = createAppHarness({ localStorage });

  firstPage.taskInput.value = "Plan weekend trip";
  firstPage.priorityInput.value = "high";
  firstPage.dueDateInput.value = "2026-04-17";
  firstPage.tagsInput.value = "Travel, Personal";
  firstPage.addBtn.click();

  getDetailsToggle(getTaskRows(firstPage.taskList)[0]).click();
  let currentRow = getTaskRows(firstPage.taskList)[0];
  let subtaskInput = getSubtaskInput(currentRow);
  subtaskInput.value = "Book train";
  findButtonByText(currentRow, "Add subtask").click();

  const secondPage = createAppHarness({ localStorage });
  const taskRows = getTaskRows(secondPage.taskList);

  assert.equal(taskRows.length, 1);
  assert.equal(getTaskText(taskRows[0]).textContent, "Plan weekend trip");
  assert.equal(getPriorityBadge(taskRows[0]).textContent, "High priority");
  assert.equal(getDueDateChip(taskRows[0]).textContent, "Due 2026-04-17");
  assert.deepEqual(getTagChips(taskRows[0]).map((chip) => chip.textContent), ["Travel", "Personal"]);
  assert.equal(getSubtaskProgressChip(taskRows[0]).textContent, "0/1 subtasks done");

  getDetailsToggle(taskRows[0]).click();
  const expandedRow = getTaskRows(secondPage.taskList)[0];
  assert.equal(getSubtaskRows(expandedRow).length, 1);
  assert.equal(getSubtaskText(getSubtaskRows(expandedRow)[0]).textContent, "Book train");
});

test("task storage stays anchored to the tasks key and normalizes legacy metadata for render, search, and save", () => {
  const { taskList, localStorage, filterDueToday, filterAll, searchInput } = createAppHarness({
    storageState: {
      tasks: JSON.stringify([
        {
          id: "alpha",
          text: "  Plan trip  ",
          completed: 0,
          priority: "high",
          dueDate: "2026-04-17",
          tags: [" travel ", "Travel", "", "planning"],
          subtasks: [
            { id: "s-1", title: " Book hotel ", completed: 1 },
            { id: "s-2", title: "   ", completed: true }
          ]
        },
        {
          id: "beta",
          text: "Inbox zero",
          completed: false,
          tags: "focus, Deep Work",
          subtasks: "not-an-array"
        },
        {
          id: "gamma",
          text: "Review budget",
          completed: false,
          priority: "high",
          dueDate: "2026-5-01",
          subtasks: [
            { title: "Check subscriptions", completed: false }
          ]
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
  assert.equal(getSubtaskProgressChip(taskRows[0]).textContent, "1/1 subtasks done");
  assert.deepEqual(getTagChips(taskRows[0]).map((chip) => chip.textContent), ["travel", "planning"]);
  assert.deepEqual(getTagChips(taskRows[1]).map((chip) => chip.textContent), ["focus", "Deep Work"]);
  assert.equal(getSubtaskProgressChip(taskRows[2]).textContent, "0/1 subtasks done");
  assert.equal(getDueDateChip(taskRows[2]), null);
  assert.equal(getTaskMeta(taskRows[1]).className, "task-meta");

  filterDueToday.click();
  assert.equal(getTaskRows(taskList).length, 1);
  assert.equal(getTaskText(getTaskRows(taskList)[0]).textContent, "Plan trip");

  filterAll.click();
  searchInput.value = "subscriptions";
  searchInput.dispatchEvent({ type: "input" });
  assert.equal(getTaskRows(taskList).length, 1);
  assert.equal(getTaskText(getTaskRows(taskList)[0]).textContent, "Review budget");

  searchInput.value = "";
  searchInput.dispatchEvent({ type: "input" });
  getToggle(getTaskRows(taskList)[0]).dispatchEvent({ type: "change" });

  assert.deepEqual(JSON.parse(localStorage.getItem("tasks")), [
    {
      id: "alpha",
      text: "Plan trip",
      completed: true,
      priority: "high",
      dueDate: "2026-04-17",
      tags: ["travel", "planning"],
      subtasks: [
        {
          id: "s-1",
          title: "Book hotel",
          completed: true
        }
      ]
    },
    {
      id: "beta",
      text: "Inbox zero",
      completed: false,
      priority: "normal",
      dueDate: "",
      tags: ["focus", "Deep Work"],
      subtasks: []
    },
    {
      id: "gamma",
      text: "Review budget",
      completed: false,
      priority: "high",
      dueDate: "",
      tags: [],
      subtasks: [
        {
          id: "gamma-subtask-0",
          title: "Check subscriptions",
          completed: false
        }
      ]
    }
  ]);
});

test("html and css expose the new tag and subtask organization scaffold", () => {
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
  assert.match(html, /id="tagsInput"/);
  assert.match(html, /class="composer-secondary"/);
  assert.match(html, /id="resultsSummary"/);

  assert.match(css, /:root\s*\{/);
  assert.match(css, /\.toolbar\s*\{/);
  assert.match(css, /\.filter-btn\.active\s*\{/);
  assert.match(css, /\.task-content\s*\{/);
  assert.match(css, /\.task-meta\s*\{/);
  assert.match(css, /\.task-badge,\s*[\r\n]+\s*\.task-chip\s*\{/);
  assert.match(css, /\.task-tag\s*\{/);
  assert.match(css, /\.subtask-progress-chip\s*\{/);
  assert.match(css, /\.task-details\s*\{/);
  assert.match(css, /\.subtask-editor\s*\{/);
  assert.match(css, /\.subtask-list\s*\{/);
  assert.match(css, /\.subtask-item\s*\{/);
  assert.match(css, /\.subtask-toggle\s*\{/);
  assert.match(css, /\.composer-secondary\s*\{/);
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
  assert.deepEqual(loggedErrors, ["Failed to save tasks from localStorage.".replace("from", "to")]);
});

test("legacy storage strips unsupported task fields while normalizing priorities and due dates", () => {
  const { taskList, localStorage } = createAppHarness({
    storageState: {
      tasks: JSON.stringify([
        {
          id: "priority-low",
          text: "Low lane",
          completed: 0,
          priority: "low",
          dueDate: null,
          createdAt: "2026-04-16T09:00:00.000Z",
          updatedAt: "2026-04-16T11:00:00.000Z",
          tags: ["Home", "home", ""],
          subtasks: []
        },
        {
          id: "priority-normal",
          text: "Normal lane",
          completed: 1,
          priority: "normal",
          dueDate: "2026-04-17",
          createdAt: 1713344400000,
          updatedAt: null,
          tags: [],
          subtasks: []
        },
        {
          id: "priority-medium",
          text: "Medium lane",
          completed: false,
          priority: "medium",
          dueDate: "2026/04/17",
          tags: ["Focus"],
          subtasks: []
        },
        {
          id: "priority-high",
          text: "High lane",
          completed: false,
          priority: "high",
          dueDate: "2026-04-18",
          title: "This title should not be persisted",
          tags: [],
          subtasks: []
        },
        {
          id: "title-only-task",
          title: "Title only task",
          completed: false,
          priority: "high"
        }
      ])
    }
  });

  const taskRows = getTaskRows(taskList);
  assert.equal(taskRows.length, 4);
  assert.equal(getTaskText(taskRows[0]).textContent, "Low lane");
  assert.equal(getPriorityBadge(taskRows[0]), null);
  assert.equal(getDueDateChip(taskRows[0]), null);
  assert.deepEqual(getTagChips(taskRows[0]).map((chip) => chip.textContent), ["Home"]);

  assert.equal(getTaskText(taskRows[1]).textContent, "Normal lane");
  assert.match(taskRows[1].className, /\bcompleted\b/);
  assert.equal(getPriorityBadge(taskRows[1]), null);
  assert.equal(getDueDateChip(taskRows[1]).textContent, "Due 2026-04-17");

  assert.equal(getTaskText(taskRows[2]).textContent, "Medium lane");
  assert.equal(getPriorityBadge(taskRows[2]), null);
  assert.equal(getDueDateChip(taskRows[2]), null);

  assert.equal(getTaskText(taskRows[3]).textContent, "High lane");
  assert.equal(getPriorityBadge(taskRows[3]).textContent, "High priority");
  assert.equal(getDueDateChip(taskRows[3]).textContent, "Due 2026-04-18");

  getToggle(taskRows[0]).dispatchEvent({ type: "change" });

  assert.deepEqual(JSON.parse(localStorage.getItem("tasks")), [
    {
      id: "priority-low",
      text: "Low lane",
      completed: true,
      priority: "normal",
      dueDate: "",
      tags: ["Home"],
      subtasks: []
    },
    {
      id: "priority-normal",
      text: "Normal lane",
      completed: true,
      priority: "normal",
      dueDate: "2026-04-17",
      tags: [],
      subtasks: []
    },
    {
      id: "priority-medium",
      text: "Medium lane",
      completed: false,
      priority: "normal",
      dueDate: "",
      tags: ["Focus"],
      subtasks: []
    },
    {
      id: "priority-high",
      text: "High lane",
      completed: false,
      priority: "high",
      dueDate: "2026-04-18",
      tags: [],
      subtasks: []
    }
  ]);
});

test("subtask add and remove flows keep empty states and progress chips in sync", () => {
  const { taskInput, addBtn, taskList, document } = createAppHarness();

  taskInput.value = "Plan conference";
  addBtn.click();

  getDetailsToggle(getTaskRows(taskList)[0]).click();
  let currentRow = getTaskRows(taskList)[0];
  assert.equal(findByClassName(getTaskDetails(currentRow), "task-details-summary").textContent, "No subtasks yet. Add a few smaller wins to keep momentum high.");
  assert.equal(findByClassName(getTaskDetails(currentRow), "subtask-empty").textContent, "No subtasks yet. Break this into smaller, clear steps.");
  assert.equal(getSubtaskProgressChip(currentRow), null);

  let subtaskInput = getSubtaskInput(currentRow);
  subtaskInput.value = "   ";
  findButtonByText(currentRow, "Add subtask").click();
  assert.equal(document.activeElement, subtaskInput);
  assert.equal(getSubtaskRows(getTaskRows(taskList)[0]).length, 0);

  subtaskInput.value = "Confirm venue";
  findButtonByText(currentRow, "Add subtask").click();

  currentRow = getTaskRows(taskList)[0];
  subtaskInput = getSubtaskInput(currentRow);
  subtaskInput.value = "Send invites";
  subtaskInput.dispatchEvent({ type: "keydown", key: "Enter" });

  currentRow = getTaskRows(taskList)[0];
  assert.equal(getSubtaskRows(currentRow).length, 2);
  assert.equal(getSubtaskProgressChip(currentRow).textContent, "0/2 subtasks done");

  getRemoveSubtaskButton(getSubtaskRows(currentRow)[0]).click();
  currentRow = getTaskRows(taskList)[0];
  assert.equal(getSubtaskRows(currentRow).length, 1);
  assert.equal(getSubtaskText(getSubtaskRows(currentRow)[0]).textContent, "Send invites");
  assert.equal(getSubtaskProgressChip(currentRow).textContent, "0/1 subtasks done");

  getRemoveSubtaskButton(getSubtaskRows(currentRow)[0]).click();
  currentRow = getTaskRows(taskList)[0];
  assert.equal(getSubtaskRows(currentRow).length, 0);
  assert.equal(getSubtaskProgressChip(currentRow), null);
  assert.equal(findByClassName(getTaskDetails(currentRow), "subtask-empty").textContent, "No subtasks yet. Break this into smaller, clear steps.");
});

test("subtask progress summaries cover partial and fully completed checklist states", () => {
  const { taskList } = createAppHarness({
    storageState: {
      tasks: JSON.stringify([
        {
          id: "launch-plan",
          text: "Ship release",
          completed: false,
          priority: "high",
          dueDate: "2026-04-17",
          tags: ["Release"],
          subtasks: [
            { id: "qa", title: "QA signoff", completed: true },
            { id: "copy", title: "Publish copy", completed: false },
            { id: "support", title: "Brief support", completed: false }
          ]
        }
      ])
    }
  });

  let currentRow = getTaskRows(taskList)[0];
  assert.equal(getSubtaskProgressChip(currentRow).textContent, "1/3 subtasks done");

  getDetailsToggle(currentRow).click();
  currentRow = getTaskRows(taskList)[0];
  assert.equal(findByClassName(getTaskDetails(currentRow), "task-details-summary").textContent, "1 of 3 subtasks completed.");

  getSubtaskToggle(getSubtaskRows(currentRow)[1]).dispatchEvent({ type: "change" });
  currentRow = getTaskRows(taskList)[0];
  assert.equal(getSubtaskProgressChip(currentRow).textContent, "2/3 subtasks done");
  assert.equal(findByClassName(getTaskDetails(currentRow), "task-details-summary").textContent, "2 of 3 subtasks completed.");

  getSubtaskToggle(getSubtaskRows(currentRow)[2]).dispatchEvent({ type: "change" });
  currentRow = getTaskRows(taskList)[0];
  assert.equal(getSubtaskProgressChip(currentRow).textContent, "3/3 subtasks done");
  assert.equal(findByClassName(getTaskDetails(currentRow), "task-details-summary").textContent, "All subtasks completed. Keep the parent task open until the final outcome is done.");
  assert.doesNotMatch(currentRow.className, /\bcompleted\b/);
});

test("search and filter controls stay case-insensitive and surface empty-state branches", () => {
  const {
    taskList,
    searchInput,
    filterActive,
    filterCompleted,
    filterHighPriority,
    filterDueToday,
    filterAll,
    resultsSummary
  } = createAppHarness({
    storageState: {
      tasks: JSON.stringify([
        {
          id: "workout",
          text: "Morning workout",
          completed: false,
          priority: "low",
          dueDate: null,
          tags: ["Health"],
          subtasks: []
        },
        {
          id: "taxes",
          text: "File taxes",
          completed: true,
          priority: "high",
          dueDate: "2026-04-17",
          tags: ["Finance"],
          subtasks: []
        },
        {
          id: "release",
          text: "Ship release",
          completed: false,
          priority: "high",
          dueDate: "2026-04-17",
          tags: ["Work"],
          subtasks: [
            { id: "release-subtask-1", title: "QA signoff", completed: false }
          ]
        }
      ])
    }
  });

  searchInput.value = "  SIGNOFF  ";
  searchInput.dispatchEvent({ type: "input" });
  assert.deepEqual(getTaskRows(taskList).map((taskRow) => getTaskText(taskRow).textContent), ["Ship release"]);

  searchInput.value = "finance";
  searchInput.dispatchEvent({ type: "input" });
  assert.deepEqual(getTaskRows(taskList).map((taskRow) => getTaskText(taskRow).textContent), ["File taxes"]);

  searchInput.value = "missing";
  searchInput.dispatchEvent({ type: "input" });
  assert.equal(getTaskRows(taskList).length, 0);
  assert.equal(taskList.children[0].className, "empty-state");
  assert.equal(taskList.children[0].textContent, "No tasks match the current search or filter.");

  searchInput.value = "";
  searchInput.dispatchEvent({ type: "input" });

  filterActive.click();
  assert.deepEqual(getTaskRows(taskList).map((taskRow) => getTaskText(taskRow).textContent), ["Morning workout", "Ship release"]);

  filterCompleted.click();
  assert.deepEqual(getTaskRows(taskList).map((taskRow) => getTaskText(taskRow).textContent), ["File taxes"]);

  filterHighPriority.click();
  assert.deepEqual(getTaskRows(taskList).map((taskRow) => getTaskText(taskRow).textContent), ["File taxes", "Ship release"]);

  filterDueToday.click();
  assert.deepEqual(getTaskRows(taskList).map((taskRow) => getTaskText(taskRow).textContent), ["File taxes", "Ship release"]);
  assert.equal(resultsSummary.textContent, "Showing 2 of 3 tasks · 1 completed");

  filterAll.click();
  assert.equal(getTaskRows(taskList).length, 3);
});
