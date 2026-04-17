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
    this.className = "";
    this.textContent = "";
    this.value = "";
    this.type = "";
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.role = "";
    this.ariaLabel = "";
    this.ariaPressed = "";
    this.ariaExpanded = "";
    this.ariaControls = "";
    this.ariaAtomic = "";
    this.ariaLive = "";
    this.ariaDescribedBy = "";
    this.placeholder = "";
    this.style = {};
    this.tabIndex = 0;
    this.taskId = "";
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
      altKey: Boolean(event.altKey),
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
  const priorityInput = document.createElement("select");
  priorityInput.id = "priorityInput";
  priorityInput.value = "normal";
  const dueDateInput = document.createElement("input");
  dueDateInput.id = "dueDateInput";
  const tagsInput = document.createElement("input");
  tagsInput.id = "tagsInput";
  const addBtn = document.createElement("button");
  addBtn.id = "addBtn";
  const searchInput = document.createElement("input");
  searchInput.id = "searchInput";
  const clearSearchBtn = document.createElement("button");
  clearSearchBtn.id = "clearSearchBtn";
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
  const bulkToolbar = document.createElement("div");
  bulkToolbar.id = "bulkToolbar";
  const selectionSummary = document.createElement("p");
  selectionSummary.id = "selectionSummary";
  const toggleSelectAllBtn = document.createElement("button");
  toggleSelectAllBtn.id = "toggleSelectAllBtn";
  const clearSelectionBtn = document.createElement("button");
  clearSelectionBtn.id = "clearSelectionBtn";
  const bulkCompleteBtn = document.createElement("button");
  bulkCompleteBtn.id = "bulkCompleteBtn";
  const bulkDeleteBtn = document.createElement("button");
  bulkDeleteBtn.id = "bulkDeleteBtn";
  const stateBanner = document.createElement("p");
  stateBanner.id = "stateBanner";
  const resultsSummary = document.createElement("p");
  resultsSummary.id = "resultsSummary";
  const statusLiveRegion = document.createElement("div");
  statusLiveRegion.id = "statusLiveRegion";
  const alertLiveRegion = document.createElement("div");
  alertLiveRegion.id = "alertLiveRegion";
  const taskList = document.createElement("div");
  taskList.id = "taskList";

  [
    taskInput,
    priorityInput,
    dueDateInput,
    tagsInput,
    addBtn,
    searchInput,
    clearSearchBtn,
    filterAll,
    filterActive,
    filterCompleted,
    filterHighPriority,
    filterDueToday,
    bulkToolbar,
    selectionSummary,
    toggleSelectAllBtn,
    clearSelectionBtn,
    bulkCompleteBtn,
    bulkDeleteBtn,
    stateBanner,
    resultsSummary,
    statusLiveRegion,
    alertLiveRegion,
    taskList
  ].forEach((element) => document.body.appendChild(element));

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
    filterAll,
    filterActive,
    filterCompleted,
    filterHighPriority,
    filterDueToday,
    bulkToolbar,
    selectionSummary,
    toggleSelectAllBtn,
    clearSelectionBtn,
    bulkCompleteBtn,
    bulkDeleteBtn,
    stateBanner,
    resultsSummary,
    statusLiveRegion,
    alertLiveRegion,
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

function getSelectionToggle(taskRow) {
  return findByClassName(taskRow, "selection-toggle");
}

function getToggle(taskRow) {
  return findByClassName(taskRow, "task-toggle");
}

function getEditButton(taskRow) {
  return findButtonByText(taskRow, "Edit");
}

function getSaveButton(taskRow) {
  return findButtonByText(taskRow, "Save");
}

function getDetailsToggle(taskRow) {
  return findByClassName(taskRow, "details-toggle");
}

