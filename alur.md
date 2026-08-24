# PRD & Alur Kerja — Technical Assessment Transcosmos

## Task Management Platform

## 1. Ringkasan

- **Deadline**: hari ini (reply all email dengan hasil)
- **Estimasi kerja**: 4-6 jam
- **Prinsip utama**: MVP solid & rapi > fitur lengkap tapi berantakan (sesuai _Technical Notes_ di instruksi resmi: _"Quality over quantity"_)

## 2. Tech Stack

| Layer        | Pilihan                                  | Alasan                                                                                                                                                               |
| ------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend      | Laravel **12.x** (pinned)                | Auth, Queue, File Storage, Migration jadi satu paket cepat; versi 13 baru rilis 2026 (di luar training data), 12 lebih aman & masih dapat security fix s.d. Feb 2027 |
| Database     | MySQL (lokal via Homebrew)               | Sesuai requirement; environment sebelumnya kosong (biasa pakai Supabase), jadi install MySQL lokal + `brew services start mysql`                                     |
| Auth         | Laravel Sanctum                          | Setara JWT, native Laravel                                                                                                                                           |
| Frontend     | Next.js (App Router, CSR) + Tailwind CSS | Sinyal dari interviewer soal React; CSR dipilih supaya tidak overhead SSR                                                                                            |
| Queue        | Laravel Queue, driver `database`         | Tanpa Redis, setup lebih cepat                                                                                                                                       |
| File storage | Local disk (Laravel Storage)             | Cukup untuk assessment, tidak perlu cloud storage                                                                                                                    |

**Struktur folder (monorepo):**

```
transcosmos-task-manager/        ← project root (~/Projects/transcosmos-task-manager)
├── backend/                     ← Laravel 12 project
├── frontend/                    ← Next.js project
├── README.md
└── documentation/
    ├── api-docs/
    ├── architecture.md
    └── setup-guide.md
```

## 3. Scope Keputusan

### ✅ Masuk (wajib dikerjakan)

| Modul                                                            | Bagian Brief                | Catatan                                               |
| ---------------------------------------------------------------- | --------------------------- | ----------------------------------------------------- |
| DB Schema + Migration + Seeder                                   | 1.1                         | users, tasks, task_attachments, task_comments + index |
| Auth API (login/logout/me)                                       | 1.2                         | Sanctum token                                         |
| Task CRUD API + pagination/filter/sort                           | 1.2                         |                                                       |
| Upload/download/delete attachment                                | 1.3                         | Validasi tipe & ukuran, thumbnail untuk image         |
| Queue: notifikasi assign task                                    | 1.4                         | Mail driver `log` (tidak perlu SMTP asli)             |
| Queue: export CSV                                                | 1.4                         | Job sederhana                                         |
| Frontend: login, dashboard CRUD, upload drag-drop                | 2.2                         | Next.js                                               |
| Real-time task update                                            | 2.2 — **Core, bukan bonus** | Polling ringan / SSE, bukan full WebSocket            |
| README + Postman collection + architecture.md + deployment guide | 4.1                         |                                                       |

### ❌ Di luar scope (skip demi waktu)

- Video streaming & adaptive quality (3.1)
- Full WebSocket + presence + typing indicator (3.2 — versi dasar real-time tetap jalan, ini yang di-skip cuma fitur "mewah"-nya)
- Redis/Memcached caching (3.3)
- Virus scan asli, chunked upload >50MB, file versioning (1.3 advanced)
- Testing lengkap (hanya unit test untuk logic penting)
- 2FA/OAuth, i18n, microservices

## 4. Catatan Koreksi dari Draft Sebelumnya

- Draft rencana (dari AI lain) ~85-90% akurat, sejalan dengan strategi MVP.
- Yang terlewat: real-time update sebenarnya _Core Feature_, bukan bonus — tetap dikerjakan versi ringan.
- Dokumentasi resmi ada 5 item, draft sebelumnya hanya cover 2 (README + Postman) — architecture.md & deployment guide ditambahkan di sini.

## 5. Alur Eksekusi

1. Setup project Laravel + koneksi DB
2. Migration + model + relasi
3. Seeder (5 user, 15 task, 10 comment)
4. Auth API (Sanctum)
5. Task CRUD API
6. File upload API + thumbnail
7. Queue job (notifikasi assign + export CSV)
8. Setup Next.js + Tailwind
9. Frontend: login page
10. Frontend: dashboard (list, create, edit, delete task)
11. Frontend: upload file (drag-drop)
12. Real-time update (polling/SSE)
13. Dokumentasi (README, Postman, architecture.md, deployment guide)
14. Final check & submit

## 6. Progress Tracker

