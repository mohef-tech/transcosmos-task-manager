<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ExportTasksCsv;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ExportController extends Controller
{
    /**
     * POST /api/exports/tasks
     *
     * Dispatch job export CSV ke queue. Job akan simpan file ke storage/app/exports/.
     * Body (semua opsional):
     *   - status      : todo | in_progress | done
     *   - priority    : low | medium | high
     *   - assigned_to : user_id
     */
    public function exportTasks(Request $request)
    {
        $filters = array_filter([
            'status'      => $request->input('status'),
            'priority'    => $request->input('priority'),
            'assigned_to' => $request->input('assigned_to'),
        ]);

        ExportTasksCsv::dispatch($request->user()->id, $filters);

        return response()->json([
            'message' => 'Export job dispatched. File will be available in storage/exports/ shortly.',
            'filters' => $filters ?: 'none (all tasks)',
        ], 202);
    }

    /**
     * GET /api/exports/tasks
     *
     * List file CSV yang sudah di-generate.
     */
    public function listExports(Request $request)
    {
        $files = Storage::files('exports');

        $result = collect($files)
            ->filter(fn($f) => str_ends_with($f, '.csv'))
            ->map(fn($f) => [
                'filename'     => basename($f),
                'size_bytes'   => Storage::size($f),
                'generated_at' => date('Y-m-d H:i:s', Storage::lastModified($f)),
                'download_url' => url('/api/exports/tasks/' . basename($f)),
            ])
            ->sortByDesc('generated_at')
            ->values();

        return response()->json($result);
    }

    /**
     * GET /api/exports/tasks/{filename}
     *
     * Download file CSV yang sudah di-generate.
     */
    public function downloadExport(string $filename)
    {
        // Sanitasi nama file (cegah path traversal)
        $filename = basename($filename);
        $path     = "exports/{$filename}";

        if (!Storage::exists($path)) {
            return response()->json(['message' => 'Export file not found'], 404);
        }

        return Storage::download($path, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }
}
