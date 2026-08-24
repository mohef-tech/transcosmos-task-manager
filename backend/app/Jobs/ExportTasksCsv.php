<?php

namespace App\Jobs;

use App\Models\Task;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ExportTasksCsv implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Jumlah retry jika job gagal.
     */
    public int $tries = 3;

    public function __construct(
        public readonly int    $requestedByUserId,
        public readonly array  $filters = [],   // [status, priority, assigned_to]
    ) {}

    /**
     * Generate CSV dari tasks sesuai filter, simpan di storage/app/exports/.
     * Nama file: tasks_export_{timestamp}_{userId}.csv
     */
    public function handle(): void
    {
        $query = Task::with('assignedUser:id,name,email', 'creator:id,name,email');

        // Terapkan filter yang dikirim
        if (!empty($this->filters['status'])) {
            $query->where('status', $this->filters['status']);
        }
        if (!empty($this->filters['priority'])) {
            $query->where('priority', $this->filters['priority']);
        }
        if (!empty($this->filters['assigned_to'])) {
            $query->where('assigned_user_id', $this->filters['assigned_to']);
        }

        $tasks = $query->orderBy('created_at', 'desc')->get();

        // Build CSV content
        $header = ['ID', 'Title', 'Description', 'Status', 'Priority',
                   'Assigned To', 'Created By', 'Due Date', 'Created At'];

        $rows = $tasks->map(fn(Task $t) => [
            $t->id,
            $t->title,
            str_replace(["\r\n", "\n", "\r", ','], [' ', ' ', ' ', ';'], $t->description ?? ''),
            $t->status,
            $t->priority,
            $t->assignedUser?->name ?? '-',
            $t->creator?->name ?? '-',
            $t->due_date ?? '-',
            $t->created_at->format('Y-m-d H:i:s'),
        ]);

        $csvLines = collect([$header])->merge($rows)->map(
            fn($row) => implode(',', array_map(
                fn($cell) => '"' . str_replace('"', '""', $cell) . '"',
                $row
            ))
        )->join("\n");

        // Simpan ke storage/app/exports/
        $filename = 'tasks_export_' . now()->format('Ymd_His') . '_user' . $this->requestedByUserId . '.csv';
        $path     = "exports/{$filename}";

        Storage::put($path, $csvLines);

        Log::channel('single')->info('[ExportTasksCsv] CSV exported', [
            'file'       => $path,
            'rows'       => $tasks->count(),
            'filters'    => $this->filters,
            'requested_by' => $this->requestedByUserId,
        ]);
    }

    /**
     * Handle job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('[ExportTasksCsv] Job failed', [
            'requested_by' => $this->requestedByUserId,
            'error'        => $exception->getMessage(),
        ]);
    }
}
