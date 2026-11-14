<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-user AI model settings, set by an admin in User Management: the model the user's AI features start
 * with, and the models they may use at all (null: every model the provider offers).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('ai_default_model', 100)->nullable();
            $table->json('ai_allowed_models')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['ai_default_model', 'ai_allowed_models']);
        });
    }
};
