# Task Manager — Technical Assessment

> Full-stack task management platform built for the Transcosmos Developer Technical Assessment.

![PHP](https://img.shields.io/badge/PHP-8.2+-8892BF?logo=php&logoColor=white)
![Laravel](https://img.shields.io/badge/Laravel-12.x-FF2D20?logo=laravel&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)
![Sanctum](https://img.shields.io/badge/Auth-Laravel%20Sanctum-FF2D20)

---

## Overview

A monorepo task management platform with a **Laravel 12 REST API** backend and a **Next.js 16** frontend. The system supports task CRUD with role-based authorization, secure file attachments with auto-generated image thumbnails, background queue processing, and real-time task updates via polling.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend | Laravel 12.x (PHP 8.2+) | REST API, Eloquent ORM |
| Auth | Laravel Sanctum | Token-based (Bearer) |
| Database | MySQL 8.0 | Migrations + Seeder |
| Queue | Laravel Queue — `database` driver | No Redis needed |
| File Storage | Laravel Storage (local disk) | Auto thumbnail via GD |
| Frontend | Next.js 16, React 19, TypeScript 5 | App Router, CSR |
| Styling | Tailwind CSS v4 | CSS custom properties |
| Real-time | HTTP Polling (10s interval) | Pause/resume on tab visibility |

---

## Implemented Features

### Backend
- ✅ JWT-equivalent auth (Sanctum token) — login, logout, me
- ✅ Task CRUD with pagination, filtering (status, priority, assigned_to), and sorting
- ✅ Role-based authorization (creator or admin can edit/delete)
- ✅ File attachment upload — validates MIME type + extension, max 10 MB
- ✅ Image thumbnail generation (300×300 cover crop using PHP GD — no extra packages)
- ✅ Authenticated file download & delete (removes physical files + thumbnails)
- ✅ Queue Job: `NotifyTaskAssigned` — sends email notification to log (MAIL_MAILER=log)
- ✅ Queue Job: `ExportTasksCsv` — exports filtered tasks to CSV with 3-retry policy
- ✅ CSV export API — dispatch, list, and download generated files

### Frontend
- ✅ Login page with token persistence (localStorage)
- ✅ Protected dashboard with sidebar layout and auto-redirect on 401
- ✅ Task list table with create / edit / delete modals
- ✅ Search (debounce 400ms), status filter, priority filter, pagination
- ✅ Drag-and-drop file upload with multi-file support and thumbnail preview
- ✅ Authenticated file download via `fetch` + Blob URL
- ✅ Real-time polling every 10s — pauses when tab is hidden, resumes on focus
- ✅ Live dot indicator that blinks on each successful poll

---

## Project Structure

```
transcosmos-task-manager/          ← monorepo root
├── README.md                      ← this file
├── backend/                       ← Laravel 12 project
│   ├── app/
│   │   ├── Http/Controllers/Api/  ← AuthController, TaskController, AttachmentController, ExportController
│   │   ├── Jobs/                  ← NotifyTaskAssigned, ExportTasksCsv
│   │   └── Models/                ← User, Task, TaskAttachment, TaskComment
│   ├── database/
│   │   ├── migrations/            ← 9 migration files
│   │   └── seeders/               ← DatabaseSeeder (1 admin + 4 members + 15 tasks + 10 comments)
│   └── routes/api.php             ← all API route definitions
├── frontend/                      ← Next.js 16 project
│   └── app/
│       ├── components/            ← AttachmentModal
│       ├── dashboard/             ← layout.tsx, page.tsx
│       ├── hooks/                 ← useAuth.ts, usePolling.ts
│       ├── lib/api.ts             ← typed fetch wrapper + all API calls
│       └── login/page.tsx
└── documentation/
    ├── architecture.md            ← system design & DB schema
    ├── setup-guide.md             ← local setup & deployment guide
    └── api-docs/
        ├── task-manager.postman_collection.json
        ├── task-manager.postman_environment.json
        └── schema.sql
```

---

## Prerequisites

| Tool | Minimum Version |
|---|---|
| PHP | 8.2+ |
| Composer | 2.x |
| MySQL | 8.0+ |
| Node.js | 18+ |
| npm | 9+ |

---

## Quick Start

### 1 — Clone the Repository

```bash
git clone https://github.com/mohef-tech/transcosmos-task-manager.git
cd transcosmos-task-manager
```

### 2 — Backend Setup

```bash
cd backend

# Install PHP dependencies
composer install

# Copy and configure environment
cp .env.example .env
# Edit .env: set DB_HOST, DB_DATABASE, DB_USERNAME, DB_PASSWORD

# Generate application key
php artisan key:generate

# Run migrations
php artisan migrate

# Seed sample data (5 users, 15 tasks, 10 comments)
php artisan db:seed

# Create storage symlink (for file downloads)
php artisan storage:link

# Start the API server
php artisan serve
# → http://localhost:8000
```

### 3 — Queue Worker (required for email notifications and CSV export)

```bash
# In a separate terminal, from the backend/ directory:
php artisan queue:work --tries=3
```

### 4 — Frontend Setup

```bash
cd frontend

# Install Node dependencies
npm install

# Configure API URL (optional — defaults to http://localhost:8000/api)
# Edit .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Start the dev server
npm run dev
# → http://localhost:3000
```

---

## Default Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@contoh.com | password |
| Member (×4) | _(generated by Faker)_ | password |

> Admin can edit and delete any task. Members can only edit/delete tasks they created.

---

## API Endpoints Summary

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Login, returns Bearer token |
| GET | `/api/auth/me` | ✅ | Current user info |
| POST | `/api/auth/logout` | ✅ | Invalidate token |
| GET | `/api/tasks` | ✅ | List tasks (filter, sort, paginate) |
| POST | `/api/tasks` | ✅ | Create task |
| GET | `/api/tasks/{id}` | ✅ | Task detail with relations |
| PUT | `/api/tasks/{id}` | ✅ | Update task (creator/admin only) |
| DELETE | `/api/tasks/{id}` | ✅ | Delete task (creator/admin only) |
| POST | `/api/tasks/{id}/attachments` | ✅ | Upload attachment |
| GET | `/api/tasks/{id}/attachments/{aid}/download` | ✅ | Download attachment |
| DELETE | `/api/tasks/{id}/attachments/{aid}` | ✅ | Delete attachment |
| POST | `/api/exports/tasks` | ✅ | Dispatch CSV export job |
| GET | `/api/exports/tasks` | ✅ | List generated CSV files |
| GET | `/api/exports/tasks/{filename}` | ✅ | Download CSV file |

Full Postman collection is available in [`documentation/api-docs/`](documentation/api-docs/).

---

## Documentation

| Document | Description |
|---|---|
| [architecture.md](documentation/architecture.md) | System architecture, DB schema, auth flow, design decisions |
| [setup-guide.md](documentation/setup-guide.md) | Detailed local setup and deployment instructions |
| [Postman Collection](documentation/api-docs/task-manager.postman_collection.json) | Import into Postman for all endpoints |
| [Postman Environment](documentation/api-docs/task-manager.postman_environment.json) | Pre-configured environment variables |
| [schema.sql](documentation/api-docs/schema.sql) | MySQL schema dump |

---

## Design Notes

- **Polling over WebSocket**: Lightweight polling (10s) was chosen for simplicity and reliability within the assessment scope. Tab-visibility API is used to pause polling when the tab is inactive, minimizing unnecessary requests.
- **Database queue**: No Redis required — the `database` driver is sufficient for assessment scale.
- **GD for thumbnails**: PHP's built-in GD extension handles 300×300 cover-crop thumbnails — zero extra Composer dependencies.
- **Quality over quantity**: Scope was kept tight to ensure every implemented feature is fully functional and well-structured.
