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
        Schema::table('runtime_records', function (Blueprint $table) {
            $table->string('yarn_type', 20)->nullable()->after('style_description');
            $table->unsignedInteger('dtex')->nullable()->after('yarn_type');
            $table->unsignedInteger('tpm')->nullable()->after('dtex');
            $table->string('yarn_code', 50)->nullable()->after('tpm');
            $table->string('machine_code', 20)->nullable()->after('yarn_code');
            $table->unsignedInteger('counter_length')->nullable()->after('machine_code');
        });
    }

    public function down(): void
    {
        Schema::table('runtime_records', function (Blueprint $table) {
            $table->dropColumn(['yarn_type', 'dtex', 'tpm', 'yarn_code', 'machine_code', 'counter_length']);
        });
    }
};
