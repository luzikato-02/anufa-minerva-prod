<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('torque_check_sheets', function (Blueprint $table) {
            // A short code the operator can type on another device to keep recording into this same sheet.
            $table->string('session_id')->nullable()->unique()->after('client_uuid');
        });
    }

    public function down(): void
    {
        Schema::table('torque_check_sheets', function (Blueprint $table) {
            $table->dropColumn('session_id');
        });
    }
};
