document.addEventListener("DOMContentLoaded", () => {
  const taskInput = document.getElementById("taskInput");
  const priorityInput = document.getElementById("priorityInput");
  const dueDateInput = document.getElementById("dueDateInput");
  const tagsInput = document.getElementById("tagsInput");
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
  const whitespacePattern = /\s+/g;

  let nextEntityId = Date.now();
  let tasks = loadTasks();
  let activeFilter = "all";
  let searchQuery = "";
  let editingTaskId = null;
  let editDraft = "";
  const expandedTaskIds = new Set();

  function createId(prefix) {
    const id = `${prefix}-${nextEntityId}`;
    nextEntityId += 1;
    return id;
  }

  function normalizeLabel(value) {
    return typeof value === "string" ? value.trim().replace(whitespacePattern, " ") : "";
  }

  function normalizePriority(priority) {
    return priority === "high" ? "high" : defaultPriority;
  }

  function normalizeDueDate(dueDate) {
    return typeof dueDate === "string" && dueDatePattern.test(dueDate) ? dueDate : "";
  }

  function normalizeTags(tags) {
    const sourceTags = Array.isArray(tags)
      ? tags
      : typeof tags === "string"
        ? tags.split(",")
        : [];
    const normalizedTags = [];
    const seenTags = new Set();

    sourceTags.forEach((tag) => {
      const normalizedTag = normalizeLabel(tag);
      if (!normalizedTag) {
        return;
      }

      const dedupeKey = normalizedTag.toLowerCase();
      if (seenTags.has(dedupeKey)) {
        return;
      }

      seenTags.add(dedupeKey);
      normalizedTags.push(normalizedTag);
    });

    return normalizedTags;
  }

  function normalizeSubtask(subtask, taskId, index) {
    if (!subtask || typeof subtask.title !== "string") {
      return null;
    }

    const title = normalizeLabel(subtask.title);
    if (!title) {
      return null;
    }

    return {
      id: typeof subtask.id === "string" || typeof subtask.id === "number"
        ? String(subtask.id)
        : `${taskId}-subtask-${index}`,
      title,
      completed: Boolean(subtask.completed)
    };
  }

  function normalizeSubtasks(subtasks, taskId) {
    if (!Array.isArray(subtasks)) {
      return [];
    }

    return subtasks
      .map((subtask, index) => normalizeSubtask(subtask, taskId, index))
      .filter(Boolean);
  }

  function normalizeTask(task, index) {
    if (!task || typeof task.text !== "string") {
      return null;
    }

    const text = normalizeLabel(task.text);
    if (!text) {
      return null;
    }

    const id = typeof task.id === "string" || typeof task.id === "number"
      ? String(task.id)
      : `task-${index}`;

    return {
      id,
      text,
      completed: Boolean(task.completed),
      priority: normalizePriority(task.priority),
      dueDate: normalizeDueDate(task.dueDate),
      tags: normalizeTags(task.tags),
      subtasks: normalizeSubtasks(task.subtasks, id)
    };
  }

  function normalizeTaskList(taskListValue) {
    if (!Array.isArray(taskListValue)) {
      return [];
    }

    return taskListValue
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

  function getSubtaskProgress(task) {
    const total = task.subtasks.length;
    const completed = task.subtasks.filter((subtask) => subtask.completed).length;

    return { total, completed };
  }

  function getSubtaskProgressLabel(task) {
    const { total, completed } = getSubtaskProgress(task);
    return `${completed}/${total} subtasks done`;
  }

  function getSubtaskSummary(task) {
    const { total, completed } = getSubtaskProgress(task);
    if (total === 0) {
      return "No subtasks yet. Add a few smaller wins to keep momentum high.";
    }

    if (completed === total) {
      return "All subtasks completed. Keep the parent task open until the final outcome is done.";
    }

    return `${completed} of ${total} subtasks completed.`;
  }

  function getTagPalette(tag) {
    let hash = 0;
    const normalizedTag = tag.toLowerCase();

    for (const character of normalizedTag) {
      hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
    }

    const hue = hash % 360;

    return {
      backgroundColor: `hsl(${hue} 95% 94%)`,
      borderColor: `hsl(${hue} 68% 80%)`,
      color: `hsl(${hue} 52% 28%)`
    };
  }

  function createTagChip(tag) {
    const tagChip = document.createElement("span");
    const palette = getTagPalette(tag);
    tagChip.className = "task-chip task-tag";
    tagChip.textContent = tag;
    tagChip.style.backgroundColor = palette.backgroundColor;
    tagChip.style.borderColor = palette.borderColor;
    tagChip.style.color = palette.color;
    return tagChip;
  }

  function createTaskMeta(task) {
    const taskMeta = document.createElement("div");
    taskMeta.className = "task-meta";

    if (task.priority === "high") {
      const priorityBadge = document.createElement("span");
      priorityBadge.className = "task-badge priority-badge";
      priorityBadge.textContent = "High priority";
      taskMeta.appendChild(priorityBadge);
    }

    const dueDateLabel = getTaskDueDateLabel(task);
    if (dueDateLabel) {
      const dueDateChip = document.createElement("span");
      dueDateChip.className = `task-chip due-date-chip${isTaskDueToday(task) ? " due-today" : ""}`;
      dueDateChip.textContent = dueDateLabel;
      taskMeta.appendChild(dueDateChip);
    }

    if (task.subtasks.length > 0) {
      const subtaskProgressChip = document.createElement("span");
      subtaskProgressChip.className = "task-chip subtask-progress-chip";
      subtaskProgressChip.textContent = getSubtaskProgressLabel(task);
      taskMeta.appendChild(subtaskProgressChip);
    }

    task.tags.forEach((tag) => {
      taskMeta.appendChild(createTagChip(tag));
    });

    return taskMeta.children.length > 0 ? taskMeta : null;
  }

  function resetComposer() {
    taskInput.value = "";
    priorityInput.value = defaultPriority;
    dueDateInput.value = "";
    tagsInput.value = "";
  }

  function addTask() {
    const text = normalizeLabel(taskInput.value);
    if (!text) {
      taskInput.focus();
      return;
    }

    tasks.push({
      id: createId("task"),
      text,
      completed: false,
      priority: normalizePriority(priorityInput.value),
      dueDate: normalizeDueDate(dueDateInput.value),
      tags: normalizeTags(tagsInput.value),
      subtasks: []
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

  function toggleSubtask(taskId, subtaskId) {
    tasks = tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }

      return {
        ...task,
        subtasks: task.subtasks.map((subtask) => {
          if (subtask.id === subtaskId) {
            return { ...subtask, completed: !subtask.completed };
          }

          return subtask;
        })
      };
    });

    saveTasks();
    renderTasks();
  }

  function addSubtask(taskId, title) {
    const normalizedTitle = normalizeLabel(title);
    if (!normalizedTitle) {
      return false;
    }

    tasks = tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }

      return {
        ...task,
        subtasks: [
          ...task.subtasks,
          {
            id: createId(`${taskId}-subtask`),
            title: normalizedTitle,
            completed: false
          }
        ]
      };
    });

    expandedTaskIds.add(taskId);
    saveTasks();
    renderTasks();
    return true;
  }

  function deleteSubtask(taskId, subtaskId) {
    tasks = tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }

      return {
        ...task,
        subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId)
      };
    });

    saveTasks();
    renderTasks();
  }

  function deleteTask(taskId) {
    tasks = tasks.filter((task) => task.id !== taskId);
    expandedTaskIds.delete(taskId);

    if (editingTaskId === taskId) {
      editingTaskId = null;
      editDraft = "";
    }

    saveTasks();
    renderTasks();
  }

  function toggleTaskDetails(taskId) {
    if (expandedTaskIds.has(taskId)) {
      expandedTaskIds.delete(taskId);
    } else {
      expandedTaskIds.add(taskId);
    }

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
    const nextText = normalizeLabel(editDraft);
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

    return [
      task.text,
      ...task.tags,
      ...task.subtasks.map((subtask) => subtask.title)
    ].some((value) => value.toLowerCase().includes(searchQuery));
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

  function createTaskDetails(task) {
    const taskDetails = document.createElement("div");
    taskDetails.className = "task-details";

    const detailsHeader = document.createElement("div");
    detailsHeader.className = "task-details-header";

    const detailsTitle = document.createElement("p");
    detailsTitle.className = "task-details-title";
    detailsTitle.textContent = "Subtasks";

    const detailsSummary = document.createElement("p");
    detailsSummary.className = "task-details-summary";
    detailsSummary.textContent = getSubtaskSummary(task);

    detailsHeader.appendChild(detailsTitle);
    detailsHeader.appendChild(detailsSummary);
    taskDetails.appendChild(detailsHeader);

    const subtaskEditor = document.createElement("div");
    subtaskEditor.className = "subtask-editor";

    const subtaskInput = document.createElement("input");
    subtaskInput.className = "subtask-input";
    subtaskInput.type = "text";
    subtaskInput.placeholder = "Add a subtask";
    subtaskInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();

        if (addSubtask(task.id, subtaskInput.value)) {
          return;
        }

        subtaskInput.focus();
      }
    });

    const addSubtaskButton = document.createElement("button");
    addSubtaskButton.className = "secondary-btn";
    addSubtaskButton.type = "button";
    addSubtaskButton.textContent = "Add subtask";
    addSubtaskButton.addEventListener("click", () => {
      if (!addSubtask(task.id, subtaskInput.value)) {
        subtaskInput.focus();
      }
    });

    subtaskEditor.appendChild(subtaskInput);
    subtaskEditor.appendChild(addSubtaskButton);
    taskDetails.appendChild(subtaskEditor);

    if (task.subtasks.length === 0) {
      const emptySubtasks = document.createElement("p");
      emptySubtasks.className = "subtask-empty";
      emptySubtasks.textContent = "No subtasks yet. Break this into smaller, clear steps.";
      taskDetails.appendChild(emptySubtasks);
      return taskDetails;
    }

    const subtaskList = document.createElement("ul");
    subtaskList.className = "subtask-list";

    task.subtasks.forEach((subtask) => {
      const subtaskItem = document.createElement("li");
      subtaskItem.className = `subtask-item${subtask.completed ? " completed" : ""}`;

      const subtaskToggle = document.createElement("input");
      subtaskToggle.className = "subtask-toggle";
      subtaskToggle.type = "checkbox";
      subtaskToggle.checked = subtask.completed;
      subtaskToggle.addEventListener("change", () => toggleSubtask(task.id, subtask.id));

      const subtaskText = document.createElement("span");
      subtaskText.className = "subtask-text";
      subtaskText.textContent = subtask.title;

      const removeSubtaskButton = document.createElement("button");
      removeSubtaskButton.className = "secondary-btn subtask-remove";
      removeSubtaskButton.type = "button";
      removeSubtaskButton.textContent = "Remove";
      removeSubtaskButton.addEventListener("click", () => deleteSubtask(task.id, subtask.id));

      subtaskItem.appendChild(subtaskToggle);
      subtaskItem.appendChild(subtaskText);
      subtaskItem.appendChild(removeSubtaskButton);
      subtaskList.appendChild(subtaskItem);
    });

    taskDetails.appendChild(subtaskList);
    return taskDetails;
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
      const isExpanded = expandedTaskIds.has(task.id);
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

      const detailsToggle = document.createElement("button");
      detailsToggle.className = "secondary-btn details-toggle";
      detailsToggle.type = "button";
      detailsToggle.textContent = isExpanded ? "Hide details" : task.subtasks.length > 0 ? "Show details" : "Add subtasks";
      detailsToggle.ariaExpanded = String(isExpanded);
      detailsToggle.addEventListener("click", () => toggleTaskDetails(task.id));

      const taskHeader = document.createElement("div");
      taskHeader.className = "task-header";
      taskHeader.appendChild(taskText);
      taskHeader.appendChild(detailsToggle);
      taskContent.appendChild(taskHeader);

      const taskMeta = createTaskMeta(task);
      if (taskMeta) {
        taskContent.appendChild(taskMeta);
      }

      if (isExpanded) {
        taskContent.appendChild(createTaskDetails(task));
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
  tagsInput.addEventListener("keydown", (event) => {
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
