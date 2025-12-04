# CODEBASE DOCUMENTATION — Engineering Documentation Portal

This document provides a file-by-file reference for the codebase in this workspace (backend + frontend). It's intended to help you quickly understand what each file does, where to look for logic, and how the pieces interact.

NOTE: This focuses on the application code in `backend/app` and `engineering-portal-frontend/src`. Build artifacts, git internals, and vendor files (e.g., node_modules) are omitted.

---

## Backend (backend/)

All paths below are relative to `backend/`.

### Top-level helper files
- `.env.example` — Example environment variables used by the backend (DATABASE_URL etc.).
- `requirements.txt` — Python dependencies for the backend (FastAPI, SQLAlchemy, alembic, test libs, and optional KB/embedding libs).
- `alembic.ini`, `alembic/` — Database migration system configuration and revision files. See `alembic/env.py` which wires SQLAlchemy metadata for autogenerate.

### Application entry & core
- `app/main.py` — FastAPI application factory and startup configuration. Registers routers, middleware, and background initializations.
- `app/__init__.py` — Package initialization.

### Configuration & security
- `app/core/config.py` — Central place for reading env vars / application settings.
- `app/core/security.py` — Password hashing and authentication helpers (e.g., password hashing, token helpers used by auth API).

### Database layer
- `app/db/database.py` — Database connections and session factory (async SQLAlchemy session creation, connection helper functions).
- `app/db/base_class.py` — Declarative base class definition and shared model helpers.

### Models (SQLAlchemy)
These define persistent database models used by the application.
- `app/models/user.py` — User model (id, email, full_name, hashed password, role flags, is_active fields). Used for auth and user management.
- `app/models/project.py` — Project model that groups documents and members. Contains metadata like name, code, description, status.
- `app/models/document.py` — Document model for uploaded documents (file_name, path, versions, size, owner, project relation).
- `app/models/comment.py` — Comment model (threaded comments, references to documents and users, resolved flags).
- `app/models/project_member.py` — Relation model mapping users to projects + roles.
- `app/models/tag.py` — Tag model for tagging documents and other entities.
- `app/models/activity_log.py` — Activity logs/audit records for important events.
- `app/models/notification.py` — Notifications schema for real-time updates, notifications queue.
- `app/models/kb.py` — Knowledge Base model(s) — kb-related tables (chunks, jobs, summaries). If KB features were added, this file will include KBChunk, KBJob, ProjectSummary models.

### Pydantic schemas (request & response shapes)
- `app/schemas/*.py` — Each file (e.g., `user.py`, `project.py`, `document.py`, `comment.py`) contains Pydantic models describing the request/response payloads used by API endpoints. They centralize validation and examples.

### CRUD layer
These contain functions that encapsulate database access logic (create / read / update / delete) using the SQLAlchemy models and Async sessions.
- `app/crud/base.py` — Base CRUD utilities / common helper functions used by other CRUD modules.
- `app/crud/user.py` — CRUD operations for users (create_user, get_user_by_email, update, deactivate, list users).
- `app/crud/project.py` — CRUD for projects (create, update, add members, statistics, list projects, archive/delete semantics).
- `app/crud/document.py` — Document create, upload metadata, versioning, linking to project and users.
- `app/crud/comment.py` — Create/update comment threads and pagination, operations for resolve/unresolve, annotation helpers.
- `app/crud/project_comment.py` — Project-scoped comments CRUD (if different from document comments).
- `app/crud/project_member.py` — Manage membership operations (add, remove, roles) at the project level.
- `app/crud/tag.py` — Tag creation and assignment helper routines.
- `app/crud/notification.py` — Persist and retrieve notifications.
- `app/crud/kb.py` — Knowledge base CRUD utilities (queueing jobs, adding chunks, saving embeddings, retrieval helpers) — present if KB functionality is available.

### API endpoints (FastAPI routers)
Paths here are mounted under `/api/v1` by `app/main.py`.
- `app/api/deps.py` — Dependency functions used across endpoints (auth dependency, DB session providers, current_user helpers).
- `app/api/v1/auth.py` — Authentication endpoints (login, token issuance, change password, get current user).
- `app/api/v1/users.py` — Admin endpoints to manage users.
- `app/api/v1/projects.py` — Project management: create, update, list, get details, manage members.
- `app/api/v1/documents.py` — Document upload/download, versioning, metadata editing, serve file preview endpoints.
- `app/api/v1/comments.py` — Create and manage comments attached to documents (threaded replies, edit/delete, resolve flag).
- `app/api/v1/project_comments.py` — Project-scoped comment endpoints (if present separate from document comments).
- `app/api/v1/tags.py` — Tag listing and assignment endpoints.
- `app/api/v1/notifications.py` — Read/mark-as-read endpoints for notifications.
- `app/api/v1/search.py` — Text search endpoints (likely backed by DB or simple LIKE queries) for quick searching.
- `app/api/v1/kb.py` — Knowledge Base endpoints: index (enqueue) documents or comments; search/ask endpoints; vector_search endpoints — present if KB features exist in your current branch.

