<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('runtime_shift_aggregates');
        Schema::dropIfExists('runtime_records');
        Schema::dropIfExists('runtime_upload_batches');
    }

    public function down(): void
    {
        // Runtime Records feature removed; no restore path.
    }
};
