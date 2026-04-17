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
  assert.match(html, /aria-controls="taskList"/);
  assert.match(html, /role="list"/);
  assert.match(html, /class="sr-only"/);

  assert.match(css, /\.sr-only\s*\{/);
  assert.match(css, /\.bulk-toolbar\s*\{/);
  assert.match(css, /\.selection-toggle\s*\{/);
  assert.match(css, /\.task-item\.selected\s*\{/);
  assert.match(css, /\.task-order-controls\s*\{/);
  assert.match(css, /\.state-banner\s*\{/);
  assert.match(css, /\.task-item:focus-visible/);
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
