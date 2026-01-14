<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Adds columns to store original and repaired tension values
     * when a problem is resolved after repair.
     */
    public function up(): void
    {
        Schema::table('tension_problems', function (Blueprint $table) {
            // Original values (the values when the problem was reported)
            $table->decimal('original_max_value', 8, 2)->nullable()->after('measured_value');
            $table->decimal('original_min_value', 8, 2)->nullable()->after('original_max_value');
            
            // Repaired values (the values after repair, entered when resolving)
            $table->decimal('repaired_max_value', 8, 2)->nullable()->after('original_min_value');
            $table->decimal('repaired_min_value', 8, 2)->nullable()->after('repaired_max_value');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tension_problems', function (Blueprint $table) {
            $table->dropColumn([
                'original_max_value',
                'original_min_value',
                'repaired_max_value',
                'repaired_min_value',
            ]);
        });
    }
};
