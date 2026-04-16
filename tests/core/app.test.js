const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..", "..");
const indexPath = path.join(rootDir, "index.html");
const stylePath = path.join(rootDir, "style.css");
const appPath = path.join(rootDir, "app.js");
const readmePath = path.join(rootDir, "README.md");

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("index.html uses only relative asset references and exposes required elements", () => {
  const html = readFile(indexPath);

  assert.match(html, /href="style\.css"/);
  assert.match(html, /<script src="app\.js"><\/script>/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /cdn/i);
  assert.match(html, /<input[^>]*type="text"[^>]*id="taskInput"/);
  assert.match(html, /<button[^>]*id="addBtn"/);
  assert.match(html, /<div[^>]*id="taskList"/);
});

test("style.css includes the required layout and task states", () => {
  const css = readFile(stylePath);

  assert.match(css, /body\s*\{/);
  assert.match(css, /\.container\s*\{[\s\S]*max-width:\s*600px;/);
  assert.match(css, /\.input-row\s*\{[\s\S]*display:\s*flex;/);
  assert.match(css, /\.task-item:hover\s*\{/);
  assert.match(css, /\.completed \.task-text\s*\{[\s\S]*color:\s*#999;/);
  assert.match(css, /\.completed \.task-text\s*\{[\s\S]*line-through/);
  assert.match(css, /\.delete-btn\s*\{[\s\S]*margin-left:\s*auto;/);
});

test("app.js persists tasks and includes required task operations", () => {
  const app = readFile(appPath);

  assert.match(app, /document\.addEventListener\("DOMContentLoaded"/);
  assert.match(app, /localStorage\.getItem\(storageKey\)/);
  assert.match(app, /localStorage\.setItem\(storageKey,/);
  assert.match(app, /function addTask\(\)/);
  assert.match(app, /function toggleTask\(taskId\)/);
  assert.match(app, /function deleteTask\(taskId\)/);
  assert.match(app, /function renderTasks\(\)/);
  assert.match(app, /event\.key === "Enter"/);
});

test("README explains browser usage and localStorage persistence", () => {
  const readme = readFile(readmePath);

  assert.match(readme, /personal todo app/i);
  assert.match(readme, /index\.html/);
  assert.match(readme, /localStorage/);
});
