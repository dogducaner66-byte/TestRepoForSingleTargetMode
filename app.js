document.addEventListener("DOMContentLoaded", () => {
  const taskInput = document.getElementById("taskInput");
  const priorityInput = document.getElementById("priorityInput");
  const dueDateInput = document.getElementById("dueDateInput");
  const addBtn = document.getElementById("addBtn");
  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const resultsSummary = document.getElementById("resultsSummary");
  const taskList = document.getElementById("taskList");
  const storageKey = "tasks";
  const filterButtons = [
    { key: "all", element: document.getElementById("filterAll") },
    { key: "active", element: document.getElementById("filterActive") },
    { key: "completed", element: document.getElementById("filterCompleted") },
    { key: "high-priority", element: document.getElementById("filterHighPriority") },
    { key: "due-today", element: document.getElementById("filterDueToday") }
  ];
  const defaultPriority = "normal";
  const dueDatePattern = /^\d{4}-\d{2}-\d{2}$/;

  let tasks = loadTasks();
  let activeFilter = "all";
  let searchQuery = "";
  let editingTaskId = null;
  let editDraft = "";

  function normalizePriority(priority) {
    return priority === "high" ? "high" : defaultPriority;
  }

  function normalizeDueDate(dueDate) {
    return typeof dueDate === "string" && dueDatePattern.test(dueDate) ? dueDate : "";
  }

  function normalizeTask(task, index) {
    if (!task || typeof task.text !== "string") {
      return null;
    }

    const text = task.text.trim();
    if (!text) {
      return null;
    }

    return {
      id: typeof task.id === "string" || typeof task.id === "number" ? task.id : `task-${index}`,
      text,
      completed: Boolean(task.completed),
      priority: normalizePriority(task.priority),
      dueDate: normalizeDueDate(task.dueDate)
    };
  }

  function normalizeTaskList(taskList) {
    if (!Array.isArray(taskList)) {
      return [];
    }

    return taskList
      .map((task, index) => normalizeTask(task, index))
      .filter(Boolean);
  }

  function loadTasks() {
    try {
      const savedTasks = localStorage.getItem(storageKey);
      if (!savedTasks) {
        return [];
      }

      const parsedTasks = JSON.parse(savedTasks);
      return normalizeTaskList(parsedTasks);
    } catch (error) {
      console.error("Failed to load tasks from localStorage.", error);
      return [];
    }
  }

  function saveTasks() {
    const normalizedTasks = normalizeTaskList(tasks);
    tasks = normalizedTasks;

    try {
      localStorage.setItem(storageKey, JSON.stringify(normalizedTasks));
    } catch (error) {
      console.error("Failed to save tasks to localStorage.", error);
    }
  }

  function getTodayKey() {
    const today = new Date(Date.now());
    const year = String(today.getFullYear());
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getTaskDueDate(task) {
    return normalizeDueDate(task && task.dueDate);
  }

  function isTaskDueToday(task) {
    return getTaskDueDate(task) === getTodayKey();
  }

  function getTaskDueDateLabel(task) {
    const dueDate = getTaskDueDate(task);
    return dueDate ? `Due ${dueDate}` : "";
  }

  function buildMetaText(task) {
    const details = [];

    if (task.priority === "high") {
      details.push("High priority");
    }

    const dueDateLabel = getTaskDueDateLabel(task);
    if (dueDateLabel) {
      details.push(dueDateLabel);
    }

    return details.join(" · ");
  }

  function resetComposer() {
    taskInput.value = "";
    priorityInput.value = defaultPriority;
    dueDateInput.value = "";
  }

  function addTask() {
    const text = taskInput.value.trim();
    if (!text) {
      taskInput.focus();
      return;
    }

    tasks.push({
      id: `${Date.now()}-${tasks.length}`,
      text,
      completed: false,
      priority: normalizePriority(priorityInput.value),
      dueDate: normalizeDueDate(dueDateInput.value)
    });

    saveTasks();
    resetComposer();
    renderTasks();
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

    if (editingTaskId === taskId) {
      editingTaskId = null;
      editDraft = "";
    }

    saveTasks();
    renderTasks();
  }

  function startEditing(taskId) {
    const task = tasks.find((currentTask) => currentTask.id === taskId);
    if (!task) {
      return;
    }

    editingTaskId = taskId;
    editDraft = task.text;
    renderTasks();
  }

  function cancelEditing() {
    editingTaskId = null;
    editDraft = "";
    renderTasks();
  }

  function saveEdit(taskId) {
    const nextText = editDraft.trim();
    if (!nextText) {
      return;
    }

    tasks = tasks.map((task) => {
      if (task.id === taskId) {
        return { ...task, text: nextText };
      }

      return task;
    });

    editingTaskId = null;
    editDraft = "";
    saveTasks();
    renderTasks();
  }

  function matchesSearch(task) {
    if (!searchQuery) {
      return true;
    }

    return task.text.toLowerCase().includes(searchQuery);
  }

  function matchesFilter(task) {
    switch (activeFilter) {
      case "active":
        return !task.completed;
      case "completed":
        return task.completed;
      case "high-priority":
        return task.priority === "high";
      case "due-today":
        return isTaskDueToday(task);
      default:
        return true;
    }
  }

  function getVisibleTasks() {
    return tasks.filter((task) => matchesSearch(task) && matchesFilter(task));
  }

  function updateToolbarState(visibleTasks) {
    clearSearchBtn.disabled = searchQuery.length === 0;

    filterButtons.forEach(({ key, element }) => {
      const isActive = key === activeFilter;
      element.className = `filter-btn${isActive ? " active" : ""}`;
      element.ariaPressed = String(isActive);
    });

    const completedCount = tasks.filter((task) => task.completed).length;
    resultsSummary.textContent = `Showing ${visibleTasks.length} of ${tasks.length} tasks · ${completedCount} completed`;
  }

  function getEmptyStateMessage() {
    if (tasks.length === 0) {
      return "No tasks yet. Add one to get started.";
    }

    return "No tasks match the current search or filter.";
  }

  function renderTasks() {
    const visibleTasks = getVisibleTasks();
    taskList.innerHTML = "";
    updateToolbarState(visibleTasks);

    if (visibleTasks.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "empty-state";
      emptyState.textContent = getEmptyStateMessage();
      taskList.appendChild(emptyState);
      return;
    }

    visibleTasks.forEach((task) => {
      const isEditing = editingTaskId === task.id;
      const taskRow = document.createElement("div");
      taskRow.className = `task-item${task.completed ? " completed" : ""}${task.priority === "high" ? " priority-high" : ""}`;

      const checkbox = document.createElement("input");
      checkbox.className = "task-toggle";
      checkbox.type = "checkbox";
      checkbox.checked = task.completed;
      checkbox.disabled = isEditing;
      checkbox.addEventListener("change", () => toggleTask(task.id));

      const taskContent = document.createElement("div");
      taskContent.className = "task-content";

      const taskActions = document.createElement("div");
      taskActions.className = "task-actions";

      if (isEditing) {
        const editInput = document.createElement("input");
        editInput.className = "edit-input";
        editInput.type = "text";
        editInput.value = editDraft;
        editInput.addEventListener("input", (event) => {
          editDraft = event.target.value;
        });
        editInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            saveEdit(task.id);
          }

          if (event.key === "Escape") {
            event.preventDefault();
            cancelEditing();
          }
        });

        const saveButton = document.createElement("button");
        saveButton.className = "secondary-btn";
        saveButton.type = "button";
        saveButton.textContent = "Save";
        saveButton.addEventListener("click", () => saveEdit(task.id));

        const cancelButton = document.createElement("button");
        cancelButton.className = "secondary-btn";
        cancelButton.type = "button";
        cancelButton.textContent = "Cancel";
        cancelButton.addEventListener("click", cancelEditing);

        taskContent.appendChild(editInput);
        taskActions.appendChild(saveButton);
        taskActions.appendChild(cancelButton);
        taskRow.appendChild(checkbox);
        taskRow.appendChild(taskContent);
        taskRow.appendChild(taskActions);
        taskList.appendChild(taskRow);
        editInput.focus();
        return;
      }

      const taskText = document.createElement("span");
      taskText.className = "task-text";
      taskText.textContent = task.text;
      taskText.addEventListener("click", () => toggleTask(task.id));

      taskContent.appendChild(taskText);

      const metaText = buildMetaText(task);
      if (metaText) {
        const taskMeta = document.createElement("span");
        taskMeta.className = "task-meta";
        taskMeta.textContent = metaText;
        taskContent.appendChild(taskMeta);
      }

      const editButton = document.createElement("button");
      editButton.className = "secondary-btn";
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => startEditing(task.id));

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-btn";
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => deleteTask(task.id));

      taskActions.appendChild(editButton);
      taskActions.appendChild(deleteButton);
      taskRow.appendChild(checkbox);
      taskRow.appendChild(taskContent);
      taskRow.appendChild(taskActions);
      taskList.appendChild(taskRow);
    });
  }

  addBtn.addEventListener("click", addTask);
  taskInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTask();
    }
  });
  priorityInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTask();
    }
  });
  dueDateInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTask();
    }
  });
  searchInput.addEventListener("input", (event) => {
    searchQuery = event.target.value.trim().toLowerCase();
    renderTasks();
  });
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    renderTasks();
    searchInput.focus();
  });
  filterButtons.forEach(({ key, element }) => {
    element.addEventListener("click", () => {
      activeFilter = key;
      renderTasks();
    });
  });

  renderTasks();
});
