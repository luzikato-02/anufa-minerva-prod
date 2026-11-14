<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Users pick the model and effort per conversation; each answer records what produced it, since the
 * choice can change partway through a conversation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_conversations', function (Blueprint $table) {
            $table->string('effort', 10)->nullable()->after('model');
        });
        Schema::table('ai_messages', function (Blueprint $table) {
            $table->string('model', 60)->nullable()->after('tool_name');
            $table->string('effort', 10)->nullable()->after('model');
        });
    }

    public function down(): void
    {
        Schema::table('ai_messages', function (Blueprint $table) {
            $table->dropColumn(['model', 'effort']);
        });
        Schema::table('ai_conversations', function (Blueprint $table) {
            $table->dropColumn('effort');
        });
    }
};
