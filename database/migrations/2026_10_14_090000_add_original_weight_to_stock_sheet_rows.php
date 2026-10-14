<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_sheet_rows', function (Blueprint $table) {
            // What the batch weighed and how many bobbins it had originally; `actual_weight` follows from them.
            $table->decimal('original_weight', 10, 2)->nullable()->after('prod_date');
            $table->unsignedInteger('total_bobbins')->nullable()->after('original_weight');
        });
    }

    public function down(): void
    {
        Schema::table('stock_sheet_rows', function (Blueprint $table) {
            $table->dropColumn(['original_weight', 'total_bobbins']);
        });
    }
};
