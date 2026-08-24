# Setup Guide

> Step-by-step guide to run the Transcosmos Task Manager locally. Estimated setup time: **10–15 minutes**.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Clone the Repository](#clone-the-repository)
3. [Backend Setup (Laravel 12)](#backend-setup-laravel-12)
4. [Frontend Setup (Next.js 16)](#frontend-setup-nextjs-16)
5. [Running the Queue Worker](#running-the-queue-worker)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Default Accounts](#default-accounts)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Ensure all of the following tools are installed before starting:

| Tool | Minimum Version | Check Command |
|---|---|---|
| PHP | 8.2+ | `php -v` |
| Composer | 2.x | `composer -V` |
| MySQL | 8.0+ | `mysql --version` |
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |

> **PHP Extensions required:** `pdo_mysql`, `gd`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`
>
> Verify GD is enabled: `php -r "echo function_exists('imagecreatefromstring') ? 'GD OK' : 'GD MISSING';"`

---

## Clone the Repository

```bash
git clone https://github.com/mohef-tech/transcosmos-task-manager.git
cd transcosmos-task-manager
```

Folder structure after cloning:

```
transcosmos-task-manager/
├── backend/          ← Laravel 12 project
├── frontend/         ← Next.js 16 project
├── documentation/    ← architecture, setup guide, API docs
└── README.md
```

---

## Backend Setup (Laravel 12)

All commands below are run from inside the `backend/` directory.

### Step 1 — Install PHP dependencies

```bash
cd backend
composer install
```

### Step 2 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in your MySQL credentials:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=transcosmos_task_manager
DB_USERNAME=root
DB_PASSWORD=your_password_here
```

> **Default `.env.example` uses SQLite.** You must change `DB_CONNECTION=sqlite` to `DB_CONNECTION=mysql` and uncomment the DB_* lines.

### Step 3 — Create the database

Log into MySQL and create the database:

```sql
CREATE DATABASE transcosmos_task_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Or via CLI:

```bash
mysql -u root -p -e "CREATE DATABASE transcosmos_task_manager CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### Step 4 — Generate application key

```bash
php artisan key:generate
```

### Step 5 — Run migrations

```bash
php artisan migrate
```

Expected output: 9 migration files applied (users, cache, jobs, personal_access_tokens, role on users, tasks, task_attachments, task_comments, thumbnail on task_attachments).

### Step 6 — Seed sample data

```bash
php artisan db:seed
```

This creates:
- **1 admin** user (`admin@contoh.com` / `password`)
- **4 member** users (Faker-generated emails / `password`)
- **15 tasks** with random status, priority, and assignments
- **10 comments** on various tasks

### Step 7 — Create storage symlink

```bash
php artisan storage:link
```

> This creates a `public/storage` symlink so that files in `storage/app/public` are web-accessible. Required for thumbnail serving.

### Step 8 — Start the API server

```bash
php artisan serve
```

API is now available at: **http://localhost:8000**

You can verify: `curl http://localhost:8000/api/auth/login` → should return 422 (validation error, which confirms the route exists).

---

## Frontend Setup (Next.js 16)

All commands below are run from inside the `frontend/` directory.

### Step 1 — Install Node dependencies

```bash
cd frontend
npm install
```

### Step 2 — Configure API URL

Create `.env.local` (already exists in the repo):

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

> If your backend runs on a different host or port, update this value accordingly.

### Step 3 — Start the development server

```bash
npm run dev
```

Frontend is now available at: **http://localhost:3000**

The login page loads automatically at `http://localhost:3000/login`.

---

## Running the Queue Worker

The queue worker is **required** for:
- Email notifications when a task is assigned (`NotifyTaskAssigned` job)
- CSV export generation (`ExportTasksCsv` job)

Open a **separate terminal**, navigate to `backend/`, and run:

```bash
php artisan queue:work --tries=3
```

> **Keep this process running** alongside `php artisan serve` and `npm run dev`.
>
> Email notifications are written to `storage/logs/laravel.log` (MAIL_MAILER=log). You can tail the log:
> ```bash
> tail -f storage/logs/laravel.log
> ```

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `Laravel` | Application name |
| `APP_ENV` | `local` | Environment: `local`, `production` |
| `APP_KEY` | _(generated)_ | 32-char encryption key — **never share** |
| `APP_DEBUG` | `true` | Show debug errors; set `false` in production |
| `APP_URL` | `http://localhost` | Base URL of the app |
| `DB_CONNECTION` | `mysql` | Database driver (change from default `sqlite`) |
| `DB_HOST` | `127.0.0.1` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_DATABASE` | — | Database name (create manually) |
| `DB_USERNAME` | `root` | MySQL username |
| `DB_PASSWORD` | — | MySQL password |
| `QUEUE_CONNECTION` | `database` | Queue driver (`database` — no Redis needed) |
| `FILESYSTEM_DISK` | `local` | Storage disk for attachments |
| `MAIL_MAILER` | `log` | Mail driver — `log` writes to laravel.log |
| `MAIL_FROM_ADDRESS` | `hello@example.com` | Sender email address |
| `LOG_CHANNEL` | `stack` | Logging channel |
| `LOG_LEVEL` | `debug` | Log verbosity |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api` | Laravel API base URL |

---

## Default Accounts

| Role | Email | Password | Permissions |
|---|---|---|---|
| Admin | `admin@contoh.com` | `password` | Can create, edit, delete **any** task |
| Member (×4) | _(Faker-generated)_ | `password` | Can edit/delete only tasks **they created** |

> To see member emails, check the database: `SELECT email, role FROM users;`

---

## Troubleshooting

### `php artisan storage:link` fails — "link already exists"

```bash
rm public/storage
php artisan storage:link
```

### Attachments / thumbnails not showing

1. Confirm `storage:link` was run successfully.
2. Check that `storage/app/attachments/` and `storage/app/thumbnails/` directories exist:
   ```bash
   ls storage/app/
   ```
3. Verify `FILESYSTEM_DISK=local` is set in `.env`.

### Queue jobs not processing

Ensure the queue worker is running:

```bash
php artisan queue:work --tries=3
```

Check for failed jobs:

```bash
php artisan queue:failed
```

Retry failed jobs:

```bash
php artisan queue:retry all
```

### CORS error from frontend

Ensure your backend `.env` has:

```dotenv
APP_URL=http://localhost:8000
```

Check `config/cors.php` — `allowed_origins` should include `http://localhost:3000`. If you changed the frontend port, update accordingly.

### `Class "GD\Image" not found` / thumbnail fails

PHP GD extension is not installed. Install it:

```bash
# Ubuntu / Debian
sudo apt install php8.2-gd

# macOS (Homebrew)
brew install php
# GD is included by default in Homebrew PHP builds

# Verify:
php -r "echo function_exists('imagecreatefromstring') ? 'GD OK' : 'GD MISSING';"
```

### Login always returns 401

1. Confirm the database is seeded: `php artisan db:seed`
2. Confirm you are using the correct credentials: `admin@contoh.com` / `password`
3. Confirm Sanctum is installed: `php artisan migrate` should have created the `personal_access_tokens` table.

### Port conflict on 8000 or 3000

```bash
# Change backend port
php artisan serve --port=8001

# Change frontend port
npm run dev -- --port 3001
```

Remember to update `NEXT_PUBLIC_API_URL` in `frontend/.env.local` if you change the backend port.

### `npm install` fails on Node version mismatch

This project requires Node.js 18+. Use `nvm` to switch versions:

```bash
nvm install 18
nvm use 18
node -v   # should print v18.x.x
```
