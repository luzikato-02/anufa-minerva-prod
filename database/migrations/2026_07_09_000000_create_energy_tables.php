<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('energy_upload_batches', function (Blueprint $table) {
            $table->id();
            $table->string('file_name');
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->unsignedInteger('machine_count')->default(0);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('energy_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('upload_batch_id')->constrained('energy_upload_batches')->cascadeOnDelete();
            $table->string('machine_number', 8);
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->unsignedTinyInteger('shift');
            $table->decimal('energy_kwh', 12, 3);
            $table->timestamps();

            $table->unique(['machine_number', 'year', 'month', 'shift'], 'unique_energy_machine_month_shift');
            $table->index(['year', 'month']);
            $table->index(['machine_number', 'year', 'month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('energy_records');
        Schema::dropIfExists('energy_upload_batches');
    }
};
