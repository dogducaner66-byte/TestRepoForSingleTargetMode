document.addEventListener("DOMContentLoaded", () => {
  const taskInput = document.getElementById("taskInput");
  const addBtn = document.getElementById("addBtn");
  const taskList = document.getElementById("taskList");
  const storageKey = "tasks";

  let tasks = loadTasks();

  function loadTasks() {
    try {
      const savedTasks = localStorage.getItem(storageKey);
      if (!savedTasks) {
        return [];
      }

      const parsedTasks = JSON.parse(savedTasks);
      return Array.isArray(parsedTasks) ? parsedTasks : [];
    } catch (error) {
      console.error("Failed to load tasks from localStorage.", error);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(tasks));
    } catch (error) {
      console.error("Failed to save tasks to localStorage.", error);
    }
  }

  function addTask() {
    const text = taskInput.value.trim();
    if (!text) {
      taskInput.focus();
      return;
    }

    tasks.push({
      id: Date.now(),
      text,
      completed: false
    });
    saveTasks();
    renderTasks();
    taskInput.value = "";
    taskInput.focus();
  }

  function toggleTask(taskId) {
    tasks = tasks.map((task) => {
      if (task.id === taskId) {
        return { ...task, completed: !task.completed };
      }

      return task;
    });
    saveTasks();
    renderTasks();
  }

  function deleteTask(taskId) {
    tasks = tasks.filter((task) => task.id !== taskId);
    saveTasks();
    renderTasks();
  }

  function renderTasks() {
    taskList.innerHTML = "";

    if (tasks.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "empty-state";
      emptyState.textContent = "No tasks yet. Add one to get started.";
      taskList.appendChild(emptyState);
      return;
    }

    tasks.forEach((task) => {
      const taskRow = document.createElement("div");
      taskRow.className = `task-item${task.completed ? " completed" : ""}`;

      const checkbox = document.createElement("input");
      checkbox.className = "task-toggle";
      checkbox.type = "checkbox";
      checkbox.checked = task.completed;
      checkbox.addEventListener("change", () => toggleTask(task.id));

      const taskText = document.createElement("span");
      taskText.className = "task-text";
      taskText.textContent = task.text;

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-btn";
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => deleteTask(task.id));

      taskRow.appendChild(checkbox);
      taskRow.appendChild(taskText);
      taskRow.appendChild(deleteButton);
      taskList.appendChild(taskRow);
    });
  }

  addBtn.addEventListener("click", addTask);
  taskInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      addTask();
    }
  });

  renderTasks();
});
