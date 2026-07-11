<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('runtime_upload_batches', function (Blueprint $table) {
            $table->id();
            $table->string('file_name');
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->unsignedInteger('row_count')->default(0);
            $table->unsignedInteger('skipped_count')->default(0);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('runtime_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('upload_batch_id')->constrained('runtime_upload_batches')->cascadeOnDelete();
            $table->string('machine_id', 10);
            $table->string('machine_number', 8);
            $table->char('side', 1)->nullable();
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->date('date');
            $table->unsignedTinyInteger('shift');
            $table->string('style_description')->nullable();
            $table->decimal('runtime_hours', 8, 3);
            $table->decimal('actual_runtime_hours', 10, 5)->nullable();
            $table->unsignedInteger('rpm');
            $table->foreignId('machine_definition_id')->nullable()->constrained('machine_definitions')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();

            $table->unique(['machine_id', 'date', 'shift'], 'unique_machine_id_date_shift');
            $table->index(['machine_number', 'date']);
            $table->index(['year', 'month']);
            $table->index('upload_batch_id');
        });

        Schema::create('runtime_shift_aggregates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('upload_batch_id')->constrained('runtime_upload_batches')->cascadeOnDelete();
            $table->string('machine_number');
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->date('date');
            $table->unsignedTinyInteger('shift');
            $table->decimal('total_runtime_hours', 8, 3);
            $table->decimal('actual_machine_runtime', 10, 5)->nullable();
            $table->decimal('avg_rpm', 8, 2);
            $table->json('styles');
            $table->boolean('has_multi_style')->default(false);
            $table->boolean('has_speed_outlier')->default(false);
            $table->boolean('has_runtime_outlier')->default(false);
            $table->foreignId('machine_definition_id')->nullable()->constrained('machine_definitions')->nullOnDelete();
            $table->timestamps();

            $table->unique(['machine_number', 'date', 'shift'], 'unique_machine_number_date_shift');
            $table->index(['year', 'month']);
            $table->index(['machine_number', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('runtime_shift_aggregates');
        Schema::dropIfExists('runtime_records');
        Schema::dropIfExists('runtime_upload_batches');
    }
};
