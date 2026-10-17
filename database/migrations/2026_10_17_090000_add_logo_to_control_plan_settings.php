<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('control_plan_settings', function (Blueprint $table) {
            // Path on the local disk of the company logo printed above the mill name on every page.
            $table->string('logo_path')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('control_plan_settings', function (Blueprint $table) {
            $table->dropColumn('logo_path');
        });
    }
};
