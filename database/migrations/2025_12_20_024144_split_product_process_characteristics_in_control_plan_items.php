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
        Schema::table('control_plan_items', function (Blueprint $table) {
            // Split product_process_characteristics into two separate fields
            $table->text('product_characteristics')->nullable()->after('machine_device_jig_tools');
            $table->text('process_characteristics')->nullable()->after('product_characteristics');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('control_plan_items', function (Blueprint $table) {
            $table->dropColumn(['product_characteristics', 'process_characteristics']);
        });
    }
};
