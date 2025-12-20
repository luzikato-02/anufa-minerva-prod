<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Check if the old table exists and rename it
        if (Schema::hasTable('control_plan_revision_history')) {
            DB::statement('RENAME TABLE `control_plan_revision_history` TO `control_plan_revision_histories`');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Check if the new table exists and rename it back
        if (Schema::hasTable('control_plan_revision_histories')) {
            DB::statement('RENAME TABLE `control_plan_revision_histories` TO `control_plan_revision_history`');
        }
    }
};
