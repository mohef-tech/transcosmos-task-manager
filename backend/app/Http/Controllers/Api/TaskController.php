<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\NotifyTaskAssigned;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TaskController extends Controller
{
    /**
     * GET /api/tasks
     * List semua task dengan pagination, filter, dan sort.
     *
     * Query params:
     *   - status       : todo | in_progress | done
     *   - priority     : low | medium | high
     *   - assigned_to  : user_id
     *   - sort_by      : due_date | priority | created_at (default: created_at)
     *   - sort_dir     : asc | desc (default: desc)
     *   - per_page     : integer (default: 15)
     */
    public function index(Request $request)
    {
        $query = Task::with([
            'assignedUser:id,name,email,role',
            'creator:id,name,email,role',
        ]);

        // --- Filter ---
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }

        if ($request->filled('assigned_to')) {
            $query->where('assigned_user_id', $request->assigned_to);
        }

        // --- Sort ---
        $sortBy  = in_array($request->sort_by, ['due_date', 'priority', 'created_at'])
            ? $request->sort_by
            : 'created_at';

        $sortDir = in_array($request->sort_dir, ['asc', 'desc'])
            ? $request->sort_dir
            : 'desc';

        // priority enum sort: high > medium > low
        if ($sortBy === 'priority') {
            $query->orderByRaw("FIELD(priority, 'high', 'medium', 'low') " . ($sortDir === 'asc' ? 'DESC' : 'ASC'));
        } else {
            $query->orderBy($sortBy, $sortDir);
        }

        $perPage = (int) $request->get('per_page', 15);
        $perPage = min(max($perPage, 1), 100); // clamp 1–100

        $tasks = $query->paginate($perPage);

        return response()->json($tasks);
    }

    /**
     * POST /api/tasks
     * Buat task baru. created_by otomatis diisi dari user yang login.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title'            => 'required|string|max:255',
            'description'      => 'nullable|string',
            'status'           => 'nullable|in:todo,in_progress,done',
            'priority'         => 'nullable|in:low,medium,high',
            'assigned_user_id' => 'nullable|exists:users,id',
            'due_date'         => 'nullable|date|after_or_equal:today',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $task = Task::create([
            'title'            => $request->title,
            'description'      => $request->description,
            'status'           => $request->status ?? 'todo',
            'priority'         => $request->priority ?? 'medium',
            'assigned_user_id' => $request->assigned_user_id,
            'due_date'         => $request->due_date,
            'created_by'       => $request->user()->id,
        ]);

        $task->load('assignedUser:id,name,email,role', 'creator:id,name,email,role');

        // Dispatch notifikasi ke assigned user (jika di-set)
        if ($task->assigned_user_id) {
            $assignedUser = User::find($task->assigned_user_id);
            if ($assignedUser) {
                NotifyTaskAssigned::dispatch($task, $assignedUser);
            }
        }

        return response()->json($task, 201);
    }

    /**
     * GET /api/tasks/{id}
     * Detail satu task beserta relasi.
     */
    public function show($id)
    {
        $task = Task::with([
            'assignedUser:id,name,email,role',
            'creator:id,name,email,role',
            'attachments',
            'comments.user:id,name,role',
        ])->findOrFail($id);

        return response()->json($task);
    }

    /**
     * PUT /api/tasks/{id}
     * Update task. Hanya creator atau admin yang boleh.
     */
    public function update(Request $request, $id)
    {
        $task = Task::findOrFail($id);
        $user = $request->user();

        // Authorization: hanya creator atau admin
        if ($task->created_by !== $user->id && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validator = Validator::make($request->all(), [
            'title'            => 'sometimes|required|string|max:255',
            'description'      => 'nullable|string',
            'status'           => 'sometimes|in:todo,in_progress,done',
            'priority'         => 'sometimes|in:low,medium,high',
            'assigned_user_id' => 'nullable|exists:users,id',
            'due_date'         => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $task->update($request->only([
            'title', 'description', 'status',
            'priority', 'assigned_user_id', 'due_date',
        ]));

        $task->load('assignedUser:id,name,email,role', 'creator:id,name,email,role');

        // Dispatch notifikasi jika assigned_user_id berubah
        if ($request->has('assigned_user_id') && $task->assigned_user_id) {
            $assignedUser = User::find($task->assigned_user_id);
            if ($assignedUser) {
                NotifyTaskAssigned::dispatch($task, $assignedUser);
            }
        }

        return response()->json($task);
    }

    /**
     * DELETE /api/tasks/{id}
     * Hapus task. Hanya creator atau admin yang boleh.
     */
    public function destroy(Request $request, $id)
    {
        $task = Task::findOrFail($id);
        $user = $request->user();

        // Authorization: hanya creator atau admin
        if ($task->created_by !== $user->id && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $task->delete();

        return response()->json(['message' => 'Task deleted successfully']);
    }
}
