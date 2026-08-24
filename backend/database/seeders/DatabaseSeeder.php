<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
{
    \App\Models\User::factory()->create([
        'name' => 'Admin User',
        'email' => 'admin@contoh.com',
        'role' => 'admin',
        'password' => bcrypt('password'),
    ]);

    \App\Models\User::factory(4)->create([
        'role' => 'member',
        'password' => bcrypt('password'),
    ]);

    \App\Models\Task::factory(15)->create();

    \App\Models\TaskComment::factory(10)->create();
}
}
