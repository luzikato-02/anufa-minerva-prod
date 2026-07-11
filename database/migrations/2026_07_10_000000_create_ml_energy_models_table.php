<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ml_energy_models', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('model_type', 20);
            $table->decimal('r2_score', 6, 4)->nullable();
            $table->decimal('cv_r2_score', 6, 4)->nullable();
            $table->decimal('rmse', 8, 4)->nullable();
            $table->decimal('mae', 8, 4)->nullable();
            $table->unsignedInteger('training_samples')->nullable();
            $table->string('model_file', 255)->nullable();
            $table->foreignId('trained_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ml_energy_models');
    }
};
