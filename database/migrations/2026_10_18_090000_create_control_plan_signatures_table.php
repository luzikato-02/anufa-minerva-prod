<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A person's signature in one box of a revision's signature block. Kept apart from the revision's content
        // so only the signer can write it; saving a change to the revision deletes them all.
        Schema::create('control_plan_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('control_plan_revision_id')->constrained('control_plan_revisions')->cascadeOnDelete();
            // The id of the signer's box in content.signatures.
            $table->string('signer_id', 64);
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            // The signature as a PNG data: URI.
            $table->longText('image');
            $table->timestamps();
            $table->unique(['control_plan_revision_id', 'signer_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('control_plan_signatures');
    }
};
