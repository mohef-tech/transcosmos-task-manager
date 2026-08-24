# System Architecture

> Technical design document for the Transcosmos Task Manager — a full-stack monorepo built with Laravel 12 (backend) and Next.js 16 (frontend).

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Choices](#technology-choices)
3. [Database Schema](#database-schema)
4. [Auth Flow](#auth-flow)
5. [File Upload Flow](#file-upload-flow)
6. [Queue Flow](#queue-flow)
7. [Real-time Update Strategy](#real-time-update-strategy)
8. [API Layer Structure](#api-layer-structure)
9. [Intentional Design Decisions](#intentional-design-decisions)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                          │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                   Next.js 16 (CSR)                      │   │
│   │  ┌──────────┐  ┌───────────┐  ┌────────────────────┐   │   │
│   │  │ /login   │  │/dashboard │  │  AttachmentModal   │   │   │
│   │  └──────────┘  └───────────┘  └────────────────────┘   │   │
│   │  ┌──────────────────────────────────────────────────┐   │   │
│   │  │  app/lib/api.ts  (typed fetch wrapper)           │   │   │
│   │  │  Authorization: Bearer <token from localStorage> │   │   │
│   │  └─────────────────────┬────────────────────────────┘   │   │
│   └────────────────────────┼────────────────────────────────┘   │
│                            │ HTTP / JSON                         │
└────────────────────────────┼────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Laravel 12 API │  :8000
                    │  ┌───────────┐  │
                    │  │  Sanctum  │  │  Auth middleware
                    │  │ Middleware │  │
                    │  └─────┬─────┘  │
                    │  ┌─────▼──────────────────┐  │
                    │  │  Controllers (Api/)     │  │
                    │  │  AuthController         │  │
                    │  │  TaskController         │  │
                    │  │  AttachmentController   │  │
                    │  │  ExportController       │  │
                    │  └──────┬─────────────────-┘  │
                    └─────────┼───────────────────--┘
                              │
              ┌───────────────┴──────────────────┐
              │                                   │
    ┌─────────▼──────┐                  ┌─────────▼────────────┐
    │   MySQL 8.0    │                  │  Laravel Storage      │
    │  users         │                  │  (local disk)         │
    │  tasks         │                  │  storage/app/         │
    │  task_attach.  │                  │  ├── attachments/     │
    │  task_comments │                  │  ├── thumbnails/      │
    │  jobs (queue)  │                  │  └── exports/         │
    └────────┬───────┘                  └──────────────────────-┘
             │
    ┌────────▼───────────┐
    │  Queue Worker       │
    │  php artisan        │
    │  queue:work         │
    │  NotifyTaskAssigned │→ log (MAIL_MAILER=log)
    │  ExportTasksCsv     │→ storage/exports/*.csv
    └─────────────────────┘
```

---

## Technology Choices

| Layer | Technology | Version | Reasoning |
|---|---|---|---|
| Backend Framework | Laravel | 12.x | Rapid REST API development; Eloquent ORM; Sanctum auth built-in |
| Language (BE) | PHP | 8.2+ | Required by Laravel 12; enums and fibers support |
| Database | MySQL | 8.0+ | Relational integrity for tasks/users/attachments; index support |
| Auth | Laravel Sanctum | — | Token-based auth without full OAuth overhead; simple Bearer token |
| Queue | Laravel Queue (`database` driver) | — | No Redis needed; self-contained for assessment scale |
| Image Processing | PHP GD (built-in) | — | Zero extra Composer dependency; covers 300×300 thumbnail crop |
| Frontend Framework | Next.js | 16 (App Router) | React 19 + TypeScript; file-based routing; CSR suitable for SPA |
| Styling | Tailwind CSS | v4 | Utility-first; rapid prototyping; CSS custom properties |
| Real-time | HTTP Polling | — | Lightweight; no infrastructure needed (vs WebSocket/SSE) |

---

## Database Schema

### Entity Relationship Diagram

```
users
  ├── id (PK, bigint unsigned, auto_increment)
  ├── name (varchar 255)
  ├── email (varchar 255, unique)
  ├── password (varchar 255, hashed)
  ├── role (enum: 'admin' | 'member', default: 'member')
  ├── email_verified_at (timestamp, nullable)
  ├── remember_token (varchar 100, nullable)
  ├── created_at (timestamp)
  └── updated_at (timestamp)

tasks
  ├── id (PK, bigint unsigned, auto_increment)
  ├── title (varchar 255)
  ├── description (text, nullable)
  ├── status (enum: 'todo' | 'in_progress' | 'done', default: 'todo') [INDEX]
  ├── priority (enum: 'low' | 'medium' | 'high', default: 'medium') [INDEX]
  ├── assigned_user_id (FK → users.id, nullOnDelete, nullable)
  ├── created_by (FK → users.id, cascadeOnDelete)
  ├── due_date (date, nullable) [INDEX]
  ├── created_at (timestamp)
  └── updated_at (timestamp)

task_attachments
  ├── id (PK, bigint unsigned, auto_increment)
  ├── task_id (FK → tasks.id, cascadeOnDelete) [INDEX]
  ├── file_name (varchar 255)
  ├── file_path (varchar 255)
  ├── thumbnail_path (varchar 255, nullable)
  ├── file_size (bigint unsigned, bytes)
  ├── mime_type (varchar 255)
  └── uploaded_at (timestamp, default: current)

task_comments
  ├── id (PK, bigint unsigned, auto_increment)
  ├── task_id (FK → tasks.id, cascadeOnDelete) [INDEX]
  ├── user_id (FK → users.id, cascadeOnDelete)
  ├── comment (text)
  └── created_at (timestamp, default: current)

personal_access_tokens  ← managed by Laravel Sanctum
  ├── id (PK, bigint unsigned, auto_increment)
  ├── tokenable_type (varchar 255)
  ├── tokenable_id (bigint unsigned)
  ├── name (varchar 255)
  ├── token (varchar 64, unique, hashed)
  ├── abilities (text, nullable)
  ├── last_used_at (timestamp, nullable)
  ├── expires_at (timestamp, nullable)
  ├── created_at (timestamp)
  └── updated_at (timestamp)

jobs  ← Laravel Queue (database driver)
  ├── id (PK, bigint unsigned, auto_increment)
  ├── queue (varchar 255) [INDEX]
  ├── payload (longtext)
  ├── attempts (tinyint unsigned)
  ├── reserved_at (int unsigned, nullable)
  ├── available_at (int unsigned)
  └── created_at (int unsigned)
```

### Table Relationships

```
users ──< tasks (assigned_user_id)   one user can be assigned many tasks
users ──< tasks (created_by)         one user can create many tasks
tasks ──< task_attachments           one task can have many attachments
tasks ──< task_comments              one task can have many comments
users ──< task_comments              one user can write many comments
```

---

## Auth Flow

```
1. Client POSTs credentials:
   POST /api/auth/login
   { "email": "...", "password": "..." }

2. Laravel validates credentials against users table.
   If valid → creates Sanctum personal access token.

3. Response:
   { "token": "1|abc123...", "user": { id, name, email, role } }

4. Frontend stores token in localStorage:
   localStorage.setItem('token', response.token)

5. All subsequent requests include:
   Authorization: Bearer <token>

6. Sanctum middleware verifies token on every protected route.
   Invalid/missing token → 401 Unauthorized

7. Logout:
   POST /api/auth/logout
   → currentAccessToken()->delete()
   → Frontend clears localStorage and redirects to /login
```

---

## File Upload Flow

```
1. User selects file(s) in AttachmentModal (drag-and-drop or browse).

2. Frontend sends multipart/form-data:
   POST /api/tasks/{task}/attachments
   Content-Type: multipart/form-data
   Body: file (binary) + Authorization: Bearer <token>

3. AttachmentController validation:
   - MIME type must be: jpeg, png, gif, webp, pdf, doc, docx, xls, xlsx, txt, zip
   - Extension whitelist check (guards against MIME spoofing)
   - Max file size: 10 MB (10240 KB)

4. File is stored:
   Storage::disk('local')->put('attachments/<uuid>.<ext>', $fileContent)
   → stored at: storage/app/attachments/<uuid>.<ext>

5. Thumbnail generation (images only):
   - Check: mime_type starts with 'image/'
   - Load image via imagecreatefromstring()
   - Calculate cover crop (center) to 300×300
   - Save as JPEG: storage/app/thumbnails/<uuid>_thumb.jpg
   - thumbnail_path stored in task_attachments table

6. Record saved to task_attachments:
   { task_id, file_name, file_path, thumbnail_path, file_size, mime_type, uploaded_at }

7. Download flow:
   GET /api/tasks/{task}/attachments/{attachment}/download
   → Laravel reads file from storage disk (not public symlink)
   → Streams as download response with original filename
   → Frontend uses fetch() + Blob URL to trigger browser download
     (required because Authorization header cannot be set via <a href>)
```

---

## Queue Flow

```
1. Task creation triggers job dispatch:
   POST /api/tasks → TaskController::store()
   → dispatch(new NotifyTaskAssigned($task))

2. Job is serialized and inserted into the `jobs` table (MySQL).

3. Queue worker picks up jobs (must run separately):
   php artisan queue:work --tries=3

4. NotifyTaskAssigned job:
   - Loads task with assigned user relation
   - Sends email via Mail::to($assignedUser)->send(new TaskAssignedMail())
   - MAIL_MAILER=log → email content written to storage/logs/laravel.log
   - On failure: retried up to 3 times, then moved to failed_jobs table

5. ExportTasksCsv job (dispatched via export endpoint):
   POST /api/exports/tasks → ExportController::exportTasks()
   → dispatch(new ExportTasksCsv($filters))

6. ExportTasksCsv job:
   - Queries tasks with optional filters (status, priority, assigned_to)
   - Streams CSV row-by-row
   - Saves to: storage/exports/tasks_<timestamp>.csv
   - File becomes available via GET /api/exports/tasks/{filename}
```

---

## Real-time Update Strategy

### Decision: HTTP Polling (not WebSocket or SSE)

**Rationale:** For the scope of this assessment (single dashboard, moderate data volume), HTTP polling is the simplest and most reliable approach with zero additional infrastructure. WebSocket would require a dedicated service (Pusher, Reverb, or socket.io), while polling works within any standard Laravel + Next.js setup.

### Implementation

```
usePolling hook (app/hooks/usePolling.ts):

┌─────────────────────────────────────────────────┐
│ setInterval(callback, 10_000)                   │
│                                                 │
│ Optimizations:                                  │
│  • document.visibilityState === 'hidden'        │
│    → pause interval (no unnecessary requests)   │
│  • 'visibilitychange' event → resume on focus   │
│  • clearInterval on component unmount           │
└─────────────────┬───────────────────────────────┘
                  │ every 10s (only when tab visible)
                  ▼
      GET /api/tasks?<current filters>
                  │
                  ▼
      setTasks(response.data)   ← silent update, no loading spinner
                  │
                  ▼
      Live dot indicator blinks  ← visual feedback to user
```

---

## API Layer Structure

### Route Grouping (`routes/api.php`)

```
/api/auth/login                              POST   (public)
/api/auth/logout                             POST   (auth:sanctum)
/api/auth/me                                 GET    (auth:sanctum)

/api/tasks                                   GET    list + filter + paginate
/api/tasks                                   POST   create task
/api/tasks/{id}                              GET    show with relations
/api/tasks/{id}                              PUT    update (creator or admin only)
/api/tasks/{id}                              DELETE delete (creator or admin only)

/api/tasks/{id}/attachments                  POST   upload file
/api/tasks/{id}/attachments/{aid}/download   GET    authenticated download
/api/tasks/{id}/attachments/{aid}            DELETE remove file + thumbnail

/api/exports/tasks                           POST   dispatch CSV export → 202
/api/exports/tasks                           GET    list generated CSV files
/api/exports/tasks/{filename}                GET    download specific CSV
```

### Query Parameters for `GET /api/tasks`

| Parameter | Type | Description |
|---|---|---|
| `status` | `todo\|in_progress\|done` | Filter by status |
| `priority` | `low\|medium\|high` | Filter by priority |
| `assigned_to` | integer | Filter by assigned user ID |
| `search` | string | Search on task title |
| `sort_by` | `created_at\|due_date\|priority` | Sort field |
| `sort_dir` | `asc\|desc` | Sort direction |
| `per_page` | integer | Items per page (default: 15) |
| `page` | integer | Page number |

### Paginated Response Format

```json
{
  "data": [ { "id": 1, "title": "...", "status": "todo", ... } ],
  "links": {
    "first": "http://localhost:8000/api/tasks?page=1",
    "last": "http://localhost:8000/api/tasks?page=3",
    "prev": null,
    "next": "http://localhost:8000/api/tasks?page=2"
  },
  "meta": {
    "current_page": 1,
    "last_page": 3,
    "per_page": 15,
    "total": 42
  }
}
```

---

## Intentional Design Decisions

### Attachment Route: Nested Resource

The attachment routes use nested resource notation:

```
/api/tasks/{task}/attachments/{attachment}/download   ← implemented
/api/attachments/{id}/download                        ← original instruction
```

**Reason:** The nested structure enforces that the attachment belongs to the specified task, providing an implicit authorization check at the route level. It prevents cross-task attachment access and is more semantically correct per REST conventions.

### No Redis / Reverb Required

Queue uses the `database` driver — jobs are stored in MySQL's `jobs` table. This avoids a Redis dependency and keeps local setup to a single database connection. At assessment scale, this is reliable and sufficient.

### GD vs Intervention Image

PHP's built-in GD extension is used for thumbnail generation (`imagecreatefromstring`, `imagejpeg`). This means **zero additional Composer packages** are required. The cover-crop logic (center crop to 300×300) is implemented manually in `AttachmentController`.

### MAIL_MAILER=log

Email notifications are sent to `storage/logs/laravel.log` instead of a real SMTP server. This allows the queue/email feature to be fully demonstrable in a local environment without external service setup.
