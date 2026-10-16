<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('control_plans', function (Blueprint $table) {
            $table->id();
            $table->string('doc_no')->unique();
            // Revision history rows from before the plan was kept here (imported from Word), printed ahead of the
            // rows of its released revisions: [{page, date, rev, description, revised_by}].
            $table->json('legacy_history')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // One row per revision. A revision's whole document (header, plan information, steps and characteristic
        // lines) is a snapshot, so a released revision never changes when the next one is edited.
        Schema::create('control_plan_revisions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('control_plan_id')->constrained('control_plans')->cascadeOnDelete();
            $table->unsignedSmallInteger('rev_no');
            $table->string('status', 20)->index();
            $table->json('header');
            $table->json('info');
            $table->json('content');
            // Revision history entries the author wrote on submit: [{pages, description}].
            $table->json('history')->nullable();
            // The reference library entries this revision used, as they were on release.
            $table->json('reference_snapshot')->nullable();
            $table->unsignedBigInteger('author_id')->nullable();
            $table->unsignedBigInteger('submitted_by')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->unsignedBigInteger('released_by')->nullable();
            $table->date('release_date')->nullable();
            $table->date('next_review_date')->nullable();
            $table->timestamps();

            $table->unique(['control_plan_id', 'rev_no']);
        });

        Schema::create('control_plan_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('control_plan_revision_id')->constrained('control_plan_revisions')->cascadeOnDelete();
            $table->unsignedBigInteger('user_id')->nullable();
            // comment, changes_requested, approved, released, withdrawn
            $table->string('kind', 20)->default('comment');
            $table->text('body');
            $table->timestamps();
        });

        Schema::create('control_plan_references', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('title')->nullable();
            $table->string('type')->nullable();
            $table->string('revision')->nullable();
            $table->string('link', 1000)->nullable();
            $table->timestamps();
        });

        Schema::create('control_plan_settings', function (Blueprint $table) {
            $table->id();
            $table->string('mill')->nullable();
            $table->string('org_plant')->nullable();
            $table->string('org_code')->nullable();
            $table->string('date_format', 2)->default('id');
            $table->unsignedTinyInteger('review_period_years')->default(2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('control_plan_settings');
        Schema::dropIfExists('control_plan_references');
        Schema::dropIfExists('control_plan_comments');
        Schema::dropIfExists('control_plan_revisions');
        Schema::dropIfExists('control_plans');
    }
};
