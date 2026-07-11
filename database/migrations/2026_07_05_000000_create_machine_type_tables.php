<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('machine_types', function (Blueprint $table) {
            $table->id();
            $table->string('type_name')->unique();
            $table->unsignedInteger('total_spindles');
            $table->unsignedInteger('rpm_min')->nullable();
            $table->unsignedInteger('rpm_max')->nullable();
            $table->decimal('min_runtime_hours', 6, 3)->nullable();
            $table->decimal('max_runtime_hours', 6, 3)->nullable();
            $table->string('description')->nullable();
            $table->timestamps();
        });

        Schema::create('machine_definitions', function (Blueprint $table) {
            $table->id();
            $table->string('machine_number')->unique();
            $table->foreignId('machine_type_id')->constrained('machine_types')->restrictOnDelete();
            $table->boolean('is_active')->default(true);
            $table->string('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('machine_definitions');
        Schema::dropIfExists('machine_types');
    }
};
