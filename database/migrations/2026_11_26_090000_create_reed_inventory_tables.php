<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reed inventory: the spec catalogue, the fabric styles that call for a spec, rack locations, one row per
 * physical reed, and its insert-only movement log with inspections and repair orders hanging off it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reed_specs', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->decimal('dents_per_10cm', 7, 2);
            $table->unsignedInteger('width_mm');
            $table->unsignedInteger('working_width_mm')->nullable();
            $table->unsignedInteger('height_mm')->nullable();
            $table->string('reed_type')->default('flat'); // flat | profile
            $table->string('wire_profile')->nullable();
            $table->decimal('wire_thickness_mm', 5, 3)->nullable();
            $table->string('wire_material')->nullable();
            $table->unsignedInteger('min_stock')->default(0);
            $table->string('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('reed_fabric_styles', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('description')->nullable();
            $table->foreignId('reed_spec_id')->nullable()->constrained('reed_specs')->nullOnDelete();
            $table->decimal('ends_per_10cm', 7, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('reed_locations', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('zone')->nullable();
            $table->string('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('reeds', function (Blueprint $table) {
            $table->id();
            $table->string('serial_no')->unique();
            $table->foreignId('reed_spec_id')->constrained('reed_specs')->restrictOnDelete();
            $table->string('status')->default('in_stock');
            $table->char('grade', 1)->default('A');
            $table->foreignId('location_id')->nullable()->constrained('reed_locations')->nullOnDelete();
            // Where it is mounted (or reserved for) right now.
            $table->string('loom_number')->nullable();
            $table->foreignId('fabric_style_id')->nullable()->constrained('reed_fabric_styles')->nullOnDelete();
            $table->string('order_no')->nullable();
            $table->timestamp('mounted_at')->nullable();
            $table->timestamp('reserved_at')->nullable();
            // Receipt.
            $table->string('supplier')->nullable();
            $table->string('po_no')->nullable();
            $table->date('received_on')->nullable();
            $table->decimal('unit_cost', 14, 2)->nullable();
            // Wear counters, kept up to date by the lifecycle service.
            $table->decimal('meters_woven', 14, 1)->default(0);
            $table->unsignedInteger('days_mounted')->default(0);
            $table->unsignedInteger('issue_count')->default(0);
            $table->unsignedInteger('repair_count')->default(0);
            $table->timestamp('last_inspected_at')->nullable();
            $table->string('notes')->nullable();
            $table->timestamps();

            $table->index(['reed_spec_id', 'status']);
            $table->index('loom_number');
        });

        Schema::create('reed_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reed_id')->constrained('reeds')->cascadeOnDelete();
            $table->string('type'); // receive, reserve, release, issue, return, inspect, transfer, repair_out, repair_in, scrap
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->foreignId('from_location_id')->nullable()->constrained('reed_locations')->nullOnDelete();
            $table->foreignId('to_location_id')->nullable()->constrained('reed_locations')->nullOnDelete();
            $table->string('loom_number')->nullable();
            $table->foreignId('fabric_style_id')->nullable()->constrained('reed_fabric_styles')->nullOnDelete();
            $table->string('order_no')->nullable();
            $table->decimal('meters', 14, 1)->nullable();
            $table->string('note')->nullable();
            // Sent by the client with every action, so a retried request never logs the move twice.
            $table->uuid('client_uuid')->nullable()->unique();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['reed_id', 'occurred_at']);
        });

        Schema::create('reed_inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reed_id')->constrained('reeds')->cascadeOnDelete();
            $table->char('grade', 1);
            $table->json('checklist');
            $table->string('defect_dents')->nullable();
            $table->string('note')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('inspected_at');
            $table->timestamps();
        });

        Schema::create('reed_repairs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reed_id')->constrained('reeds')->cascadeOnDelete();
            $table->string('vendor');
            $table->string('defects')->nullable();
            $table->date('sent_on');
            $table->date('returned_on')->nullable();
            $table->decimal('cost', 14, 2)->nullable();
            $table->string('work_done')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reed_repairs');
        Schema::dropIfExists('reed_inspections');
        Schema::dropIfExists('reed_movements');
        Schema::dropIfExists('reeds');
        Schema::dropIfExists('reed_locations');
        Schema::dropIfExists('reed_fabric_styles');
        Schema::dropIfExists('reed_specs');
    }
};
