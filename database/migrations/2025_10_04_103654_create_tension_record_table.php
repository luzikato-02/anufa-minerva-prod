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
            $table->enum('record_type', ['twisting', 'weaving']);
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

        // SQLite's JSON_EXTRACT already returns unquoted scalars for string paths,
        // while MySQL's JSON_EXTRACT returns a JSON-quoted value that needs JSON_UNQUOTE.
        $extract = function (string $path): string {
            return DB::connection()->getDriverName() === 'sqlite'
                ? "JSON_EXTRACT(metadata, '{$path}')"
                : "JSON_UNQUOTE(JSON_EXTRACT(metadata, '{$path}'))";
        };

        // Add generated columns + indexes
        DB::statement("
            ALTER TABLE tension_records
            ADD COLUMN operator_generated VARCHAR(255)
            AS ({$extract('$.operator')}) STORED
        ");
        DB::statement("CREATE INDEX idx_operator ON tension_records (operator_generated)");

        DB::statement("
            ALTER TABLE tension_records
            ADD COLUMN machine_number_generated VARCHAR(255)
            AS ({$extract('$.machine_number')}) STORED
        ");
        DB::statement("CREATE INDEX idx_machine ON tension_records (machine_number_generated)");

        DB::statement("
            ALTER TABLE tension_records
            ADD COLUMN item_number_generated VARCHAR(255)
            AS ({$extract('$.item_number')}) STORED
        ");
        DB::statement("CREATE INDEX idx_item ON tension_records (item_number_generated)");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tension_records');
    }
};
