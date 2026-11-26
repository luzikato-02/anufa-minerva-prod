<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** The shop calls this value the reed's total hole count, not a working width. Free text, like the other spec fields. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reed_specs', function (Blueprint $table) {
            $table->renameColumn('working_width_mm', 'total_hole');
        });
    }

    public function down(): void
    {
        Schema::table('reed_specs', function (Blueprint $table) {
            $table->renameColumn('total_hole', 'working_width_mm');
        });
    }
};
