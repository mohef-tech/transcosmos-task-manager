<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\ExportController;

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Task CRUD
    Route::apiResource('tasks', TaskController::class);

    // Attachment: upload, download, delete
    Route::post('/tasks/{task}/attachments', [AttachmentController::class, 'store']);
    Route::get('/tasks/{task}/attachments/{attachment}/download', [AttachmentController::class, 'download']);
    Route::delete('/tasks/{task}/attachments/{attachment}', [AttachmentController::class, 'destroy']);

    // Export CSV
    Route::post('/exports/tasks', [ExportController::class, 'exportTasks']);
    Route::get('/exports/tasks', [ExportController::class, 'listExports']);
    Route::get('/exports/tasks/{filename}', [ExportController::class, 'downloadExport']);
});
