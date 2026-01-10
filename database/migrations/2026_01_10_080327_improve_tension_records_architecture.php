<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * This migration improves the tension_records database architecture by:
     * 1. Normalizing frequently-accessed fields into proper columns
     * 2. Creating a separate tension_problems table for better querying
     * 3. Adding proper indexes and constraints
     * 4. Maintaining backward compatibility with existing data
     */
    public function up(): void
    {
        // Step 1: Add normalized columns to tension_records table
        // Check each column before adding to handle partial migrations
        $columns = Schema::getColumnListing('tension_records');

        Schema::table('tension_records', function (Blueprint $table) use ($columns) {
            // Common fields for both twisting and weaving
            if (!in_array('operator', $columns)) {
                $table->string('operator', 100)->nullable();
            }
            if (!in_array('machine_number', $columns)) {
                $table->string('machine_number', 50)->nullable();
            }
            if (!in_array('item_number', $columns)) {
                $table->string('item_number', 100)->nullable();
            }
            if (!in_array('item_description', $columns)) {
                $table->string('item_description', 255)->nullable();
            }
            if (!in_array('meters_check', $columns)) {
                $table->decimal('meters_check', 10, 2)->nullable();
            }

            // Tension specification fields
            if (!in_array('spec_tension', $columns)) {
                $table->decimal('spec_tension', 8, 2)->nullable();
            }
            if (!in_array('tension_tolerance', $columns)) {
                $table->decimal('tension_tolerance', 8, 2)->nullable();
            }

            // Twisting-specific fields
            if (!in_array('dtex_number', $columns)) {
                $table->string('dtex_number', 50)->nullable();
            }
            if (!in_array('tpm', $columns)) {
                $table->unsignedInteger('tpm')->nullable();
            }
            if (!in_array('rpm', $columns)) {
                $table->unsignedInteger('rpm')->nullable();
            }
            if (!in_array('yarn_code', $columns)) {
                $table->string('yarn_code', 100)->nullable();
            }

            // Weaving-specific fields
            if (!in_array('production_order', $columns)) {
                $table->string('production_order', 100)->nullable();
            }
            if (!in_array('bale_number', $columns)) {
                $table->string('bale_number', 100)->nullable();
            }
            if (!in_array('color_code', $columns)) {
                $table->string('color_code', 50)->nullable();
            }

            // Progress tracking fields
            if (!in_array('total_measurements', $columns)) {
                $table->unsignedInteger('total_measurements')->default(0);
            }
            if (!in_array('completed_measurements', $columns)) {
                $table->unsignedInteger('completed_measurements')->default(0);
            }
            if (!in_array('progress_percentage', $columns)) {
                $table->unsignedTinyInteger('progress_percentage')->default(0);
            }

            // Recording session info
            if (!in_array('recording_started_at', $columns)) {
                $table->timestamp('recording_started_at')->nullable();
            }
            if (!in_array('recording_completed_at', $columns)) {
                $table->timestamp('recording_completed_at')->nullable();
            }

            // Add status field for record lifecycle (using string for SQLite compatibility)
            if (!in_array('status', $columns)) {
                $table->string('status', 20)->default('completed');
            }
        });

        // Add indexes separately to handle if they already exist
        $this->addIndexesSafely();

        // Step 2: Create tension_problems table for normalized problem storage
        if (!Schema::hasTable('tension_problems')) {
            Schema::create('tension_problems', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tension_record_id')
                    ->constrained('tension_records')
                    ->onDelete('cascade');

                // Problem identification
                $table->string('position_identifier', 100);
                $table->string('problem_type', 30)->default('other');

                // Problem details
                $table->text('description');
                $table->decimal('measured_value', 8, 2)->nullable();
                $table->decimal('expected_min', 8, 2)->nullable();
                $table->decimal('expected_max', 8, 2)->nullable();

                // Problem status tracking
                $table->string('severity', 20)->default('medium');
                $table->string('resolution_status', 20)->default('open');
                $table->text('resolution_notes')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->unsignedBigInteger('resolved_by')->nullable();

                // Timestamps
                $table->timestamp('reported_at')->useCurrent();
                $table->timestamps();

                // Indexes for efficient querying
                $table->index(['tension_record_id', 'problem_type'], 'idx_record_problem_type');
                $table->index(['resolution_status', 'severity'], 'idx_status_severity');
                $table->index(['reported_at'], 'idx_reported');
                $table->index(['position_identifier'], 'idx_position');

                // Foreign key for resolver
                $table->foreign('resolved_by')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
            });
        }

        // Step 3: Migrate existing problems data from JSON to the new table
        $this->migrateProblemsData();

        // Step 4: Migrate metadata to new columns
        $this->migrateMetadataToColumns();

        // Step 5: Drop the old generated columns if they exist (MySQL only)
        $this->dropGeneratedColumns();
    }

    /**
     * Add indexes safely, skipping if they already exist
     */
    private function addIndexesSafely(): void
    {
        $indexes = [
            'idx_type_created' => ['record_type', 'created_at'],
            'idx_operator_created' => ['operator', 'created_at'],
            'idx_machine_type' => ['machine_number', 'record_type'],
            'idx_item_number' => ['item_number'],
            'idx_status_created' => ['status', 'created_at'],
        ];

        foreach ($indexes as $indexName => $columns) {
            try {
                Schema::table('tension_records', function (Blueprint $table) use ($indexName, $columns) {
                    $table->index($columns, $indexName);
                });
            } catch (\Exception $e) {
                // Index already exists, skip
            }
        }
    }

    /**
     * Migrate problems from JSON column to normalized table
     */
    private function migrateProblemsData(): void
    {
        // Get all records with problems - use PHP to filter instead of JSON_LENGTH
        $records = DB::table('tension_records')
            ->whereNotNull('problems')
            ->where('problems', '!=', '[]')
            ->where('problems', '!=', 'null')
            ->where('problems', '!=', '')
            ->get(['id', 'record_type', 'problems']);

        foreach ($records as $record) {
            $problems = json_decode($record->problems, true);

            if (!is_array($problems) || empty($problems)) {
                continue;
            }

            foreach ($problems as $problem) {
                $positionIdentifier = $record->record_type === 'twisting'
                    ? ($problem['spindleNumber'] ?? $problem['spindle_number'] ?? 'unknown')
                    : ($problem['position'] ?? 'unknown');

                DB::table('tension_problems')->insert([
                    'tension_record_id' => $record->id,
                    'position_identifier' => $positionIdentifier,
                    'problem_type' => 'other',
                    'description' => $problem['description'] ?? '',
                    'severity' => 'medium',
                    'resolution_status' => 'open',
                    'reported_at' => isset($problem['timestamp'])
                        ? date('Y-m-d H:i:s', strtotime($problem['timestamp']))
                        : now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * Migrate metadata JSON to proper columns using PHP (database-agnostic)
     */
    private function migrateMetadataToColumns(): void
    {
        // Process all records
        $records = DB::table('tension_records')->get(['id', 'record_type', 'metadata', 'form_data']);

        foreach ($records as $record) {
            $metadata = json_decode($record->metadata, true) ?? [];
            $formData = json_decode($record->form_data, true) ?? [];

            $updateData = [
                // Common fields from metadata
                'operator' => $metadata['operator'] ?? null,
                'machine_number' => $metadata['machine_number'] ?? null,
                'item_number' => $metadata['item_number'] ?? null,
                'total_measurements' => $metadata['total_measurements'] ?? 0,
                'completed_measurements' => $metadata['completed_measurements'] ?? 0,
                'progress_percentage' => $metadata['progress_percentage'] ?? 0,
            ];

            // Extract from form_data
            $metersCheck = $formData['metersCheck'] ?? null;
            $specTens = $formData['specTens'] ?? null;
            $tensPlus = $formData['tensPlus'] ?? null;

            $updateData['meters_check'] = is_numeric($metersCheck) ? (float) $metersCheck : null;
            $updateData['spec_tension'] = is_numeric($specTens) ? (float) $specTens : null;
            $updateData['tension_tolerance'] = is_numeric($tensPlus) ? (float) $tensPlus : null;

            if ($record->record_type === 'twisting') {
                // Twisting-specific fields
                $updateData['yarn_code'] = $metadata['yarn_code'] ?? null;
                $updateData['dtex_number'] = $formData['dtexNumber'] ?? null;

                $tpm = $formData['tpm'] ?? null;
                $rpm = $formData['rpm'] ?? null;
                $updateData['tpm'] = is_numeric($tpm) ? (int) $tpm : null;
                $updateData['rpm'] = is_numeric($rpm) ? (int) $rpm : null;
            } else {
                // Weaving-specific fields
                $updateData['item_description'] = $metadata['item_description'] ?? null;
                $updateData['production_order'] = $formData['productionOrder'] ?? null;
                $updateData['bale_number'] = $formData['baleNumber'] ?? null;
                $updateData['color_code'] = $formData['colorCode'] ?? null;
            }

            DB::table('tension_records')
                ->where('id', $record->id)
                ->update($updateData);
        }
    }

    /**
     * Drop the old generated columns (MySQL only, skip for SQLite)
     */
    private function dropGeneratedColumns(): void
    {
        $driver = DB::connection()->getDriverName();

        // Only attempt to drop generated columns on MySQL
        if ($driver !== 'mysql') {
            return;
        }

        // Drop old generated columns and their indexes
        try {
            DB::statement("DROP INDEX idx_operator ON tension_records");
            DB::statement("DROP INDEX idx_machine ON tension_records");
            DB::statement("DROP INDEX idx_item ON tension_records");
        } catch (\Exception $e) {
            // Indexes might not exist, continue
        }

        try {
            DB::statement("ALTER TABLE tension_records DROP COLUMN operator_generated");
            DB::statement("ALTER TABLE tension_records DROP COLUMN machine_number_generated");
            DB::statement("ALTER TABLE tension_records DROP COLUMN item_number_generated");
        } catch (\Exception $e) {
            // Columns might not exist, continue
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop the tension_problems table
        Schema::dropIfExists('tension_problems');

        // Remove the new columns from tension_records
        Schema::table('tension_records', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex('idx_type_created');
            $table->dropIndex('idx_operator_created');
            $table->dropIndex('idx_machine_type');
            $table->dropIndex('idx_item_number');
            $table->dropIndex('idx_status_created');

            // Drop columns
            $table->dropColumn([
                'operator',
                'machine_number',
                'item_number',
                'item_description',
                'meters_check',
                'spec_tension',
                'tension_tolerance',
                'dtex_number',
                'tpm',
                'rpm',
                'yarn_code',
                'production_order',
                'bale_number',
                'color_code',
                'total_measurements',
                'completed_measurements',
                'progress_percentage',
                'recording_started_at',
                'recording_completed_at',
                'status',
            ]);
        });

        // Only recreate generated columns on MySQL
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
};
