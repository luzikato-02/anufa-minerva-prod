<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A deleted control plan is only soft-deleted, so its document number stayed taken: creating a plan with it again
 * passed validation and then failed on the unique index. The index now covers only plans that are not deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('control_plans', fn (Blueprint $table) => $table->dropUnique(['doc_no']));
        DB::statement('CREATE UNIQUE INDEX control_plans_doc_no_unique ON control_plans (doc_no) WHERE deleted_at IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX control_plans_doc_no_unique');
        Schema::table('control_plans', fn (Blueprint $table) => $table->unique('doc_no'));
    }
};