function getEditInput(taskRow) {
  return findByClassName(taskRow, "edit-input");
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

function getMoveUpButton(taskRow) {
  return findByClassName(taskRow, "move-up-btn");
}

function getMoveDownButton(taskRow) {
  return findByClassName(taskRow, "move-down-btn");
}

function getDeleteButton(taskRow) {
  return findButtonByText(taskRow, "Delete");
}

function getCancelButton(taskRow) {
  return findButtonByText(taskRow, "Cancel");
}

function getAddSubtaskButton(taskRow) {
  return findByClassName(taskRow, "add-subtask-btn");
}

function getDetailsSummary(taskRow) {
  return findByClassName(taskRow, "task-details-summary");
}

function getEmptyState(taskList) {
  return taskList.children[0];
}

function addTaskWith(harness, options) {
  const {
    taskInput,
    priorityInput,
    dueDateInput,
    tagsInput,
    addBtn
  } = harness;
  const {
    text,
    priority = "normal",
    dueDate = "",
    tags = "",
    submitWith = "click"
  } = options;

  taskInput.value = text;
  priorityInput.value = priority;
  dueDateInput.value = dueDate;
  tagsInput.value = tags;

  if (submitWith === "enter") {
    tagsInput.dispatchEvent({ type: "keydown", key: "Enter" });
    return;
  }

  addBtn.click();
}

function getTaskLabels(taskList) {
  return getTaskRows(taskList).map((taskRow) => getTaskText(taskRow).textContent);
}

function toggleTaskComplete(taskRow) {
  getToggle(taskRow).dispatchEvent({ type: "change" });
}

function toggleTaskSelection(taskRow) {
  getSelectionToggle(taskRow).dispatchEvent({ type: "change" });
}

function toggleSubtaskComplete(subtaskRow) {
  getSubtaskToggle(subtaskRow).dispatchEvent({ type: "change" });
}

test("static delivery assets exist and semantic accessibility scaffolding is present", () => {
  for (const filePath of [indexPath, stylePath, appPath, readmePath]) {
    fs.accessSync(filePath);
  }

  const html = fs.readFileSync(indexPath, "utf8");
  const css = fs.readFileSync(stylePath, "utf8");

  assert.match(html, /id="bulkToolbar"/);
  assert.match(html, /id="selectionSummary"/);
  assert.match(html, /id="statusLiveRegion"/);
  assert.match(html, /id="alertLiveRegion"/);
  assert.match(html, /id="keyboardHelp"/);
  assert.match(html, /id="powerUserHint"/);
  assert.match(html, /aria-controls="taskList"/);
  assert.match(html, /role="list"/);
  assert.match(html, /class="sr-only"/);

  assert.match(css, /\.sr-only\s*\{/);
  assert.match(css, /\.bulk-toolbar\s*\{/);
  assert.match(css, /\.power-user-hint\s*\{/);
  assert.match(css, /\.selection-toggle\s*\{/);
  assert.match(css, /\.task-item\.selected\s*\{/);
  assert.match(css, /\.task-order-controls\s*\{/);
  assert.match(css, /\.state-banner\s*\{/);
  assert.match(css, /\.task-item:focus-visible/);
});

test("the README documents setup, core features, and keyboard-friendly usage guidance", () => {
  const readme = fs.readFileSync(readmePath, "utf8");

  assert.match(readme, /# Personal Todo App/);
  assert.match(readme, /npm install/);
  assert.match(readme, /npm test/);
  assert.match(readme, /Bulk selection/);
  assert.match(readme, /Alt` \+ `Arrow Up` or `Arrow Down`/);
});

test("the empty state keeps search and bulk controls in a safe default state", () => {
  const {
    taskList,
    clearSearchBtn,
    toggleSelectAllBtn,
    clearSelectionBtn,
    bulkCompleteBtn,
    bulkDeleteBtn,
    selectionSummary,
    resultsSummary,
    filterAll,
    loggedErrors
  } = createAppHarness();

  assert.equal(taskList.children.length, 1);
  assert.match(taskList.children[0].className, /\bempty-state\b/);
  assert.equal(findByClassName(taskList.children[0], "empty-state-title").textContent, "No tasks yet");
  assert.equal(findByClassName(taskList.children[0], "empty-state-body").textContent, "Add one to get started.");
  assert.equal(clearSearchBtn.disabled, true);
  assert.equal(toggleSelectAllBtn.disabled, true);
  assert.equal(clearSelectionBtn.disabled, true);
  assert.equal(bulkCompleteBtn.disabled, true);
  assert.equal(bulkDeleteBtn.disabled, true);
  assert.equal(selectionSummary.textContent, "No tasks selected");
  assert.equal(resultsSummary.textContent, "Showing 0 of 0 tasks · 0 completed · 0 visible selected");
  assert.equal(filterAll.ariaPressed, "true");
  assert.deepEqual(loggedErrors, []);
});

test("adding a task from the keyboard preserves metadata and restores focus to the composer", () => {
  const {
    taskInput,
    priorityInput,
    dueDateInput,
    tagsInput,
    taskList,
    document,
    localStorage,
    statusLiveRegion
  } = createAppHarness();

  taskInput.value = "Buy groceries";
  priorityInput.value = "high";
  dueDateInput.value = "2026-04-17";
  tagsInput.value = "Errands, Home, errands";
  tagsInput.dispatchEvent({ type: "keydown", key: "Enter" });

  const taskRows = getTaskRows(taskList);
  assert.equal(taskRows.length, 1);
  assert.equal(getTaskText(taskRows[0]).textContent, "Buy groceries");
  assert.equal(getPriorityBadge(taskRows[0]).textContent, "High priority");
  assert.equal(getDueDateChip(taskRows[0]).textContent, "Due 2026-04-17");
  assert.deepEqual(getTagChips(taskRows[0]).map((chip) => chip.textContent), ["Errands", "Home"]);
  assert.equal(document.activeElement, taskInput);
  assert.equal(statusLiveRegion.textContent, "Added task Buy groceries.");

  const savedTasks = JSON.parse(localStorage.getItem("tasks"));
  assert.deepEqual(savedTasks, [
    {
      id: savedTasks[0].id,
      text: "Buy groceries",
      completed: false,
      priority: "high",
      dueDate: "2026-04-17",
      tags: ["Errands", "Home"],
      subtasks: []
    }
  ]);
});

test("select-all, bulk complete, and bulk delete work together and announce changes", () => {
  const {
    taskInput,
    addBtn,
    taskList,
    toggleSelectAllBtn,
    bulkCompleteBtn,
    bulkDeleteBtn,
    selectionSummary,
    alertLiveRegion,
    localStorage
  } = createAppHarness();

  ["Plan sprint", "Inbox zero", "Call the bank"].forEach((label) => {
    taskInput.value = label;
    addBtn.click();
  });

  toggleSelectAllBtn.click();
  assert.equal(selectionSummary.textContent, "3 tasks selected");
  assert.equal(getTaskRows(taskList).every((taskRow) => getSelectionToggle(taskRow).checked), true);

  bulkCompleteBtn.click();
  assert.equal(getTaskRows(taskList).every((taskRow) => getToggle(taskRow).checked), true);
  assert.equal(JSON.parse(localStorage.getItem("tasks")).every((task) => task.completed), true);

  bulkDeleteBtn.click();
  assert.equal(getTaskRows(taskList).length, 0);
  assert.equal(findByClassName(taskList.children[0], "empty-state-title").textContent, "No tasks yet");
  assert.equal(alertLiveRegion.textContent, "Deleted 3 selected tasks.");
});

test("pointer and keyboard reorder controls update the persisted task order", () => {
  const localStorage = createStorage();
  const firstPage = createAppHarness({ localStorage });

  ["Alpha", "Bravo", "Charlie"].forEach((label) => {
    firstPage.taskInput.value = label;
    firstPage.addBtn.click();
  });

  let taskRows = getTaskRows(firstPage.taskList);
  getMoveUpButton(taskRows[2]).click();
  taskRows = getTaskRows(firstPage.taskList);
  assert.deepEqual(taskRows.map((taskRow) => getTaskText(taskRow).textContent), ["Alpha", "Charlie", "Bravo"]);

  taskRows[1].focus();
  taskRows[1].dispatchEvent({ type: "keydown", key: "ArrowUp", altKey: true });
  taskRows = getTaskRows(firstPage.taskList);
  assert.deepEqual(taskRows.map((taskRow) => getTaskText(taskRow).textContent), ["Charlie", "Alpha", "Bravo"]);

  const secondPage = createAppHarness({ localStorage });
  assert.deepEqual(
    getTaskRows(secondPage.taskList).map((taskRow) => getTaskText(taskRow).textContent),
    ["Charlie", "Alpha", "Bravo"]
  );
});

test("editing honors Enter and Escape and restores focus to the edit button", () => {
  const { taskInput, addBtn, taskList, document, statusLiveRegion } = createAppHarness();

  taskInput.value = "Draft quarterly review";
  addBtn.click();

  getEditButton(getTaskRows(taskList)[0]).click();
  let currentRow = getTaskRows(taskList)[0];
  let editInput = getEditInput(currentRow);
  assert.equal(document.activeElement, editInput);

  editInput.value = "Draft quarterly review slides";
  editInput.dispatchEvent({ type: "input" });
  editInput.dispatchEvent({ type: "keydown", key: "Escape" });
  currentRow = getTaskRows(taskList)[0];
  assert.equal(getTaskText(currentRow).textContent, "Draft quarterly review");
  assert.equal(document.activeElement, getEditButton(currentRow));

  getEditButton(currentRow).click();
  currentRow = getTaskRows(taskList)[0];
  editInput = getEditInput(currentRow);
  editInput.value = "Draft quarterly review slides";
  editInput.dispatchEvent({ type: "input" });
  editInput.dispatchEvent({ type: "keydown", key: "Enter" });
  currentRow = getTaskRows(taskList)[0];
  assert.equal(getTaskText(currentRow).textContent, "Draft quarterly review slides");
  assert.equal(document.activeElement, getEditButton(currentRow));
  assert.equal(statusLiveRegion.textContent, "Saved task Draft quarterly review slides.");
});

test("subtask flows support Enter and Escape with safe focus restoration", () => {
  const { taskInput, addBtn, taskList, document, statusLiveRegion } = createAppHarness();

  taskInput.value = "Prepare launch";
  addBtn.click();

  let currentRow = getTaskRows(taskList)[0];
  getDetailsToggle(currentRow).click();
  currentRow = getTaskRows(taskList)[0];
  let subtaskInput = getSubtaskInput(currentRow);
  assert.equal(document.activeElement, subtaskInput);

  subtaskInput.value = "Review analytics";
  subtaskInput.dispatchEvent({ type: "keydown", key: "Enter" });
  currentRow = getTaskRows(taskList)[0];
  assert.equal(getSubtaskRows(currentRow).length, 1);
  assert.equal(getSubtaskText(getSubtaskRows(currentRow)[0]).textContent, "Review analytics");
  assert.equal(getSubtaskProgressChip(currentRow).textContent, "0/1 subtasks done");

  subtaskInput = getSubtaskInput(currentRow);
  subtaskInput.value = "Queue announcement";
  subtaskInput.dispatchEvent({ type: "keydown", key: "Escape" });
  assert.equal(document.activeElement, subtaskInput);
  assert.equal(subtaskInput.value, "");
  assert.equal(statusLiveRegion.textContent, "Cleared the new subtask draft for Prepare launch.");

  subtaskInput.dispatchEvent({ type: "keydown", key: "Escape" });
  currentRow = getTaskRows(taskList)[0];
  assert.equal(getTaskDetails(currentRow), null);
  assert.equal(document.activeElement, getDetailsToggle(currentRow));
});

test("search Escape clears live filtering and keeps focus in the search field", () => {
  const { taskInput, addBtn, searchInput, taskList, document } = createAppHarness();

  ["Plan vacation", "Pick up groceries"].forEach((label) => {
    taskInput.value = label;
    addBtn.click();
  });

  searchInput.value = "vacation";
  searchInput.dispatchEvent({ type: "input" });
  assert.deepEqual(getTaskRows(taskList).map((taskRow) => getTaskText(taskRow).textContent), ["Plan vacation"]);

  searchInput.dispatchEvent({ type: "keydown", key: "Escape" });
  assert.equal(searchInput.value, "");
  assert.equal(document.activeElement, searchInput);
  assert.deepEqual(getTaskRows(taskList).map((taskRow) => getTaskText(taskRow).textContent), ["Plan vacation", "Pick up groceries"]);
});

test("semantic labels and keyboard bulk escape support are exposed on interactive controls", () => {
  const { taskInput, addBtn, taskList, toggleSelectAllBtn, bulkToolbar, document } = createAppHarness();

  taskInput.value = "Refine roadmap";
  addBtn.click();

  const taskRow = getTaskRows(taskList)[0];
  const selectionToggle = getSelectionToggle(taskRow);
  const completionToggle = getToggle(taskRow);
  const detailsToggle = getDetailsToggle(taskRow);

  assert.equal(taskRow.role, "listitem");
  assert.equal(selectionToggle.ariaLabel, "Select task Refine roadmap");
  assert.equal(completionToggle.ariaLabel, "Complete task Refine roadmap");
  assert.equal(detailsToggle.ariaControls, `${taskRow.taskId}-details`);
  assert.equal(getMoveUpButton(taskRow).disabled, true);

  toggleSelectAllBtn.click();
  bulkToolbar.dispatchEvent({ type: "keydown", key: "Escape" });
  assert.equal(selectionToggle.checked, false);
  assert.equal(document.activeElement, toggleSelectAllBtn);
});

test("invalid saved task data falls back to a safe empty state and logs the load error", () => {
  const { taskList, loggedErrors } = createAppHarness({
    storageState: {
      tasks: "{invalid-json"
    }
  });

  assert.equal(getTaskRows(taskList).length, 0);
  assert.equal(findByClassName(taskList.children[0], "empty-state-title").textContent, "No tasks yet");
  assert.deepEqual(loggedErrors, ["Failed to load tasks from localStorage."]);
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

test("adding a blank task announces validation feedback and keeps focus on the task input", () => {
  const { addBtn, taskInput, taskList, alertLiveRegion, document } = createAppHarness();

  taskInput.focus();
  taskInput.value = "   ";
  addBtn.click();

  assert.equal(getTaskRows(taskList).length, 0);
  assert.equal(getEmptyState(taskList).className, "empty-state state-empty");
  assert.equal(alertLiveRegion.textContent, "Task description is required before adding a task.");
  assert.equal(document.activeElement, taskInput);
});

test("clear search button clears the live query and restores focus to the search input", () => {
  const harness = createAppHarness();
  const { searchInput, clearSearchBtn, taskList, document, statusLiveRegion } = harness;

  addTaskWith(harness, { text: "Plan vacation" });
  addTaskWith(harness, { text: "Pick up groceries" });

  searchInput.value = "vacation";
  searchInput.dispatchEvent({ type: "input" });
  assert.deepEqual(getTaskLabels(taskList), ["Plan vacation"]);

  clearSearchBtn.click();

  assert.equal(searchInput.value, "");
  assert.equal(document.activeElement, searchInput);
  assert.equal(statusLiveRegion.textContent, "Cleared search.");
  assert.deepEqual(getTaskLabels(taskList), ["Plan vacation", "Pick up groceries"]);
});

test("active filter keeps only incomplete tasks visible and updates pressed state", () => {
  const harness = createAppHarness();
  const { filterActive, filterAll, taskList } = harness;

  addTaskWith(harness, { text: "Prepare deck" });
  addTaskWith(harness, { text: "Send recap" });
  toggleTaskComplete(getTaskRows(taskList)[0]);

  filterActive.click();

  assert.deepEqual(getTaskLabels(taskList), ["Send recap"]);
  assert.equal(filterActive.ariaPressed, "true");
  assert.equal(filterAll.ariaPressed, "false");
});

test("completed filter keeps only completed tasks visible", () => {
  const harness = createAppHarness();
  const { filterCompleted, taskList } = harness;

  addTaskWith(harness, { text: "Ship release notes" });
  addTaskWith(harness, { text: "Plan retro" });
  toggleTaskComplete(getTaskRows(taskList)[0]);

  filterCompleted.click();

  assert.deepEqual(getTaskLabels(taskList), ["Ship release notes"]);
});

test("high priority filter keeps only high priority tasks visible", () => {
  const harness = createAppHarness();
  const { filterHighPriority, taskList } = harness;

  addTaskWith(harness, { text: "Normal follow-up" });
  addTaskWith(harness, { text: "Escalate blocker", priority: "high" });

  filterHighPriority.click();

  assert.deepEqual(getTaskLabels(taskList), ["Escalate blocker"]);
  assert.equal(getPriorityBadge(getTaskRows(taskList)[0]).textContent, "High priority");
});

test("due today filter keeps only tasks due on the fixed current date visible", () => {
  const harness = createAppHarness();
  const { filterDueToday, taskList } = harness;

  addTaskWith(harness, { text: "Today item", dueDate: "2026-04-17" });
  addTaskWith(harness, { text: "Later item", dueDate: "2026-04-18" });

  filterDueToday.click();

  const visibleRow = getTaskRows(taskList)[0];
  assert.deepEqual(getTaskLabels(taskList), ["Today item"]);
  assert.match(getDueDateChip(visibleRow).className, /\bdue-today\b/);
});

test("search matches task tags in addition to task text", () => {
  const harness = createAppHarness();
  const { searchInput, taskList } = harness;

  addTaskWith(harness, { text: "Stretch break", tags: "Wellness, Habits" });
  addTaskWith(harness, { text: "Read release notes", tags: "Work" });

  searchInput.value = "wellness";
  searchInput.dispatchEvent({ type: "input" });

  assert.deepEqual(getTaskLabels(taskList), ["Stretch break"]);
});

test("search matches subtask text when task titles do not match the query", () => {
  const harness = createAppHarness();
  const { searchInput, taskList } = harness;

  addTaskWith(harness, { text: "Prepare launch" });
  getDetailsToggle(getTaskRows(taskList)[0]).click();
  let currentRow = getTaskRows(taskList)[0];
  let subtaskInput = getSubtaskInput(currentRow);
  subtaskInput.value = "Draft agenda";
  subtaskInput.dispatchEvent({ type: "keydown", key: "Enter" });

  searchInput.value = "agenda";
  searchInput.dispatchEvent({ type: "input" });

  assert.deepEqual(getTaskLabels(taskList), ["Prepare launch"]);
});

test("search misses render the dedicated no-results empty state", () => {
  const harness = createAppHarness();
  const { searchInput, taskList } = harness;

  addTaskWith(harness, { text: "Prepare launch" });
  searchInput.value = "not-here";
  searchInput.dispatchEvent({ type: "input" });

  const emptyState = getEmptyState(taskList);
  assert.equal(getTaskRows(taskList).length, 0);
  assert.equal(findByClassName(emptyState, "empty-state-title").textContent, "No matching tasks");
  assert.equal(findByClassName(emptyState, "empty-state-body").textContent, "Adjust the search or filters to bring tasks back into view.");
  assert.match(emptyState.className, /\bstate-no-results\b/);
});

test("all-done banner appears in the default view when every task is complete", () => {
  const harness = createAppHarness();
  const { stateBanner, taskList } = harness;

  addTaskWith(harness, { text: "Close billing loop" });
  toggleTaskComplete(getTaskRows(taskList)[0]);

  assert.equal(stateBanner.hidden, false);
  assert.equal(
    stateBanner.textContent,
    "All tasks are complete. Review what shipped or add the next priority when you're ready."
  );
});

test("all-done empty state appears when the active filter hides only-complete work", () => {
  const harness = createAppHarness();
  const { filterActive, taskList } = harness;

  addTaskWith(harness, { text: "Archive planning notes" });
  toggleTaskComplete(getTaskRows(taskList)[0]);
  filterActive.click();

  const emptyState = getEmptyState(taskList);
  assert.equal(findByClassName(emptyState, "empty-state-title").textContent, "All tasks complete");
  assert.equal(findByClassName(emptyState, "empty-state-body").textContent, "Enjoy the win, or add the next priority when inspiration strikes.");
  assert.match(emptyState.className, /\bstate-all-done\b/);
});

test("selecting a single task updates summary text, row aria label, and selection toggle copy", () => {
  const harness = createAppHarness();
  const { selectionSummary, statusLiveRegion, taskList } = harness;

  addTaskWith(harness, { text: "Read book" });
  toggleTaskSelection(getTaskRows(taskList)[0]);

  const currentRow = getTaskRows(taskList)[0];
  assert.equal(selectionSummary.textContent, "1 task selected");
  assert.equal(currentRow.ariaLabel, "Read book, active, selected");
  assert.equal(getSelectionToggle(currentRow).ariaLabel, "Deselect task Read book");
  assert.equal(statusLiveRegion.textContent, "Selected Read book.");
});

test("select all visible applies only to the current filtered result set", () => {
  const harness = createAppHarness();
  const { searchInput, toggleSelectAllBtn, taskList, resultsSummary } = harness;

  addTaskWith(harness, { text: "Alpha review" });
  addTaskWith(harness, { text: "Beta review" });
  searchInput.value = "alpha";
  searchInput.dispatchEvent({ type: "input" });

  toggleSelectAllBtn.click();
  searchInput.value = "";
  searchInput.dispatchEvent({ type: "input" });

  const taskRows = getTaskRows(taskList);
  assert.equal(getSelectionToggle(taskRows[0]).checked, true);
  assert.equal(getSelectionToggle(taskRows[1]).checked, false);
  assert.equal(resultsSummary.textContent, "Showing 2 of 2 tasks · 0 completed · 1 visible selected");
});

test("a second select-all click deselects only the currently visible tasks", () => {
  const harness = createAppHarness();
  const { searchInput, toggleSelectAllBtn, taskList, selectionSummary, statusLiveRegion } = harness;

  addTaskWith(harness, { text: "Alpha review" });
  addTaskWith(harness, { text: "Beta review" });
  toggleTaskSelection(getTaskRows(taskList)[1]);

  searchInput.value = "alpha";
  searchInput.dispatchEvent({ type: "input" });
  toggleSelectAllBtn.click();
  toggleSelectAllBtn.click();

  searchInput.value = "";
  searchInput.dispatchEvent({ type: "input" });

  const taskRows = getTaskRows(taskList);
  assert.equal(getSelectionToggle(taskRows[0]).checked, false);
  assert.equal(getSelectionToggle(taskRows[1]).checked, true);
  assert.equal(selectionSummary.textContent, "1 task selected");
  assert.equal(statusLiveRegion.textContent, "Deselected 1 visible task.");
});

test("clear selection button clears all selected tasks and restores focus to select all", () => {
  const harness = createAppHarness();
  const { toggleSelectAllBtn, clearSelectionBtn, selectionSummary, taskList, document, statusLiveRegion } = harness;

  addTaskWith(harness, { text: "Alpha" });
  addTaskWith(harness, { text: "Beta" });
  toggleSelectAllBtn.click();
  clearSelectionBtn.click();

  assert.equal(getTaskRows(taskList).every((taskRow) => getSelectionToggle(taskRow).checked === false), true);
  assert.equal(selectionSummary.textContent, "No tasks selected");
  assert.equal(statusLiveRegion.textContent, "Cleared selected tasks.");
  assert.equal(document.activeElement, toggleSelectAllBtn);
});

test("bulk complete only counts incomplete selected tasks and focuses the bulk complete button", () => {
  const harness = createAppHarness();
  const { bulkCompleteBtn, taskList, statusLiveRegion, document } = harness;

  addTaskWith(harness, { text: "Already done" });
  addTaskWith(harness, { text: "Needs action" });
  toggleTaskComplete(getTaskRows(taskList)[0]);
  let taskRows = getTaskRows(taskList);
  toggleTaskSelection(taskRows[0]);
  taskRows = getTaskRows(taskList);
  toggleTaskSelection(taskRows[1]);
  bulkCompleteBtn.click();

  taskRows = getTaskRows(taskList);
  assert.equal(taskRows.every((taskRow) => getToggle(taskRow).checked), true);
  assert.equal(statusLiveRegion.textContent, "Marked 1 selected task complete.");
  assert.equal(document.activeElement, bulkCompleteBtn);
});

test("bulk delete removes only selected tasks and keeps remaining items available", () => {
  const harness = createAppHarness();
  const { bulkDeleteBtn, taskList, alertLiveRegion, document, toggleSelectAllBtn } = harness;

  addTaskWith(harness, { text: "Alpha" });
  addTaskWith(harness, { text: "Beta" });
  addTaskWith(harness, { text: "Gamma" });
  toggleTaskSelection(getTaskRows(taskList)[1]);
  bulkDeleteBtn.click();

  assert.deepEqual(getTaskLabels(taskList), ["Alpha", "Gamma"]);
  assert.equal(alertLiveRegion.textContent, "Deleted 1 selected task.");
  assert.equal(document.activeElement, toggleSelectAllBtn);
});

test("opening details with no subtasks shows the empty guidance and focuses the subtask input", () => {
  const harness = createAppHarness();
  const { taskList, document, statusLiveRegion } = harness;

  addTaskWith(harness, { text: "Prepare kickoff" });
  getDetailsToggle(getTaskRows(taskList)[0]).click();

  const currentRow = getTaskRows(taskList)[0];
  assert.equal(findByClassName(currentRow, "subtask-empty").textContent, "No subtasks yet. Break this into smaller, clear steps.");
  assert.equal(statusLiveRegion.textContent, "Opened details for Prepare kickoff.");
  assert.equal(document.activeElement, getSubtaskInput(currentRow));
});

test("pressing Escape on an expanded task row closes details and restores focus to the details toggle", () => {
  const harness = createAppHarness();
  const { taskList, document, statusLiveRegion } = harness;

  addTaskWith(harness, { text: "Prepare kickoff" });
  getDetailsToggle(getTaskRows(taskList)[0]).click();
  let currentRow = getTaskRows(taskList)[0];
  currentRow.focus();
  currentRow.dispatchEvent({ type: "keydown", key: "Escape" });

  currentRow = getTaskRows(taskList)[0];
  assert.equal(getTaskDetails(currentRow), null);
  assert.equal(statusLiveRegion.textContent, "Closed details for Prepare kickoff.");
  assert.equal(document.activeElement, getDetailsToggle(currentRow));
});

test("blank subtask submissions announce validation feedback and keep focus in the details editor", () => {
  const harness = createAppHarness();
  const { taskList, alertLiveRegion, document } = harness;

  addTaskWith(harness, { text: "Prepare kickoff" });
  getDetailsToggle(getTaskRows(taskList)[0]).click();
  const currentRow = getTaskRows(taskList)[0];
  const subtaskInput = getSubtaskInput(currentRow);
  subtaskInput.value = "   ";
  getAddSubtaskButton(currentRow).click();

  assert.equal(alertLiveRegion.textContent, "Subtask title is required before adding it.");
  assert.equal(document.activeElement, subtaskInput);
});

test("subtask completion and removal update progress, summary copy, and fallback guidance", () => {
  const harness = createAppHarness();
  const { taskList, statusLiveRegion, alertLiveRegion } = harness;

  addTaskWith(harness, { text: "Prepare launch" });
  getDetailsToggle(getTaskRows(taskList)[0]).click();
  let currentRow = getTaskRows(taskList)[0];
  let subtaskInput = getSubtaskInput(currentRow);
  subtaskInput.value = "Draft agenda";
  subtaskInput.dispatchEvent({ type: "keydown", key: "Enter" });
  currentRow = getTaskRows(taskList)[0];
  subtaskInput = getSubtaskInput(currentRow);
  subtaskInput.value = "Review deck";
  subtaskInput.dispatchEvent({ type: "keydown", key: "Enter" });

  currentRow = getTaskRows(taskList)[0];
  toggleSubtaskComplete(getSubtaskRows(currentRow)[0]);
  currentRow = getTaskRows(taskList)[0];
  assert.equal(getSubtaskProgressChip(currentRow).textContent, "1/2 subtasks done");
  assert.equal(getDetailsSummary(currentRow).textContent, "1 of 2 subtasks completed.");
  assert.equal(statusLiveRegion.textContent, "Completed subtask Draft agenda for Prepare launch.");

  getRemoveSubtaskButton(getSubtaskRows(currentRow)[0]).click();
  currentRow = getTaskRows(taskList)[0];
  getRemoveSubtaskButton(getSubtaskRows(currentRow)[0]).click();
  currentRow = getTaskRows(taskList)[0];
  assert.equal(findByClassName(currentRow, "subtask-empty").textContent, "No subtasks yet. Break this into smaller, clear steps.");
  assert.equal(alertLiveRegion.textContent, "Removed subtask Review deck from Prepare launch.");
});

test("cancel button exits editing and restores focus to the edit action", () => {
  const harness = createAppHarness();
  const { taskList, document, statusLiveRegion } = harness;

  addTaskWith(harness, { text: "Draft review" });
  getEditButton(getTaskRows(taskList)[0]).click();
  let currentRow = getTaskRows(taskList)[0];
  getCancelButton(currentRow).click();

  currentRow = getTaskRows(taskList)[0];
  assert.equal(getTaskText(currentRow).textContent, "Draft review");
  assert.equal(statusLiveRegion.textContent, "Canceled editing for Draft review.");
  assert.equal(document.activeElement, getEditButton(currentRow));
});

test("saving a blank edit announces an alert and keeps focus in the edit input", () => {
  const harness = createAppHarness();
  const { taskList, alertLiveRegion, document } = harness;

  addTaskWith(harness, { text: "Draft review" });
  getEditButton(getTaskRows(taskList)[0]).click();
  let currentRow = getTaskRows(taskList)[0];
  let editInput = getEditInput(currentRow);
  editInput.value = "   ";
  editInput.dispatchEvent({ type: "input" });
  getSaveButton(currentRow).click();

  currentRow = getTaskRows(taskList)[0];
  editInput = getEditInput(currentRow);
  assert.equal(alertLiveRegion.textContent, "Edited task text cannot be empty.");
  assert.equal(document.activeElement, editInput);
});

test("editing mode disables the completion checkbox for the active task row", () => {
  const harness = createAppHarness();
  const { taskList } = harness;

  addTaskWith(harness, { text: "Draft review" });
  getEditButton(getTaskRows(taskList)[0]).click();

  assert.equal(getToggle(getTaskRows(taskList)[0]).disabled, true);
});

test("move controls disable boundary directions for the first and last tasks", () => {
  const harness = createAppHarness();
  const { taskList } = harness;

  addTaskWith(harness, { text: "Alpha" });
  addTaskWith(harness, { text: "Beta" });

  const taskRows = getTaskRows(taskList);
  assert.equal(getMoveUpButton(taskRows[0]).disabled, true);
  assert.equal(getMoveDownButton(taskRows[1]).disabled, true);
});

test("move down button reorders tasks, announces the change, and keeps focus on the moved row", () => {
  const harness = createAppHarness();
  const { taskList, statusLiveRegion, document } = harness;

  addTaskWith(harness, { text: "Alpha" });
  addTaskWith(harness, { text: "Beta" });
  const movedRowId = getTaskRows(taskList)[0].taskId;
  getMoveDownButton(getTaskRows(taskList)[0]).click();

  assert.deepEqual(getTaskLabels(taskList), ["Beta", "Alpha"]);
  assert.equal(statusLiveRegion.textContent, "Moved Alpha down.");
  assert.equal(document.activeElement.taskId, movedRowId);
});

test("loading malformed persisted tasks normalizes ids, text, tags, and subtasks safely", () => {
  const { taskList } = createAppHarness({
    storageState: {
      tasks: JSON.stringify([
        {
          id: 5,
          text: "  Keep   calm  ",
          completed: 1,
          priority: "urgent",
          dueDate: "17-04-2026",
          tags: " Focus , focus , ",
          subtasks: [
            { id: 9, title: "  Step one  ", completed: 1 },
            { title: "   " }
          ]
        },
        { text: "   " },
        { note: "ignore-me" }
      ])
    }
  });

  const taskRow = getTaskRows(taskList)[0];
  assert.equal(getTaskRows(taskList).length, 1);
  assert.equal(taskRow.taskId, "5");
  assert.equal(taskRow.ariaLabel, "Keep calm, completed");
  assert.equal(getTaskText(taskRow).textContent, "Keep calm");
  assert.equal(getPriorityBadge(taskRow), null);
  assert.equal(getDueDateChip(taskRow), null);
  assert.deepEqual(getTagChips(taskRow).map((chip) => chip.textContent), ["Focus"]);
  assert.equal(getSubtaskProgressChip(taskRow).textContent, "1/1 subtasks done");
});

test("toggling completion updates the row aria label and completion announcement", () => {
  const harness = createAppHarness();
  const { taskList, statusLiveRegion } = harness;

  addTaskWith(harness, { text: "Prepare notes" });
  toggleTaskComplete(getTaskRows(taskList)[0]);

  let currentRow = getTaskRows(taskList)[0];
  assert.equal(currentRow.ariaLabel, "Prepare notes, completed");
  assert.equal(statusLiveRegion.textContent, "Completed Prepare notes.");

  toggleTaskComplete(currentRow);
  currentRow = getTaskRows(taskList)[0];
  assert.equal(currentRow.ariaLabel, "Prepare notes, active");
  assert.equal(statusLiveRegion.textContent, "Reopened Prepare notes.");
});
