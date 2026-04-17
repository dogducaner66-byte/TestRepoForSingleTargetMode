# Personal Todo App

This project is a polished personal planning board for people who want more than a basic checklist. It keeps quick capture simple, but also supports bulk triage, saved task order, subtasks, live filtering, keyboard-first workflows, and responsive use from narrow phones to wide desktops.

## Quick start

1. Install dependencies with `npm install`.
2. Open `index.html` in a modern browser for local use.
3. Run the validation scripts when you change the app:
   - `npm test`
   - `npm run lint`
   - `npm run build`

Tasks are stored in `localStorage`, so your list, ordering, subtasks, and bulk-friendly workflow stay available between visits in the same browser.

## What the app includes

- Fast capture with title, priority, due date, and tags
- Live search plus filters for active, completed, high-priority, and due-today work
- Bulk selection with select-all-visible, bulk complete, and bulk delete actions
- Persisted task ordering with move buttons and keyboard reorder shortcuts
- Expandable subtasks with progress tracking
- Responsive states for empty lists, no-results views, and all-done moments
- Accessibility support with semantic labels, live regions, focus treatment, and Escape/Enter behaviors

## How to use it well

- Add tasks from any composer field with `Enter`.
- Open task details to break larger work into subtasks.
- Use filters before bulk actions when you only want to act on the visible slice of work.
- Reorder the focused task with `Alt` + `Arrow Up` or `Arrow Down`.
- Use `Escape` to back out of editing, close open detail panels, or clear search and bulk selection states.

## Project structure

- `index.html` - semantic app shell
- `style.css` - responsive visual system and focus treatment
- `app.js` - task state, persistence, filters, bulk actions, and accessibility behavior
- `tests/core/app.test.js` - DOM harness and regression coverage for core flows
