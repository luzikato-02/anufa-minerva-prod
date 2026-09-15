<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('energy_records');
        Schema::dropIfExists('energy_upload_batches');

        if (Schema::hasColumn('runtime_shift_aggregates', 'energy_kwh')) {
            Schema::table('runtime_shift_aggregates', function (Blueprint $table) {
                $table->dropColumn('energy_kwh');
            });
        }
    }

    public function down(): void
    {
        // Energy tracking feature removed; no restore path.
    }
};
