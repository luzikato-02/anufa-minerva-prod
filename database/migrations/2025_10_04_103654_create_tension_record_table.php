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
        // MySQL's JSON_EXTRACT returns a JSON-quoted value that needs JSON_UNQUOTE,
        // and Postgres has neither function — it uses the ->> operator instead and
        // requires the generated-column clause to spell out GENERATED ALWAYS.
        $driver = DB::connection()->getDriverName();
        $addGeneratedColumn = function (string $column, string $key) use ($driver) {
            $expr = $driver === 'pgsql'
                ? "metadata->>'{$key}'"
                : $this->jsonExtractLegacy($driver, 'metadata', "\$.{$key}");

            $clause = $driver === 'pgsql'
                ? "GENERATED ALWAYS AS ({$expr}) STORED"
                : "AS ({$expr}) STORED";

            DB::statement("ALTER TABLE tension_records ADD COLUMN {$column} VARCHAR(255) {$clause}");
        };

        // Add generated columns + indexes
        $addGeneratedColumn('operator_generated', 'operator');
        DB::statement("CREATE INDEX idx_operator ON tension_records (operator_generated)");

        $addGeneratedColumn('machine_number_generated', 'machine_number');
        DB::statement("CREATE INDEX idx_machine ON tension_records (machine_number_generated)");

        $addGeneratedColumn('item_number_generated', 'item_number');
        DB::statement("CREATE INDEX idx_item ON tension_records (item_number_generated)");
    }

    private function jsonExtractLegacy(string $driver, string $column, string $path): string
    {
        return $driver === 'sqlite'
            ? "JSON_EXTRACT({$column}, '{$path}')"
            : "JSON_UNQUOTE(JSON_EXTRACT({$column}, '{$path}'))";
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tension_records');
    }
};
