<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What an imported revision's file printed in bold italic (its changes), so the sheet prints them the same way;
 * revisions made in the app are compared with the release before them instead.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('control_plan_revisions', function (Blueprint $table) {
            $table->json('marks')->nullable()->after('history');
        });
    }

    public function down(): void
    {
        Schema::table('control_plan_revisions', function (Blueprint $table) {
            $table->dropColumn('marks');
        });
    }
};
