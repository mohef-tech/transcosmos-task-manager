<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskAttachment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Laravel\Facades\Image;

class AttachmentController extends Controller
{
    /**
     * Tipe file yang diizinkan beserta ukuran max (10MB).
     */
    private const ALLOWED_MIME_TYPES = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv',
        'application/zip',
    ];

    private const MAX_FILE_SIZE_KB = 10240; // 10 MB

    /**
     * POST /api/tasks/{task}/attachments
     * Upload file ke task tertentu. Jika gambar, buat thumbnail 300×300.
     */
    public function store(Request $request, $taskId)
    {
        $task = Task::findOrFail($taskId);

        $request->validate([
            'file' => [
                'required',
                'file',
                'max:' . self::MAX_FILE_SIZE_KB,
                'mimes:jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,txt,csv,zip',
                'mimetypes:image/jpeg,image/png,image/gif,image/webp,'
                    . 'application/pdf,'
                    . 'application/msword,'
                    . 'application/vnd.openxmlformats-officedocument.wordprocessingml.document,'
                    . 'application/vnd.ms-excel,'
                    . 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,'
                    . 'text/plain,text/csv,'
                    . 'application/zip',
            ],
        ]);

        $file     = $request->file('file');
        $mime     = $file->getMimeType();
        $origName = $file->getClientOriginalName();
        $ext      = $file->getClientOriginalExtension();
        $safeName = Str::uuid() . '.' . $ext;

        // Simpan file asli di storage/app/public/attachments/{task_id}/
        $folder   = "attachments/{$taskId}";
        $path     = $file->storeAs($folder, $safeName, 'public');

        // Generate thumbnail jika file adalah gambar
        $thumbnailPath = null;
        if (str_starts_with($mime, 'image/')) {
            $thumbnailPath = $this->generateThumbnail($file, $folder, $safeName);
        }

        $attachment = TaskAttachment::create([
            'task_id'        => $task->id,
            'file_name'      => $origName,
            'file_path'      => $path,
            'thumbnail_path' => $thumbnailPath,
            'file_size'      => $file->getSize(),
            'mime_type'      => $mime,
            'uploaded_at'    => now(),
        ]);

        return response()->json($this->formatAttachment($attachment), 201);
    }

    /**
     * GET /api/tasks/{task}/attachments/{attachment}/download
     * Download file langsung.
     */
    public function download($taskId, $attachmentId)
    {
        $attachment = TaskAttachment::where('task_id', $taskId)
            ->findOrFail($attachmentId);

        if (!Storage::disk('public')->exists($attachment->file_path)) {
            return response()->json(['message' => 'File not found on disk'], 404);
        }

        return Storage::disk('public')->download(
            $attachment->file_path,
            $attachment->file_name
        );
    }

    /**
     * DELETE /api/tasks/{task}/attachments/{attachment}
     * Hapus attachment beserta file fisiknya dan thumbnail-nya.
     */
    public function destroy($taskId, $attachmentId)
    {
        $attachment = TaskAttachment::where('task_id', $taskId)
            ->findOrFail($attachmentId);

        // Hapus file fisik
        Storage::disk('public')->delete($attachment->file_path);

        // Hapus thumbnail jika ada
        if ($attachment->thumbnail_path) {
            Storage::disk('public')->delete($attachment->thumbnail_path);
        }

        $attachment->delete();

        return response()->json(['message' => 'Attachment deleted successfully']);
    }

    // ─────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────

    /**
     * Buat thumbnail 300×300 (cover crop) menggunakan GD bawaan PHP.
     * Tidak perlu library eksternal.
     */
    private function generateThumbnail($file, string $folder, string $safeName): ?string
    {
        try {
            $mime      = $file->getMimeType();
            $sourcePath = $file->getRealPath();

            // Buat GD resource dari file asli
            $source = match ($mime) {
                'image/jpeg' => imagecreatefromjpeg($sourcePath),
                'image/png'  => imagecreatefrompng($sourcePath),
                'image/gif'  => imagecreatefromgif($sourcePath),
                'image/webp' => imagecreatefromwebp($sourcePath),
                default      => null,
            };

            if (!$source) return null;

            [$srcW, $srcH] = getimagesize($sourcePath);
            $thumbSize = 300;

            // Hitung crop square dari tengah
            $srcMin  = min($srcW, $srcH);
            $srcX    = (int)(($srcW - $srcMin) / 2);
            $srcY    = (int)(($srcH - $srcMin) / 2);

            $thumb = imagecreatetruecolor($thumbSize, $thumbSize);

            // Preserve transparency untuk PNG & GIF
            if (in_array($mime, ['image/png', 'image/gif'])) {
                imagealphablending($thumb, false);
                imagesavealpha($thumb, true);
                $transparent = imagecolorallocatealpha($thumb, 0, 0, 0, 127);
                imagefilledrectangle($thumb, 0, 0, $thumbSize, $thumbSize, $transparent);
            }

            imagecopyresampled($thumb, $source, 0, 0, $srcX, $srcY, $thumbSize, $thumbSize, $srcMin, $srcMin);

            // Simpan sebagai JPEG dengan prefix thumb_
            $thumbName = 'thumb_' . pathinfo($safeName, PATHINFO_FILENAME) . '.jpg';
            $thumbRelPath = "{$folder}/{$thumbName}";
            $thumbAbsPath = Storage::disk('public')->path($thumbRelPath);

            // Pastikan direktori ada
            @mkdir(dirname($thumbAbsPath), 0755, true);

            imagejpeg($thumb, $thumbAbsPath, 80);
            imagedestroy($source);
            imagedestroy($thumb);

            return $thumbRelPath;
        } catch (\Throwable $e) {
            // Thumbnail gagal tidak boleh block upload
            return null;
        }
    }

    /**
     * Format response attachment dengan URL publik.
     */
    private function formatAttachment(TaskAttachment $attachment): array
    {
        return [
            'id'             => $attachment->id,
            'task_id'        => $attachment->task_id,
            'file_name'      => $attachment->file_name,
            'file_size'      => $attachment->file_size,
            'mime_type'      => $attachment->mime_type,
            'url'            => Storage::disk('public')->url($attachment->file_path),
            'thumbnail_url'  => $attachment->thumbnail_path
                ? Storage::disk('public')->url($attachment->thumbnail_path)
                : null,
            'uploaded_at'    => $attachment->uploaded_at,
        ];
    }
}
