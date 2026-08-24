<?php

namespace Database\Factories;

use App\Models\Task;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Task>
 */
class TaskFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
        'title' => fake()->sentence(4),
        'description' => fake()->paragraph(),
        'status' => fake()->randomElement(['todo', 'in_progress', 'done']),
        'priority' => fake()->randomElement(['low', 'medium', 'high']),
        'assigned_user_id' => \App\Models\User::inRandomOrder()->first()->id,
        'created_by' => \App\Models\User::inRandomOrder()->first()->id,
        'due_date' => fake()->dateTimeBetween('now', '+1 month'),
    ];
    }
}
