<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotency key for the mobile app: a queued upload that is retried after a
 * lost response must not create a second record.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tension_records', function (Blueprint $table) {
            $table->uuid('client_uuid')->nullable()->unique();
        });
    }

    public function down(): void
    {
        Schema::table('tension_records', function (Blueprint $table) {
            $table->dropUnique(['client_uuid']);
            $table->dropColumn('client_uuid');
        });
    }
};
