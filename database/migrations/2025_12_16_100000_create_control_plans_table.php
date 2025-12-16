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
        // Main control plan documents table
        Schema::create('control_plans', function (Blueprint $table) {
            $table->id();
            $table->string('document_number')->unique(); // User-defined document number
            $table->string('title')->nullable(); // Optional title for the control plan
            $table->text('description')->nullable(); // Optional description
            $table->unsignedBigInteger('created_by')->nullable(); // User who created the document
            $table->timestamps();
            $table->softDeletes();

            // Indexes for better performance
            $table->index('document_number');
            $table->index('created_at');
            $table->index('created_by');
        });

        // Control plan items (rows) table
        Schema::create('control_plan_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('control_plan_id');
            $table->string('process_no')->nullable(); // Process No.
            $table->string('process_step')->nullable(); // Process Step/Name
            $table->text('process_items')->nullable(); // Process Items
            $table->text('machine_device_jig_tools')->nullable(); // Machine, Device, Jig, Tools for MFG
            $table->text('product_process_characteristics')->nullable(); // Product or Process Characteristics
            $table->string('special_characteristics')->nullable(); // Special Characteristics
            $table->text('product_process_specification_tolerance')->nullable(); // Product/Process Specification/Tolerance
            $table->string('sample_size')->nullable(); // Sample Size
            $table->string('sample_frequency')->nullable(); // Sample Frequency
            $table->text('control_method')->nullable(); // Control Method
            $table->text('reaction_plan')->nullable(); // Reaction Plan
            $table->unsignedInteger('sort_order')->default(0); // For ordering rows
            $table->timestamps();

            // Foreign key constraint
            $table->foreign('control_plan_id')
                ->references('id')
                ->on('control_plans')
                ->onDelete('cascade');

            // Indexes
            $table->index('control_plan_id');
            $table->index('sort_order');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('control_plan_items');
        Schema::dropIfExists('control_plans');
    }
};
