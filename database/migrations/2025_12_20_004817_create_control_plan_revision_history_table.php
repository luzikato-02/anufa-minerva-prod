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
        Schema::create('control_plan_revision_histories', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('control_plan_id');
            $table->string('page')->nullable(); // Page(s) affected
            $table->date('date_of_revision');
            $table->string('revision_number');
            $table->text('description')->nullable();
            $table->string('revised_by')->nullable();
            $table->timestamps();

            // Foreign key constraint
            $table->foreign('control_plan_id')
                ->references('id')
                ->on('control_plans')
                ->onDelete('cascade');

            // Indexes
            $table->index('control_plan_id');
            $table->index('date_of_revision');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('control_plan_revision_histories');
    }
};
