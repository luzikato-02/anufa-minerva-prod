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
            // Control Plan Header Fields
            $table->string('control_plan_number')->nullable()->after('document_number');
            $table->string('part_number_latest_change_level')->nullable();
            $table->string('part_name_description')->nullable();
            $table->string('key_contact_phone')->nullable();
            $table->string('core_team')->nullable();
            $table->string('organization_plant')->nullable();
            $table->string('organization_code')->nullable();
            $table->string('customer_engineering_approval_date')->nullable();
            $table->string('customer_quality_approval_date')->nullable();
            $table->string('other_approval_date')->nullable();
            
            // Manufacturing Step
            $table->enum('manufacturing_step', ['prototype', 'pre-launch', 'production'])->nullable()->default('production');
            
            // Production Area
            $table->string('production_area')->nullable();
            
            // Document Information Fields
            $table->string('referensi_sp')->nullable();
            $table->date('tanggal_diterbitkan_sp')->nullable();
            $table->date('tanggal_diterbitkan')->nullable();
            $table->string('no_revisi_tanggal_revisi_terakhir')->nullable();
            $table->date('tanggal_review_berikutnya')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('control_plans', function (Blueprint $table) {
            $table->dropColumn([
                'control_plan_number',
                'part_number_latest_change_level',
                'part_name_description',
                'key_contact_phone',
                'core_team',
                'organization_plant',
                'organization_code',
                'customer_engineering_approval_date',
                'customer_quality_approval_date',
                'other_approval_date',
                'manufacturing_step',
                'production_area',
                'referensi_sp',
                'tanggal_diterbitkan_sp',
                'tanggal_diterbitkan',
                'no_revisi_tanggal_revisi_terakhir',
                'tanggal_review_berikutnya',
            ]);
        });
    }
};
