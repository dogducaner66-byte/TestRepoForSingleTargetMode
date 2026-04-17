document.addEventListener("DOMContentLoaded", () => {
  const taskInput = document.getElementById("taskInput");
  const priorityInput = document.getElementById("priorityInput");
  const dueDateInput = document.getElementById("dueDateInput");
  const tagsInput = document.getElementById("tagsInput");
  const addBtn = document.getElementById("addBtn");
  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const toggleSelectAllBtn = document.getElementById("toggleSelectAllBtn");
  const clearSelectionBtn = document.getElementById("clearSelectionBtn");
  const bulkCompleteBtn = document.getElementById("bulkCompleteBtn");
  const bulkDeleteBtn = document.getElementById("bulkDeleteBtn");
  const selectionSummary = document.getElementById("selectionSummary");
  const stateBanner = document.getElementById("stateBanner");
  const resultsSummary = document.getElementById("resultsSummary");
  const taskList = document.getElementById("taskList");
  const statusLiveRegion = document.getElementById("statusLiveRegion");
  const alertLiveRegion = document.getElementById("alertLiveRegion");
  const bulkToolbar = document.getElementById("bulkToolbar");
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
  let pendingFocus = null;
  const expandedTaskIds = new Set();
  const selectedTaskIds = new Set();

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

      return normalizeTaskList(JSON.parse(savedTasks));
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

  function hasClassName(node, className) {
    return typeof node.className === "string" && node.className.split(/\s+/).includes(className);
  }

  function findElement(rootNode, predicate) {
    if (!rootNode) {
      return null;
    }

    if (predicate(rootNode)) {
      return rootNode;
    }

    for (const child of rootNode.children || []) {
      const match = findElement(child, predicate);
      if (match) {
        return match;
      }
    }

    return null;
  }

  function findDescendantByClassName(rootNode, className) {
    return findElement(rootNode, (node) => hasClassName(node, className));
  }

  function findTaskRow(taskId) {
    return findElement(taskList, (node) => hasClassName(node, "task-item") && node.taskId === taskId);
  }

  function setPendingFocus(target) {
    pendingFocus = target;
  }

  function resolvePendingFocus() {
    if (!pendingFocus) {
      return null;
    }

    const currentTarget = pendingFocus;
    pendingFocus = null;

    switch (currentTarget.type) {
      case "task-input":
        return taskInput;
      case "search-input":
        return searchInput;
      case "select-all":
        return toggleSelectAllBtn;
      case "bulk-complete":
        return bulkCompleteBtn;
      case "bulk-delete":
        return bulkDeleteBtn;
      case "task-row": {
        const taskRow = findTaskRow(currentTarget.taskId);
        return taskRow || taskInput;
      }
      case "task-action": {
        const taskRow = findTaskRow(currentTarget.taskId);
        if (!taskRow) {
          return taskInput;
        }

        const targetNode = findDescendantByClassName(taskRow, currentTarget.className);
        return targetNode || taskRow;
      }
      default:
        return null;
    }
  }

  function applyPendingFocus() {
    const nextFocus = resolvePendingFocus();
    if (nextFocus && typeof nextFocus.focus === "function") {
      nextFocus.focus();
    }
  }

  function announce(message, priority) {
    const isAlert = priority === "alert";
    const target = isAlert ? alertLiveRegion : statusLiveRegion;
    const resetTarget = isAlert ? statusLiveRegion : alertLiveRegion;

    resetTarget.textContent = "";
    target.textContent = "";
    target.textContent = message;
  }

  function pluralize(count, singular, plural) {
    return count === 1 ? singular : plural;
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

  function clearMissingTaskState() {
    const knownTaskIds = new Set(tasks.map((task) => task.id));

    selectedTaskIds.forEach((taskId) => {
      if (!knownTaskIds.has(taskId)) {
        selectedTaskIds.delete(taskId);
      }
    });

    expandedTaskIds.forEach((taskId) => {
      if (!knownTaskIds.has(taskId)) {
        expandedTaskIds.delete(taskId);
      }
    });

    if (editingTaskId && !knownTaskIds.has(editingTaskId)) {
      editingTaskId = null;
      editDraft = "";
    }
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
      announce("Task description is required before adding a task.", "alert");
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
    setPendingFocus({ type: "task-input" });
    announce(`Added task ${text}.`);
    renderTasks();
  }

  function toggleTask(taskId) {
    let updatedTask = null;

    tasks = tasks.map((task) => {
      if (task.id === taskId) {
        updatedTask = { ...task, completed: !task.completed };
        return updatedTask;
      }

      return task;
    });

    saveTasks();
    setPendingFocus({ type: "task-action", taskId, className: "task-toggle" });
    if (updatedTask) {
      announce(`${updatedTask.completed ? "Completed" : "Reopened"} ${updatedTask.text}.`);
    }
    renderTasks();
  }

  function toggleTaskSelection(taskId) {
    const task = tasks.find((currentTask) => currentTask.id === taskId);
    if (!task) {
      return;
    }

    if (selectedTaskIds.has(taskId)) {
      selectedTaskIds.delete(taskId);
      announce(`Deselected ${task.text}.`);
    } else {
      selectedTaskIds.add(taskId);
      announce(`Selected ${task.text}.`);
    }

    setPendingFocus({ type: "task-action", taskId, className: "selection-toggle" });
    renderTasks();
  }

  function toggleSubtask(taskId, subtaskId) {
    let updatedTask = null;
    let updatedSubtask = null;

    tasks = tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }

      updatedTask = {
        ...task,
        subtasks: task.subtasks.map((subtask) => {
          if (subtask.id === subtaskId) {
            updatedSubtask = { ...subtask, completed: !subtask.completed };
            return updatedSubtask;
          }

          return subtask;
        })
      };

      return updatedTask;
    });

    saveTasks();
    expandedTaskIds.add(taskId);
    setPendingFocus({ type: "task-action", taskId, className: "subtask-input" });
    if (updatedTask && updatedSubtask) {
      announce(`${updatedSubtask.completed ? "Completed" : "Reopened"} subtask ${updatedSubtask.title} for ${updatedTask.text}.`);
    }
    renderTasks();
  }

  function addSubtask(taskId, title) {
    const normalizedTitle = normalizeLabel(title);
    if (!normalizedTitle) {
      announce("Subtask title is required before adding it.", "alert");
      return false;
    }

    let updatedTask = null;

    tasks = tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }

      updatedTask = {
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

      return updatedTask;
    });

    expandedTaskIds.add(taskId);
    saveTasks();
    setPendingFocus({ type: "task-action", taskId, className: "subtask-input" });
    if (updatedTask) {
      announce(`Added subtask ${normalizedTitle} to ${updatedTask.text}.`);
    }
    renderTasks();
    return true;
  }

  function deleteSubtask(taskId, subtaskId) {
    let updatedTask = null;
    let removedSubtask = null;

    tasks = tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }

      removedSubtask = task.subtasks.find((subtask) => subtask.id === subtaskId) || null;
      updatedTask = {
        ...task,
        subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId)
      };

      return updatedTask;
    });

    expandedTaskIds.add(taskId);
    saveTasks();
    setPendingFocus({ type: "task-action", taskId, className: "subtask-input" });
    if (updatedTask && removedSubtask) {
      announce(`Removed subtask ${removedSubtask.title} from ${updatedTask.text}.`, "alert");
    }
    renderTasks();
  }

  function focusNearestTask(afterIndex) {
    const nextTask = tasks[afterIndex] || tasks[afterIndex - 1] || null;
    if (nextTask) {
      setPendingFocus({ type: "task-row", taskId: nextTask.id });
      return;
    }

    setPendingFocus({ type: "task-input" });
  }

  function deleteTask(taskId) {
    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    const task = taskIndex >= 0 ? tasks[taskIndex] : null;
    tasks = tasks.filter((currentTask) => currentTask.id !== taskId);
    expandedTaskIds.delete(taskId);
    selectedTaskIds.delete(taskId);

    if (editingTaskId === taskId) {
      editingTaskId = null;
      editDraft = "";
    }

    saveTasks();
    focusNearestTask(taskIndex);
    if (task) {
      announce(`Deleted ${task.text}.`, "alert");
    }
    renderTasks();
  }

  function toggleTaskDetails(taskId, options = {}) {
    const isExpanded = expandedTaskIds.has(taskId);
    const task = tasks.find((currentTask) => currentTask.id === taskId);

    if (isExpanded) {
      expandedTaskIds.delete(taskId);
      setPendingFocus({
        type: "task-action",
        taskId,
        className: "details-toggle"
      });
      if (task) {
        announce(`Closed details for ${task.text}.`);
      }
    } else {
      expandedTaskIds.add(taskId);
      setPendingFocus({
        type: "task-action",
        taskId,
        className: options.focusTarget === "details-toggle" ? "details-toggle" : "subtask-input"
      });
      if (task) {
        announce(`Opened details for ${task.text}.`);
      }
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
    setPendingFocus({ type: "task-action", taskId, className: "edit-input" });
    announce(`Editing ${task.text}. Press Enter to save or Escape to cancel.`);
    renderTasks();
  }

  function cancelEditing() {
    const taskId = editingTaskId;
    const task = tasks.find((currentTask) => currentTask.id === taskId);
    editingTaskId = null;
    editDraft = "";
    if (taskId) {
      setPendingFocus({ type: "task-action", taskId, className: "edit-btn" });
    }
    if (task) {
      announce(`Canceled editing for ${task.text}.`);
    }
    renderTasks();
  }

  function saveEdit(taskId) {
    const nextText = normalizeLabel(editDraft);
    if (!nextText) {
      announce("Edited task text cannot be empty.", "alert");
      setPendingFocus({ type: "task-action", taskId, className: "edit-input" });
      renderTasks();
      return;
    }

    let updatedTask = null;

    tasks = tasks.map((task) => {
      if (task.id === taskId) {
        updatedTask = { ...task, text: nextText };
        return updatedTask;
      }

      return task;
    });

    editingTaskId = null;
    editDraft = "";
    saveTasks();
    setPendingFocus({ type: "task-action", taskId, className: "edit-btn" });
    if (updatedTask) {
      announce(`Saved task ${updatedTask.text}.`);
    }
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

  function getVisibleSelectionCount(visibleTasks) {
    return visibleTasks.filter((task) => selectedTaskIds.has(task.id)).length;
  }

  function areAllVisibleTasksSelected(visibleTasks) {
    return visibleTasks.length > 0 && visibleTasks.every((task) => selectedTaskIds.has(task.id));
  }

  function updateToolbarState(visibleTasks) {
    clearSearchBtn.disabled = searchQuery.length === 0;

    filterButtons.forEach(({ key, element }) => {
      const isActive = key === activeFilter;
      element.className = `filter-btn${isActive ? " active" : ""}`;
      element.ariaPressed = String(isActive);
    });

    const completedCount = tasks.filter((task) => task.completed).length;
    const visibleSelectionCount = getVisibleSelectionCount(visibleTasks);
    const hasSelection = selectedTaskIds.size > 0;
    const allVisibleSelected = areAllVisibleTasksSelected(visibleTasks);

    selectionSummary.textContent = hasSelection
      ? `${selectedTaskIds.size} ${pluralize(selectedTaskIds.size, "task", "tasks")} selected`
      : "No tasks selected";

    toggleSelectAllBtn.disabled = visibleTasks.length === 0;
    toggleSelectAllBtn.textContent = allVisibleSelected ? "Deselect visible" : "Select all visible";
    toggleSelectAllBtn.ariaLabel = allVisibleSelected
      ? "Deselect all visible tasks"
      : "Select all visible tasks";
    clearSelectionBtn.disabled = !hasSelection;
    bulkCompleteBtn.disabled = !hasSelection;
    bulkDeleteBtn.disabled = !hasSelection;

    resultsSummary.textContent =
      `Showing ${visibleTasks.length} of ${tasks.length} tasks · ${completedCount} completed · ${visibleSelectionCount} visible selected`;
  }

  function updateStateBanner(visibleTasks) {
    const allDone = tasks.length > 0 && tasks.every((task) => task.completed);
    const showAllDoneBanner = allDone && !searchQuery && activeFilter === "all" && visibleTasks.length > 0;

    stateBanner.hidden = !showAllDoneBanner;
    stateBanner.textContent = showAllDoneBanner
      ? "All tasks are complete. Review what shipped or add the next priority when you're ready."
      : "";
  }

  function getEmptyStateContent() {
    if (tasks.length === 0) {
      return {
        title: "No tasks yet",
        message: "Add one to get started.",
        className: "empty-state state-empty"
      };
    }

    if (!searchQuery && activeFilter !== "completed" && tasks.every((task) => task.completed)) {
      return {
        title: "All tasks complete",
        message: "Enjoy the win, or add the next priority when inspiration strikes.",
        className: "empty-state state-all-done"
      };
    }

    return {
      title: "No matching tasks",
      message: "Adjust the search or filters to bring tasks back into view.",
      className: "empty-state state-no-results"
    };
  }

  function createEmptyState() {
    const { title, message, className } = getEmptyStateContent();
    const emptyState = document.createElement("section");
    emptyState.className = className;

    const heading = document.createElement("p");
    heading.className = "empty-state-title";
    heading.textContent = title;

    const body = document.createElement("p");
    body.className = "empty-state-body";
    body.textContent = message;

    emptyState.appendChild(heading);
    emptyState.appendChild(body);
    return emptyState;
  }

  function createTaskDetails(task) {
    const taskDetails = document.createElement("section");
    taskDetails.className = "task-details";
    taskDetails.id = `${task.id}-details`;
    taskDetails.ariaLabel = `Subtasks for ${task.text}`;

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
    subtaskInput.ariaLabel = `Add a subtask for ${task.text}`;
    subtaskInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (addSubtask(task.id, subtaskInput.value)) {
          return;
        }

        subtaskInput.focus();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (normalizeLabel(subtaskInput.value)) {
          subtaskInput.value = "";
          announce(`Cleared the new subtask draft for ${task.text}.`);
          return;
        }

        toggleTaskDetails(task.id, { focusTarget: "details-toggle" });
      }
    });

    const addSubtaskButton = document.createElement("button");
    addSubtaskButton.className = "secondary-btn add-subtask-btn";
    addSubtaskButton.type = "button";
    addSubtaskButton.textContent = "Add subtask";
    addSubtaskButton.ariaLabel = `Add subtask to ${task.text}`;
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
      subtaskToggle.ariaLabel = `${subtask.completed ? "Mark" : "Complete"} subtask ${subtask.title}`;
      subtaskToggle.addEventListener("change", () => toggleSubtask(task.id, subtask.id));

      const subtaskText = document.createElement("span");
      subtaskText.className = "subtask-text";
      subtaskText.textContent = subtask.title;

      const removeSubtaskButton = document.createElement("button");
      removeSubtaskButton.className = "secondary-btn subtask-remove";
      removeSubtaskButton.type = "button";
      removeSubtaskButton.textContent = "Remove";
      removeSubtaskButton.ariaLabel = `Remove subtask ${subtask.title} from ${task.text}`;
      removeSubtaskButton.addEventListener("click", () => deleteSubtask(task.id, subtask.id));

      subtaskItem.appendChild(subtaskToggle);
      subtaskItem.appendChild(subtaskText);
      subtaskItem.appendChild(removeSubtaskButton);
      subtaskList.appendChild(subtaskItem);
    });

    taskDetails.appendChild(subtaskList);
    return taskDetails;
  }

  function clearSelection(announcement, focusTargetType) {
    if (selectedTaskIds.size === 0) {
      return;
    }

    selectedTaskIds.clear();
    if (announcement) {
      announce(announcement);
    }
    if (focusTargetType) {
      setPendingFocus({ type: focusTargetType });
    }
    renderTasks();
  }

  function toggleSelectAllVisible() {
    const visibleTasks = getVisibleTasks();
    if (visibleTasks.length === 0) {
      return;
    }

    if (areAllVisibleTasksSelected(visibleTasks)) {
      visibleTasks.forEach((task) => {
        selectedTaskIds.delete(task.id);
      });
      announce(`Deselected ${visibleTasks.length} visible ${pluralize(visibleTasks.length, "task", "tasks")}.`);
    } else {
      visibleTasks.forEach((task) => {
        selectedTaskIds.add(task.id);
      });
      announce(`Selected ${visibleTasks.length} visible ${pluralize(visibleTasks.length, "task", "tasks")}.`);
    }

    setPendingFocus({ type: "select-all" });
    renderTasks();
  }

  function completeSelectedTasks() {
    if (selectedTaskIds.size === 0) {
      return;
    }

    let updatedCount = 0;
    tasks = tasks.map((task) => {
      if (!selectedTaskIds.has(task.id) || task.completed) {
        return task;
      }

      updatedCount += 1;
      return { ...task, completed: true };
    });

    saveTasks();
    announce(`Marked ${updatedCount} selected ${pluralize(updatedCount, "task", "tasks")} complete.`);
    setPendingFocus({ type: "bulk-complete" });
    renderTasks();
  }

  function deleteSelectedTasks() {
    if (selectedTaskIds.size === 0) {
      return;
    }

    const removedCount = selectedTaskIds.size;
    tasks = tasks.filter((task) => !selectedTaskIds.has(task.id));
    clearMissingTaskState();
    selectedTaskIds.clear();
    saveTasks();
    announce(`Deleted ${removedCount} selected ${pluralize(removedCount, "task", "tasks")}.`, "alert");
    setPendingFocus({ type: tasks.length > 0 ? "select-all" : "task-input" });
    renderTasks();
  }

  function moveTask(taskId, direction) {
    const currentIndex = tasks.findIndex((task) => task.id === taskId);
    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= tasks.length) {
      return;
    }

    const reorderedTasks = [...tasks];
    const [movedTask] = reorderedTasks.splice(currentIndex, 1);
    reorderedTasks.splice(targetIndex, 0, movedTask);
    tasks = reorderedTasks;
    saveTasks();
    setPendingFocus({ type: "task-row", taskId });
    announce(`Moved ${movedTask.text} ${direction}.`);
    renderTasks();
  }

  function createTaskRow(task, index) {
    const isEditing = editingTaskId === task.id;
    const isExpanded = expandedTaskIds.has(task.id);
    const isSelected = selectedTaskIds.has(task.id);
    const taskRow = document.createElement("article");
    taskRow.className = `task-item${task.completed ? " completed" : ""}${task.priority === "high" ? " priority-high" : ""}${isSelected ? " selected" : ""}`;
    taskRow.role = "listitem";
    taskRow.tabIndex = 0;
    taskRow.taskId = task.id;
    taskRow.ariaLabel = `${task.text}${task.completed ? ", completed" : ", active"}${isSelected ? ", selected" : ""}`;
    taskRow.addEventListener("keydown", (event) => {
      if (event.altKey && event.key === "ArrowUp") {
        event.preventDefault();
        moveTask(task.id, "up");
      }

      if (event.altKey && event.key === "ArrowDown") {
        event.preventDefault();
        moveTask(task.id, "down");
      }

      if (event.key === "Escape" && expandedTaskIds.has(task.id) && !isEditing) {
        event.preventDefault();
        toggleTaskDetails(task.id, { focusTarget: "details-toggle" });
      }
    });

    const taskLeadingControls = document.createElement("div");
    taskLeadingControls.className = "task-leading-controls";

    const selectionToggle = document.createElement("input");
    selectionToggle.className = "selection-toggle";
    selectionToggle.type = "checkbox";
    selectionToggle.checked = isSelected;
    selectionToggle.ariaLabel = `${isSelected ? "Deselect" : "Select"} task ${task.text}`;
    selectionToggle.addEventListener("change", () => toggleTaskSelection(task.id));

    const checkbox = document.createElement("input");
    checkbox.className = "task-toggle";
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.disabled = isEditing;
    checkbox.ariaLabel = `${task.completed ? "Mark" : "Complete"} task ${task.text}`;
    checkbox.addEventListener("change", () => toggleTask(task.id));

    taskLeadingControls.appendChild(selectionToggle);
    taskLeadingControls.appendChild(checkbox);

    const taskContent = document.createElement("div");
    taskContent.className = "task-content";

    const taskActions = document.createElement("div");
    taskActions.className = "task-actions";

    if (isEditing) {
      const editInput = document.createElement("input");
      editInput.className = "edit-input";
      editInput.type = "text";
      editInput.value = editDraft;
      editInput.ariaLabel = `Edit task ${task.text}`;
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
      saveButton.className = "secondary-btn save-btn";
      saveButton.type = "button";
      saveButton.textContent = "Save";
      saveButton.ariaLabel = `Save edits for ${task.text}`;
      saveButton.addEventListener("click", () => saveEdit(task.id));

      const cancelButton = document.createElement("button");
      cancelButton.className = "secondary-btn cancel-btn";
      cancelButton.type = "button";
      cancelButton.textContent = "Cancel";
      cancelButton.ariaLabel = `Cancel editing ${task.text}`;
      cancelButton.addEventListener("click", cancelEditing);

      taskContent.appendChild(editInput);
      taskActions.appendChild(saveButton);
      taskActions.appendChild(cancelButton);
      taskRow.appendChild(taskLeadingControls);
      taskRow.appendChild(taskContent);
      taskRow.appendChild(taskActions);
      return taskRow;
    }

    const taskHeader = document.createElement("div");
    taskHeader.className = "task-header";

    const taskText = document.createElement("p");
    taskText.className = "task-text";
    taskText.textContent = task.text;

    const detailsToggle = document.createElement("button");
    detailsToggle.className = "secondary-btn details-toggle";
    detailsToggle.type = "button";
    detailsToggle.textContent = isExpanded ? "Hide details" : task.subtasks.length > 0 ? "Show details" : "Add subtasks";
    detailsToggle.ariaExpanded = String(isExpanded);
    detailsToggle.ariaControls = `${task.id}-details`;
    detailsToggle.ariaLabel = `${isExpanded ? "Hide" : "Show"} details for ${task.text}`;
    detailsToggle.addEventListener("click", () => toggleTaskDetails(task.id));

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
    editButton.className = "secondary-btn edit-btn";
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.ariaLabel = `Edit task ${task.text}`;
    editButton.addEventListener("click", () => startEditing(task.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-btn";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.ariaLabel = `Delete task ${task.text}`;
    deleteButton.addEventListener("click", () => deleteTask(task.id));

    const moveControls = document.createElement("div");
    moveControls.className = "task-order-controls";

    const moveUpButton = document.createElement("button");
    moveUpButton.className = "secondary-btn move-up-btn";
    moveUpButton.type = "button";
    moveUpButton.textContent = "Move up";
    moveUpButton.ariaLabel = `Move ${task.text} up`;
    moveUpButton.disabled = index === 0;
    moveUpButton.addEventListener("click", () => moveTask(task.id, "up"));

    const moveDownButton = document.createElement("button");
    moveDownButton.className = "secondary-btn move-down-btn";
    moveDownButton.type = "button";
    moveDownButton.textContent = "Move down";
    moveDownButton.ariaLabel = `Move ${task.text} down`;
    moveDownButton.disabled = index === tasks.length - 1;
    moveDownButton.addEventListener("click", () => moveTask(task.id, "down"));

    moveControls.appendChild(moveUpButton);
    moveControls.appendChild(moveDownButton);

    taskActions.appendChild(editButton);
    taskActions.appendChild(deleteButton);
    taskActions.appendChild(moveControls);
    taskRow.appendChild(taskLeadingControls);
    taskRow.appendChild(taskContent);
    taskRow.appendChild(taskActions);
    return taskRow;
  }

  function renderTasks() {
    clearMissingTaskState();
    const visibleTasks = getVisibleTasks();
    taskList.innerHTML = "";
    updateToolbarState(visibleTasks);
    updateStateBanner(visibleTasks);

    if (visibleTasks.length === 0) {
      taskList.appendChild(createEmptyState());
      applyPendingFocus();
      return;
    }

    visibleTasks.forEach((task, index) => {
      taskList.appendChild(createTaskRow(task, index));
    });

    applyPendingFocus();
  }

  addBtn.addEventListener("click", addTask);

  [taskInput, priorityInput, dueDateInput, tagsInput].forEach((element) => {
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addTask();
      }
    });
  });

  searchInput.addEventListener("input", (event) => {
    searchQuery = normalizeLabel(event.target.value).toLowerCase();
    renderTasks();
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (searchInput.value) {
        searchInput.value = "";
        searchQuery = "";
        announce("Cleared search.");
        setPendingFocus({ type: "search-input" });
        renderTasks();
      }
    }
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    announce("Cleared search.");
    setPendingFocus({ type: "search-input" });
    renderTasks();
  });

  toggleSelectAllBtn.addEventListener("click", toggleSelectAllVisible);
  clearSelectionBtn.addEventListener("click", () => clearSelection("Cleared selected tasks.", "select-all"));
  bulkCompleteBtn.addEventListener("click", completeSelectedTasks);
  bulkDeleteBtn.addEventListener("click", deleteSelectedTasks);

  bulkToolbar.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && selectedTaskIds.size > 0) {
      event.preventDefault();
      clearSelection("Cleared selected tasks.", "select-all");
    }
  });

  filterButtons.forEach(({ key, element }) => {
    element.addEventListener("click", () => {
      activeFilter = key;
      renderTasks();
    });
  });

  renderTasks();
});