### Services
Application service layer — utilities and helpers for business logic and I/O.
- `app/services/file_service.py` — File storage and retrieval logic (where uploaded files are written/read), path helpers.
- `app/services/activity_service.py` — Activity log creation helpers used when events occur (comments, updates, file uploads).
- `app/services/notification_service.py` — Create and send notifications, push/queue logic to notify clients.

### Workers
- `app/workers/kb_worker.py` — A background worker that polls for KB indexing jobs and handles extraction, chunking, embedding and indexing (FAISS or another vector store) — present if KB support was added.

### Utilities
- `app/utils/helpers.py` — Small helper utilities used across the backend (date formatting, file size conversion, validation helpers, etc.).

### Tests and development helpers
- `tests/` — Unit and integration tests. Look for tests like `test_kb_api.py`, `test_extractors.py` etc. — tests validate functionality for the KB, extractors, embeddings if present.  
- `scripts/` — helper scripts such as `create_admin.py`, `start_backend.sh`, `run_kb_worker.sh` etc., for quick local setup.

---

## Frontend (engineering-portal-frontend/)

All paths below are relative to `engineering-portal-frontend/`.

### App bootstrapping
- `src/main.jsx` — Application entry point; sets up React DOM, global providers (React Query provider, router), mounts `App.jsx`.
- `src/App.jsx` — Router configuration and top-level route definitions — maps pages to routes.

### API client
- `src/api/client.js` — Axios instance and wrapper functions for backend API; includes helpers to add JWT tokens and error handling interceptors.
- `src/api/kb.js` (if present) — KB-specific client wrappers: vector search, text search, enqueue indexing jobs.

### Pages (route targets)
Each page generally corresponds to a route in the app.
- `src/pages/Projects.jsx` — Projects list page; includes project creation modal, filtering, search and pagination.
- `src/pages/ProjectDetail.jsx` — Single project view: header with name/description, tabs/sections for documents, members, settings. Previously had a KB modal trigger. If KB is present the `Search KB` button opens an overlay modal.
- `src/pages/Dashboard.jsx` — Dashboard / home page with project stats, recent projects, quick actions.
- `src/pages/DocumentView.jsx` and `DocumentDetail.jsx` — Views for file previews, comments, and document-level metadata.
- `src/pages/Login.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx` — Authentication flows.
- `src/pages/Settings.jsx` — User profile and password change.
- `src/pages/Notifications.jsx` — Notification center UI.
- `src/pages/AdminUsers.jsx` — Admin area to manage users.

### Components
- `src/components/Layout.jsx` — Application shell with sidebar and top navigation used across pages.
- `src/components/EditDocumentModal.jsx` — Modal used to edit document metadata and upload new versions.
- `src/components/CommentsSection.jsx` — Document comments UI and threaded replies.
- `src/components/ProjectCommentsSection.jsx` — Project-level comments UI.
- `src/components/MentionTextarea.jsx` — Rich textarea supporting @mentions and lightweight markdown.
- `src/components/TagsSection.jsx` — Tag editor / viewer for documents.
- `src/components/ui/*` — Small presentational UI primitives (Badge, Button, Card, Input, Modal, Skeleton, EmptyState) used across app.
- `src/components/KBSearchModal.jsx` — Knowledge Base modal overlay UI (vector search). If KB feature is toggled off, it is lazy-loaded and not included in the bundle.

### Hooks & state
- `src/hooks/useDebounce.js` — Simple hook that debounces a value to avoid noisy updates.
- `src/store/authStore.js` — Zustand store that manages user authentication state and persisted token.

### Styling & utilities
- `src/index.css` — Tailwind and base styles for the frontend theme.
- `src/utils/helpers.js` — UI helper functions (formatting, common text functions).
- `src/utils/constants.js` — App-wide constants and default values.

### Docs and config
- `vite.config.js` (top-level) — Development server config and proxy to backend API.
- `package.json` — Frontend dependencies and script commands (dev, build, preview).

---

## How the pieces fit together (high level)
- The frontend SPA (Vite + React) connects to the backend API under `/api/v1/`.
- The backend is a FastAPI application exposing REST APIs for auth, projects, documents, comments, notifications and optional KB endpoints.
- The backend persists data in SQL (MySQL in config), managed by SQLAlchemy models and Alembic migrations.
- Background jobs (KB worker) optionally pick up indexing jobs from the DB and update a vector store (FAISS or another) used for semantic search.

---

Detailed per-file documentation (generated)

I generated hyper-detailed, one-file-per-module markdown docs for the codebase and placed them in `docs/files/`.

- Open `docs/files/INDEX.md` to browse every source file and quickly jump to its generated page.
  
	Re-generate the per-file docs any time using the included script:

	```bash
	# from repo root
	python3 scripts/generate_file_docs.py
	# output goes to docs/files/
	```

Next steps I can take for you:

1) Create an interactive table-of-contents in the repo's `README.md` linking to each file's section (more navigable). OR
2) Generate architecture diagrams (visual data-flow) and add run/check instructions for developers.

Tell me which next step you'd prefer and I will continue.
