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
        Schema::table('stock_taking_records', function (Blueprint $table) {
            $table->json('stock_take_summary')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
         Schema::table('stock_taking_records', function (Blueprint $table) {
            $table->dropColumn('stock_take_summary');
        });
    }
};
