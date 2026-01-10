<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tension_records', function (Blueprint $table) {
            $table->id();
            $table->string('record_type', 20); // Using string instead of enum for SQLite compatibility
            $table->longText('csv_data'); // Store the complete CSV content
            $table->json('form_data'); // Store form parameters
            $table->json('measurement_data'); // Store raw measurement data
            $table->json('problems')->nullable(); // Store problem reports
            $table->json('metadata'); // Store statistics and metadata
            $table->unsignedBigInteger('user_id')->nullable(); // Optional user association
            $table->timestamps();
            $table->softDeletes(); // Soft delete for data recovery

            // Indexes for better performance
            $table->index('record_type');
            $table->index('created_at');
            $table->index('user_id');
        });

        // Add generated columns + indexes only for MySQL
        // SQLite doesn't support generated columns with JSON functions
        $driver = DB::connection()->getDriverName();
        
        if ($driver === 'mysql') {
            DB::statement("
                ALTER TABLE tension_records
                ADD COLUMN operator_generated VARCHAR(255)
                AS (JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.operator'))) STORED
            ");
            DB::statement("CREATE INDEX idx_operator ON tension_records (operator_generated)");

            DB::statement("
                ALTER TABLE tension_records
                ADD COLUMN machine_number_generated VARCHAR(255)
                AS (JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.machine_number'))) STORED
            ");
            DB::statement("CREATE INDEX idx_machine ON tension_records (machine_number_generated)");

            DB::statement("
                ALTER TABLE tension_records
                ADD COLUMN item_number_generated VARCHAR(255)
                AS (JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.item_number'))) STORED
            ");
            DB::statement("CREATE INDEX idx_item ON tension_records (item_number_generated)");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tension_records');
    }
};
