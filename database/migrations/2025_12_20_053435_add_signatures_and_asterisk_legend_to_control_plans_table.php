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
        Schema::table('control_plans', function (Blueprint $table) {
            $table->json('signatures_dibuat_oleh')->nullable()->after('tanggal_review_berikutnya');
            $table->json('signatures_disetujui_oleh')->nullable()->after('signatures_dibuat_oleh');
            $table->text('asterisk_legend')->nullable()->after('signatures_disetujui_oleh');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('control_plans', function (Blueprint $table) {
            $table->dropColumn(['signatures_dibuat_oleh', 'signatures_disetujui_oleh', 'asterisk_legend']);
        });
    }
};
