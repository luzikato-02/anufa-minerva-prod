<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('runtime_shift_aggregates', function (Blueprint $table) {
            $table->decimal('energy_kwh', 12, 3)->nullable()->after('avg_rpm');
        });
    }

    public function down(): void
    {
        Schema::table('runtime_shift_aggregates', function (Blueprint $table) {
            $table->dropColumn('energy_kwh');
        });
    }
};
