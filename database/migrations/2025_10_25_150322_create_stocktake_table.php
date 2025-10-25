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
        Schema::create('stock_taking_records', function (Blueprint $table) {
            $table->id();
            $table->timestamps();
            $table->json('indv_batch_data');
            $table->json('metadata');
            $table->softDeletes(); // Soft delete for data recovery
            $table->unsignedBigInteger('user_id')->nullable(); // Optional user association

            // Indexes for better performance
            $table->index('created_at');
            $table->index('user_id');
            
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_taking_records');
    }
};
