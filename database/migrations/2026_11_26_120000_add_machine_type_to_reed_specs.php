<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** The loom type a reed spec is made for. Free text, like the other spec fields. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reed_specs', function (Blueprint $table) {
            $table->string('machine_type')->nullable()->after('reed_type');
        });
    }

    public function down(): void
    {
        Schema::table('reed_specs', function (Blueprint $table) {
            $table->dropColumn('machine_type');
        });
    }
};
