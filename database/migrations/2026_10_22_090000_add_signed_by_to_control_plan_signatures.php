<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('control_plan_signatures', function (Blueprint $table) {
            // Who signed, when someone with control-plans.override signed for the box's owner (user_id); null when the owner signed.
            $table->foreignId('signed_by')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('control_plan_signatures', function (Blueprint $table) {
            $table->dropConstrainedForeignId('signed_by');
        });
    }
};