- [x] 1. Setup Laravel + DB
- [x] 2. Migration & Model
- [x] 3. Seeder
- [x] 4. Auth API — login ✅ | me ✅ | logout ✅ (token invalidated, 401 confirmed)
- [x] 5. Task CRUD API — index ✅ | store ✅ | show ✅ | update ✅ | destroy ✅ (+ filter, sort, pagination)
- [x] 6. File Upload API — upload ✅ | thumbnail (GD) ✅ | download ✅ | delete ✅ (validasi mime+ext, max 10MB)
- [x] 7. Queue Jobs — NotifyTaskAssigned ✅ (email ke log) | ExportTasksCsv ✅ (CSV tersimpan, list+download endpoint jalan)
- [x] 8. Setup Next.js — `create-next-app` ✅ | TypeScript ✅ | Tailwind CSS ✅ | App Router ✅ (359 packages, 0 vulnerabilities)
- [x] 9. Login Page — form login ✅ | token localStorage ✅ | redirect dashboard ✅
- [x] 10. Dashboard CRUD — list ✅ | create ✅ | edit ✅ | delete ✅ | search + filter + pagination ✅
- [x] 11. Upload UI — DropZone drag-drop ✅ | multi-file upload ✅ | thumbnail preview ✅ | download (auth header) ✅ | delete ✅
- [x] 12. Real-time Update — polling 10s ✅ | pause on hidden tab ✅ | resume on focus ✅ | live dot indicator ✅
- [ ] 13. Dokumentasi
- [ ] 14. Submit

**Status saat ini: Step 8–12 selesai — Frontend lengkap (login, dashboard CRUD, upload drag-drop, real-time polling). Siap ke Step 13 (Dokumentasi).**

---

## 7. Analisa Masalah & Rencana Lanjutan

### 🔍 Masalah: Login dengan kredensial benar muncul "teks buanyak"

**Root Cause — Bukan bug logic, tapi masalah response serialization:**

Ketika login berhasil, `AuthController::login()` mengembalikan:
```php
return response()->json([
    'user' => $user,   // ← seluruh object User di-dump
    'token' => $token,
]);
```

Yang terjadi saat `$user` di-serialize ke JSON:
1. **`$hidden` tidak include `role`** — field `role` ada di DB (ditambah via migration `add_role_to_users_table`), tapi di `User.php` fillable hanya `['name', 'email', 'password']` → field `role` **tidak ada di fillable**, sehingga saat factory membuat user dengan `'role' => 'admin'`, field ini masuk DB tapi bisa muncul mentah saat di-serialize
2. **Laravel debug mode aktif (`APP_DEBUG=true`)** — jika ada warning/notice dari PHP (misal: model belum cache, atau ada eager loading yang tidak terdefinisi), Laravel bisa menyisipkan teks debug atau stacktrace sebagai HTML/plaintext sebelum JSON body
3. **SESSION_DRIVER=database** — setiap request login memicu penulisan session ke tabel `sessions`, yang bisa menghasilkan output SQL debug jika `APP_DEBUG=true` dan ada query yang lambat atau gagal
4. **Kemungkinan terbesar**: Response JSON valid, tapi terminal/tool yang dipakai (misal `curl` tanpa `-H "Accept: application/json"`) menerima response HTML dari Laravel exception handler alih-alih JSON murni — sehingga terlihat "banyak teks" (HTML stacktrace)

**Bukti pendukung:**
- Skenario salah kredensial → `{"message":"Invalid credentials"}` keluar rapi ✅ (karena return 401 sebelum menyentuh model/session)
- Skenario benar → melalui `Auth::attempt()` + `createToken()` + serialize `$user` → lebih banyak operasi DB, lebih rentan trigger debug output

---

### ✅ Tindakan yang perlu dilakukan (urut prioritas)

#### Fix 1 — Tambahkan `Accept: application/json` header di setiap request test
```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email":"admin@contoh.com","password":"password"}'
```
Header `Accept: application/json` memaksa Laravel mengembalikan error dalam format JSON, bukan HTML.

#### Fix 2 — Tambahkan `role` ke `$fillable` di `User.php`
File: `app/Models/User.php`
```php
protected $fillable = [
    'name',
    'email',
    'password',
    'role',   // ← tambahkan ini
];
```
Tanpa ini, `role` tidak akan muncul di response user dan seeder bisa berperilaku tidak konsisten.

#### Fix 3 — Bersihkan response login, return hanya field yang dibutuhkan
Di `AuthController::login()`, ganti:
```php
'user' => $user,
```
Menjadi:
```php
'user' => [
    'id'    => $user->id,
    'name'  => $user->name,
    'email' => $user->email,
    'role'  => $user->role,
],
```
Ini mencegah field sensitif atau tidak relevan ikut ter-dump.

#### Fix 4 — Pastikan `HasApiTokens` sudah di-use di User model
Sanctum membutuhkan trait ini. Cek `User.php`:
```php
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;
```

---

### 🗺️ Rencana Setelah Fix Auth Terkonfirmasi

Setelah login berhasil dan response bersih terkonfirmasi, urutan lanjutan:

| Step | Task | File/Command |
|------|------|--------------|
| ✅ 7 | Queue Jobs done | `NotifyTaskAssigned`, `ExportTasksCsv` |
| **8** | **Setup Next.js + Tailwind** | `frontend/` — `npx create-next-app` |
| 9 | Login page frontend | `frontend/app/login/page.tsx` |
| 10 | Dashboard CRUD frontend | `frontend/app/dashboard/` |
| 11 | Upload UI drag-drop | komponen `DropZone` |
| 12 | Real-time update (polling/SSE) | `useTaskPolling` hook |
| 13 | Dokumentasi lengkap | README, Postman, architecture.md |
| 14 | Final check & submit | — |
