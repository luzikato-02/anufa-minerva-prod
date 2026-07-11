<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('runtime_shift_aggregates', function (Blueprint $table) {
            $table->json('styles_parsed')->nullable()->after('styles');
        });
    }

    public function down(): void
    {
        Schema::table('runtime_shift_aggregates', function (Blueprint $table) {
            $table->dropColumn('styles_parsed');
        });
    }
};
