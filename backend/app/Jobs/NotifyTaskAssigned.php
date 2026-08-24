<?php

namespace App\Jobs;

use App\Models\Task;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class NotifyTaskAssigned implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Jumlah retry jika job gagal.
     */
    public int $tries = 3;

    public function __construct(
        public readonly Task $task,
        public readonly User $assignedUser,
    ) {}

    /**
     * Kirim notifikasi (email) ke user yang di-assign.
     * MAIL_MAILER=log → email ditulis ke storage/logs/laravel.log, tidak perlu SMTP.
     */
    public function handle(): void
    {
        $task        = $this->task;
        $assignedTo  = $this->assignedUser;

        // Log sebagai simulasi email (driver = log)
        Log::channel('single')->info('[NotifyTaskAssigned] Email notification sent', [
            'to'       => $assignedTo->email,
            'task_id'  => $task->id,
            'task'     => $task->title,
            'due_date' => $task->due_date,
        ]);

        // Kirim via Mailable (MAIL_MAILER=log akan tulis ke laravel.log)
        Mail::raw(
            "Halo {$assignedTo->name},\n\n"
            . "Anda baru saja di-assign ke task: \"{$task->title}\"\n"
            . ($task->due_date ? "Due date: {$task->due_date}\n" : '')
            . "\nSilakan login untuk melihat detail task.\n\n"
            . "— Task Manager",
            function ($message) use ($assignedTo, $task) {
                $message
                    ->to($assignedTo->email, $assignedTo->name)
                    ->subject("[Task Manager] Task assigned: {$task->title}");
            }
        );
    }

    /**
     * Handle job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('[NotifyTaskAssigned] Job failed', [
            'task_id' => $this->task->id,
            'error'   => $exception->getMessage(),
        ]);
    }
}
