<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('torque_check_sheets', function (Blueprint $table) {
            $table->id();
            $table->uuid('client_uuid')->nullable()->unique();
            $table->date('check_date');
            $table->string('operator_name');
            $table->string('machine_number');
            $table->enum('side', ['Ai', 'Ao', 'Bi', 'Bo']);
            $table->foreignId('creel_type_id')->constrained('creel_types');
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index('check_date');
        });

        Schema::create('torque_check_readings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('torque_check_sheet_id')->constrained('torque_check_sheets')->cascadeOnDelete();
            $table->unsignedTinyInteger('row_no');
            $table->char('column_letter', 1);
            $table->decimal('value', 4, 1);
            $table->string('note')->nullable();
            $table->uuid('client_uuid')->nullable()->unique();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Not unique: a soft-deleted reading must not block a fresh one at the same position.
            // Idempotency and "already filled" upserting are both handled in the controller.
            $table->index(['torque_check_sheet_id', 'row_no', 'column_letter']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('torque_check_readings');
        Schema::dropIfExists('torque_check_sheets');
    }
};
