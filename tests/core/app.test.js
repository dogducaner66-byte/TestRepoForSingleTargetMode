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

function createAppHarness(options = {}) {
  const document = new Document();
  const taskInput = document.createElement("input");
  taskInput.id = "taskInput";
  taskInput.type = "text";
  const addBtn = document.createElement("button");
  addBtn.id = "addBtn";
  const taskList = document.createElement("div");
  taskList.id = "taskList";

  document.body.appendChild(taskInput);
  document.body.appendChild(addBtn);
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
    Date: {
      now: () => 1700000000000
    }
  }, {
    filename: appPath
  });

  document.dispatchEvent({ type: "DOMContentLoaded" });

  return {
    document,
    taskInput,
    addBtn,
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

function getDeleteButton(taskRow) {
  return findByClassName(taskRow, "delete-btn");
}

function getToggle(taskRow) {
  return findByClassName(taskRow, "task-toggle");
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

test("the empty state appears when there are no tasks", () => {
  const { taskList, loggedErrors } = createAppHarness();

  assert.equal(taskList.children.length, 1);
  assert.equal(taskList.children[0].className, "empty-state");
  assert.equal(taskList.children[0].textContent, "No tasks yet. Add one to get started.");
  assert.deepEqual(loggedErrors, []);
});

test("adding a task with the button updates the list and persists to localStorage", () => {
  const { taskInput, addBtn, taskList, localStorage } = createAppHarness();

  taskInput.value = "Buy groceries";
  addBtn.click();

  const taskRows = getTaskRows(taskList);
  assert.equal(taskRows.length, 1);
  assert.equal(getTaskText(taskRows[0]).textContent, "Buy groceries");

  const savedTasks = JSON.parse(localStorage.getItem("tasks"));
  assert.equal(savedTasks.length, 1);
  assert.equal(savedTasks[0].text, "Buy groceries");
  assert.equal(savedTasks[0].completed, false);
});

test("pressing Enter adds a task and whitespace-only input is ignored", () => {
  const { taskInput, taskList } = createAppHarness();

  taskInput.value = "   ";
  taskInput.dispatchEvent({ type: "keydown", key: "Enter" });
  assert.equal(getTaskRows(taskList).length, 0);
  assert.equal(taskList.children[0].className, "empty-state");

  taskInput.value = "Read a chapter";
  taskInput.dispatchEvent({ type: "keydown", key: "Enter" });
  assert.equal(getTaskRows(taskList).length, 1);
  assert.equal(getTaskText(getTaskRows(taskList)[0]).textContent, "Read a chapter");
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
  firstPage.addBtn.click();

  const secondPage = createAppHarness({ localStorage });
  const taskRows = getTaskRows(secondPage.taskList);

  assert.equal(taskRows.length, 1);
  assert.equal(getTaskText(taskRows[0]).textContent, "Plan weekend trip");
  assert.equal(secondPage.taskList.children[0].className, "task-item");
});

test("task storage stays anchored to the tasks key and normalizes records to id text and completed", () => {
  const { taskList, localStorage } = createAppHarness({
    storageState: {
      tasks: JSON.stringify([
        {
          id: "alpha",
          text: "  Plan trip  ",
          completed: 0,
          priority: "high",
          dueDate: "2026-05-01",
          tags: ["travel"]
        },
        {
          id: "missing-text",
          completed: false
        }
      ])
    }
  });

  const taskRows = getTaskRows(taskList);
  assert.equal(taskRows.length, 1);
  assert.equal(getTaskText(taskRows[0]).textContent, "Plan trip");

  getToggle(taskRows[0]).dispatchEvent({ type: "change" });

  assert.deepEqual(JSON.parse(localStorage.getItem("tasks")), [
    {
      id: "alpha",
      text: "Plan trip",
      completed: true
    }
  ]);
});

test("html and css keep the current class-based render seams for future task metadata", () => {
  const html = fs.readFileSync(indexPath, "utf8");
  const css = fs.readFileSync(stylePath, "utf8");

  assert.match(html, /class="container"/);
  assert.match(html, /class="input-row"/);
  assert.match(html, /id="taskList"/);

  assert.match(css, /\.input-row\s*\{/);
  assert.match(css, /\.task-item\s*\{/);
  assert.match(css, /\.task-text\s*\{/);
  assert.match(css, /\.completed \.task-text\s*\{/);
  assert.match(css, /@media \(max-width: 520px\)/);
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
