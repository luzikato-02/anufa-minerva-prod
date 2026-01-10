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
     * This migration creates separate measurement tables for twisting and weaving
     * to normalize the measurement_data JSON blob into proper relational tables.
     *
     * Twisting: Simple spindle-based measurements (1-84 spindles per machine)
     * Weaving: Complex creel-based measurements (4 sides × 5 rows (A-E) × 120 columns)
     */
    public function up(): void
    {
        // =====================================================================
        // TWISTING MEASUREMENTS TABLE
        // =====================================================================
        if (!Schema::hasTable('twisting_measurements')) {
            Schema::create('twisting_measurements', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tension_record_id')
                    ->constrained('tension_records')
                    ->onDelete('cascade');

                // Spindle identification
                $table->unsignedTinyInteger('spindle_number');

                // Measurement values
                $table->decimal('max_value', 8, 2)->nullable();
                $table->decimal('min_value', 8, 2)->nullable();

                // Calculated fields (computed in application layer for SQLite compatibility)
                $table->decimal('avg_value', 8, 2)->nullable();
                $table->decimal('range_value', 8, 2)->nullable();

                // Status flags
                $table->boolean('is_complete')->default(false);
                $table->boolean('is_out_of_spec')->default(false);

                // Timestamps
                $table->timestamp('measured_at')->nullable();
                $table->timestamps();

                // Indexes for efficient querying
                $table->unique(['tension_record_id', 'spindle_number'], 'idx_record_spindle');
                $table->index(['tension_record_id', 'is_complete'], 'idx_twisting_record_complete');
                $table->index(['tension_record_id', 'is_out_of_spec'], 'idx_twisting_record_out_of_spec');
                $table->index(['spindle_number'], 'idx_spindle');
            });
        }

        // =====================================================================
        // WEAVING MEASUREMENTS TABLE
        // =====================================================================
        if (!Schema::hasTable('weaving_measurements')) {
            Schema::create('weaving_measurements', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tension_record_id')
                    ->constrained('tension_records')
                    ->onDelete('cascade');

                // Creel position identification (using string for SQLite compatibility)
                $table->string('creel_side', 2); // AI, BI, AO, BO
                $table->string('row_number', 1); // A, B, C, D, E
                $table->unsignedSmallInteger('column_number'); // 1-120

                // Measurement values
                $table->decimal('max_value', 8, 2)->nullable();
                $table->decimal('min_value', 8, 2)->nullable();

                // Calculated fields (computed in application layer for SQLite compatibility)
                $table->decimal('avg_value', 8, 2)->nullable();
                $table->decimal('range_value', 8, 2)->nullable();

                // Status flags
                $table->boolean('is_complete')->default(false);
                $table->boolean('is_out_of_spec')->default(false);

                // Timestamps
                $table->timestamp('measured_at')->nullable();
                $table->timestamps();

                // Indexes for efficient querying
                $table->unique(
                    ['tension_record_id', 'creel_side', 'row_number', 'column_number'],
                    'idx_record_position'
                );
                $table->index(['tension_record_id', 'creel_side'], 'idx_record_side');
                $table->index(['tension_record_id', 'is_complete'], 'idx_weaving_record_complete');
                $table->index(['tension_record_id', 'is_out_of_spec'], 'idx_weaving_record_out_of_spec');
                $table->index(['creel_side', 'row_number'], 'idx_side_row');
            });
        }

        // =====================================================================
        // MIGRATE EXISTING DATA
        // =====================================================================
        $this->migrateTwistingMeasurements();
        $this->migrateWeavingMeasurements();
    }

    /**
     * Migrate twisting measurement data from JSON to normalized table
     */
    private function migrateTwistingMeasurements(): void
    {
        $records = DB::table('tension_records')
            ->where('record_type', 'twisting')
            ->whereNotNull('measurement_data')
            ->where('measurement_data', '!=', '{}')
            ->where('measurement_data', '!=', 'null')
            ->where('measurement_data', '!=', '')
            ->get(['id', 'measurement_data', 'spec_tension', 'tension_tolerance']);

        foreach ($records as $record) {
            $measurementData = json_decode($record->measurement_data, true);

            if (!is_array($measurementData) || empty($measurementData)) {
                continue;
            }

            $specTension = $record->spec_tension;
            $tolerance = $record->tension_tolerance ?? 0;

            foreach ($measurementData as $spindleNumber => $data) {
                if (!is_numeric($spindleNumber) || !is_array($data)) {
                    continue;
                }

                $maxValue = $data['max'] ?? null;
                $minValue = $data['min'] ?? null;
                $isComplete = $maxValue !== null && $minValue !== null;

                // Calculate avg and range
                $avgValue = null;
                $rangeValue = null;
                if ($isComplete) {
                    $avgValue = ($maxValue + $minValue) / 2;
                    $rangeValue = $maxValue - $minValue;
                }

                // Check if out of spec
                $isOutOfSpec = false;
                if ($isComplete && $specTension !== null) {
                    $minSpec = $specTension - $tolerance;
                    $maxSpec = $specTension + $tolerance;
                    $isOutOfSpec = $avgValue < $minSpec || $avgValue > $maxSpec;
                }

                DB::table('twisting_measurements')->insert([
                    'tension_record_id' => $record->id,
                    'spindle_number' => (int) $spindleNumber,
                    'max_value' => $maxValue,
                    'min_value' => $minValue,
                    'avg_value' => $avgValue,
                    'range_value' => $rangeValue,
                    'is_complete' => $isComplete,
                    'is_out_of_spec' => $isOutOfSpec,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * Migrate weaving measurement data from JSON to normalized table
     */
    private function migrateWeavingMeasurements(): void
    {
        $records = DB::table('tension_records')
            ->where('record_type', 'weaving')
            ->whereNotNull('measurement_data')
            ->where('measurement_data', '!=', '{}')
            ->where('measurement_data', '!=', 'null')
            ->where('measurement_data', '!=', '')
            ->get(['id', 'measurement_data', 'spec_tension', 'tension_tolerance']);

        foreach ($records as $record) {
            $measurementData = json_decode($record->measurement_data, true);

            if (!is_array($measurementData) || empty($measurementData)) {
                continue;
            }

            $specTension = $record->spec_tension;
            $tolerance = $record->tension_tolerance ?? 0;
            $validSides = ['AI', 'BI', 'AO', 'BO'];
            $validRows = ['A', 'B', 'C', 'D', 'E'];
            $measurements = [];

            foreach ($measurementData as $side => $rows) {
                // Normalize side to uppercase
                $normalizedSide = strtoupper($side);
                
                if (!in_array($normalizedSide, $validSides) || !is_array($rows)) {
                    continue;
                }

                foreach ($rows as $row => $columns) {
                    if (!is_array($columns)) {
                        continue;
                    }

                    // Normalize row format (A, B, C, D, E or numeric 1-5)
                    $rowNumber = strtoupper($row);
                    if (!in_array($rowNumber, $validRows)) {
                        // Try to convert numeric row (1-5) to letter (A-E)
                        if (is_numeric($row) && $row >= 1 && $row <= 5) {
                            $rowNumber = chr(64 + (int)$row); // 1=>A, 2=>B, 3=>C, 4=>D, 5=>E
                        } else {
                            continue;
                        }
                    }

                    foreach ($columns as $column => $data) {
                        if (!is_numeric($column) || !is_array($data)) {
                            continue;
                        }

                        $maxValue = $data['max'] ?? null;
                        $minValue = $data['min'] ?? null;
                        $isComplete = $maxValue !== null && $minValue !== null;

                        // Calculate avg and range
                        $avgValue = null;
                        $rangeValue = null;
                        if ($isComplete) {
                            $avgValue = ($maxValue + $minValue) / 2;
                            $rangeValue = $maxValue - $minValue;
                        }

                        // Check if out of spec
                        $isOutOfSpec = false;
                        if ($isComplete && $specTension !== null) {
                            $minSpec = $specTension - $tolerance;
                            $maxSpec = $specTension + $tolerance;
                            $isOutOfSpec = $avgValue < $minSpec || $avgValue > $maxSpec;
                        }

                        $measurements[] = [
                            'tension_record_id' => $record->id,
                            'creel_side' => $normalizedSide,
                            'row_number' => $rowNumber,
                            'column_number' => (int) $column,
                            'max_value' => $maxValue,
                            'min_value' => $minValue,
                            'avg_value' => $avgValue,
                            'range_value' => $rangeValue,
                            'is_complete' => $isComplete,
                            'is_out_of_spec' => $isOutOfSpec,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }
                }
            }

            // Insert in chunks to avoid memory issues
            foreach (array_chunk($measurements, 500) as $chunk) {
                DB::table('weaving_measurements')->insert($chunk);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('weaving_measurements');
        Schema::dropIfExists('twisting_measurements');
    }
};