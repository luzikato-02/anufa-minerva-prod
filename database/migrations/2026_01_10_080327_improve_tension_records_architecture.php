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
        Schema::table('tension_records', function (Blueprint $table) {
            // Common fields for both twisting and weaving
            $table->string('operator', 100)->nullable()->after('record_type');
            $table->string('machine_number', 50)->nullable()->after('operator');
            $table->string('item_number', 100)->nullable()->after('machine_number');
            $table->string('item_description', 255)->nullable()->after('item_number');
            $table->decimal('meters_check', 10, 2)->nullable()->after('item_description');

            // Tension specification fields
            $table->decimal('spec_tension', 8, 2)->nullable()->after('meters_check');
            $table->decimal('tension_tolerance', 8, 2)->nullable()->after('spec_tension');

            // Twisting-specific fields
            $table->string('dtex_number', 50)->nullable()->after('tension_tolerance');
            $table->unsignedInteger('tpm')->nullable()->after('dtex_number');
            $table->unsignedInteger('rpm')->nullable()->after('tpm');
            $table->string('yarn_code', 100)->nullable()->after('rpm');

            // Weaving-specific fields
            $table->string('production_order', 100)->nullable()->after('yarn_code');
            $table->string('bale_number', 100)->nullable()->after('production_order');
            $table->string('color_code', 50)->nullable()->after('bale_number');

            // Progress tracking fields
            $table->unsignedInteger('total_measurements')->default(0)->after('color_code');
            $table->unsignedInteger('completed_measurements')->default(0)->after('total_measurements');
            $table->unsignedTinyInteger('progress_percentage')->default(0)->after('completed_measurements');

            // Recording session info
            $table->timestamp('recording_started_at')->nullable()->after('progress_percentage');
            $table->timestamp('recording_completed_at')->nullable()->after('recording_started_at');

            // Add status field for record lifecycle (using string for SQLite compatibility)
            $table->string('status', 20)->default('completed')->after('recording_completed_at');

            // Improve existing indexes
            $table->index(['record_type', 'created_at'], 'idx_type_created');
            $table->index(['operator', 'created_at'], 'idx_operator_created');
            $table->index(['machine_number', 'record_type'], 'idx_machine_type');
            $table->index(['item_number'], 'idx_item_number');
            $table->index(['status', 'created_at'], 'idx_status_created');
        });

        // Step 2: Create tension_problems table for normalized problem storage
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

        // Step 3: Migrate existing problems data from JSON to the new table
        $this->migrateProblemsData();

        // Step 4: Migrate metadata to new columns
        $this->migrateMetadataToColumns();

        // Step 5: Drop the old generated columns if they exist (MySQL only)
        $this->dropGeneratedColumns();
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
