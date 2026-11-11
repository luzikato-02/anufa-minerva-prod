<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Saved tension record comparisons: which records were charted together, in
 * which order, and how the chart was set up. Each belongs to the user who
 * saved it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tension_comparisons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('record_type', 20); // twisting | weaving
            $table->json('record_ids');        // in legend order; the order sets each record's colour
            $table->string('metric', 10)->default('avg'); // max | min | avg | spread
            $table->json('hidden_ids')->nullable(); // records kept but hidden from the chart
            $table->timestamps();

            $table->index(['user_id', 'record_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tension_comparisons');
    }
};
