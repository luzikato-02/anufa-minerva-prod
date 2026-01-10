<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeavingMeasurement extends Model
{
    use HasFactory;

    /**
     * Creel side constants
     */
    public const SIDE_AI = 'AI'; // A-side Inner
    public const SIDE_BI = 'BI'; // B-side Inner
    public const SIDE_AO = 'AO'; // A-side Outer
    public const SIDE_BO = 'BO'; // B-side Outer

    /**
     * Row constants
     */
    public const ROW_1 = 'R1';
    public const ROW_2 = 'R2';
    public const ROW_3 = 'R3';
    public const ROW_4 = 'R4';
    public const ROW_5 = 'R5';

    /**
     * Maximum columns per row
     */
    public const MAX_COLUMNS = 120;

    /**
     * Maximum rows per side
     */
    public const MAX_ROWS = 5;

    /**
     * Total positions per creel (4 sides × 5 rows × 120 columns)
     */
    public const TOTAL_POSITIONS = 2400;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tension_record_id',
        'creel_side',
        'row_number',
        'column_number',
        'max_value',
        'min_value',
        'is_complete',
        'is_out_of_spec',
        'measured_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'column_number' => 'integer',
        'max_value' => 'decimal:2',
        'min_value' => 'decimal:2',
        'avg_value' => 'decimal:2',
        'range_value' => 'decimal:2',
        'is_complete' => 'boolean',
        'is_out_of_spec' => 'boolean',
        'measured_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var array<int, string>
     */
    protected $appends = [
        'position_label',
        'position_code',
        'status',
    ];

    /**
     * Get all available creel sides
     */
    public static function getCreelSides(): array
    {
        return [
            self::SIDE_AI => 'A-Side Inner',
            self::SIDE_BI => 'B-Side Inner',
            self::SIDE_AO => 'A-Side Outer',
            self::SIDE_BO => 'B-Side Outer',
        ];
    }

    /**
     * Get all available rows
     */
    public static function getRows(): array
    {
        return [
            self::ROW_1 => 'Row 1',
            self::ROW_2 => 'Row 2',
            self::ROW_3 => 'Row 3',
            self::ROW_4 => 'Row 4',
            self::ROW_5 => 'Row 5',
        ];
    }

    // =========================================================================
    // RELATIONSHIPS
    // =========================================================================

    /**
     * Get the tension record that this measurement belongs to.
     */
    public function tensionRecord(): BelongsTo
    {
        return $this->belongsTo(TensionRecord::class);
    }

    // =========================================================================
    // SCOPES
    // =========================================================================

    /**
     * Scope to filter by creel side
     */
    public function scopeForSide($query, string $side)
    {
        return $query->where('creel_side', $side);
    }

    /**
     * Scope to filter by row
     */
    public function scopeForRow($query, string $row)
    {
        return $query->where('row_number', $row);
    }

    /**
     * Scope to filter by column
     */
    public function scopeForColumn($query, int $column)
    {
        return $query->where('column_number', $column);
    }

    /**
     * Scope to filter by position (side, row, column)
     */
    public function scopeAtPosition($query, string $side, string $row, int $column)
    {
        return $query->where('creel_side', $side)
            ->where('row_number', $row)
            ->where('column_number', $column);
    }

    /**
     * Scope to filter by column range
     */
    public function scopeColumnRange($query, int $from, int $to)
    {
        return $query->whereBetween('column_number', [$from, $to]);
    }

    /**
     * Scope to get completed measurements only
     */
    public function scopeComplete($query)
    {
        return $query->where('is_complete', true);
    }

    /**
     * Scope to get incomplete measurements
     */
    public function scopeIncomplete($query)
    {
        return $query->where('is_complete', false);
    }

    /**
     * Scope to get out-of-spec measurements
     */
    public function scopeOutOfSpec($query)
    {
        return $query->where('is_out_of_spec', true);
    }

    /**
     * Scope to get in-spec measurements
     */
    public function scopeInSpec($query)
    {
        return $query->where('is_out_of_spec', false);
    }

    /**
     * Scope to order by position
     */
    public function scopeOrderByPosition($query, string $direction = 'asc')
    {
        return $query->orderByRaw("FIELD(creel_side, 'AI', 'AO', 'BI', 'BO') {$direction}")
            ->orderByRaw("FIELD(row_number, 'R1', 'R2', 'R3', 'R4', 'R5') {$direction}")
            ->orderBy('column_number', $direction);
    }

    /**
     * Scope to filter inner sides (AI, BI)
     */
    public function scopeInnerSides($query)
    {
        return $query->whereIn('creel_side', [self::SIDE_AI, self::SIDE_BI]);
    }

    /**
     * Scope to filter outer sides (AO, BO)
     */
    public function scopeOuterSides($query)
    {
        return $query->whereIn('creel_side', [self::SIDE_AO, self::SIDE_BO]);
    }

    /**
     * Scope to filter A-side (AI, AO)
     */
    public function scopeASide($query)
    {
        return $query->whereIn('creel_side', [self::SIDE_AI, self::SIDE_AO]);
    }

    /**
     * Scope to filter B-side (BI, BO)
     */
    public function scopeBSide($query)
    {
        return $query->whereIn('creel_side', [self::SIDE_BI, self::SIDE_BO]);
    }

    // =========================================================================
    // ACCESSORS
    // =========================================================================

    /**
     * Get the position code (e.g., "AI-R2-45")
     */
    public function getPositionCodeAttribute(): string
    {
        return "{$this->creel_side}-{$this->row_number}-{$this->column_number}";
    }

    /**
     * Get the human-readable position label
     */
    public function getPositionLabelAttribute(): string
    {
        $sideName = self::getCreelSides()[$this->creel_side] ?? $this->creel_side;
        $rowName = self::getRows()[$this->row_number] ?? $this->row_number;

        return "{$sideName}, {$rowName}, Column {$this->column_number}";
    }

    /**
     * Get the measurement status
     */
    public function getStatusAttribute(): string
    {
        if (!$this->is_complete) {
            return 'incomplete';
        }

        return $this->is_out_of_spec ? 'out_of_spec' : 'in_spec';
    }

    /**
     * Get the calculated average value
     */
    public function getCalculatedAvgAttribute(): ?float
    {
        if ($this->max_value === null || $this->min_value === null) {
            return null;
        }

        return ($this->max_value + $this->min_value) / 2;
    }

    /**
     * Get the calculated range value
     */
    public function getCalculatedRangeAttribute(): ?float
    {
        if ($this->max_value === null || $this->min_value === null) {
            return null;
        }

        return $this->max_value - $this->min_value;
    }

    /**
     * Get the side name
     */
    public function getSideNameAttribute(): string
    {
        return self::getCreelSides()[$this->creel_side] ?? $this->creel_side;
    }

    /**
     * Get the row name
     */
    public function getRowNameAttribute(): string
    {
        return self::getRows()[$this->row_number] ?? $this->row_number;
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Check if the measurement is within specification
     */
    public function isWithinSpec(float $specTension, float $tolerance = 0): bool
    {
        if (!$this->is_complete) {
            return false;
        }

        $avgValue = $this->calculated_avg;
        $minSpec = $specTension - $tolerance;
        $maxSpec = $specTension + $tolerance;

        return $avgValue >= $minSpec && $avgValue <= $maxSpec;
    }

    /**
     * Update the out-of-spec flag based on tension specifications
     */
    public function updateSpecStatus(float $specTension, float $tolerance = 0): self
    {
        $this->is_out_of_spec = !$this->isWithinSpec($specTension, $tolerance);
        $this->save();

        return $this;
    }

    /**
     * Record a measurement value
     */
    public function recordValue(string $type, float $value): self
    {
        if ($type === 'max') {
            $this->max_value = $value;
        } elseif ($type === 'min') {
            $this->min_value = $value;
        }

        // Update completion status and calculated fields
        $this->updateCalculatedFields();
        $this->measured_at = now();
        $this->save();

        return $this;
    }

    /**
     * Update calculated fields (avg_value, range_value, is_complete)
     */
    public function updateCalculatedFields(): self
    {
        $this->is_complete = $this->max_value !== null && $this->min_value !== null;

        if ($this->is_complete) {
            $this->avg_value = ($this->max_value + $this->min_value) / 2;
            $this->range_value = $this->max_value - $this->min_value;
        } else {
            $this->avg_value = null;
            $this->range_value = null;
        }

        return $this;
    }

    /**
     * Boot method to automatically update calculated fields on save
     */
    protected static function booted(): void
    {
        static::saving(function (WeavingMeasurement $measurement) {
            $measurement->updateCalculatedFields();
        });
    }

    /**
     * Get summary data for this measurement
     */
    public function getSummary(): array
    {
        return [
            'position_code' => $this->position_code,
            'position_label' => $this->position_label,
            'creel_side' => $this->creel_side,
            'row_number' => $this->row_number,
            'column_number' => $this->column_number,
            'max_value' => $this->max_value,
            'min_value' => $this->min_value,
            'avg_value' => $this->avg_value,
            'range_value' => $this->range_value,
            'status' => $this->status,
            'is_complete' => $this->is_complete,
            'is_out_of_spec' => $this->is_out_of_spec,
        ];
    }

    /**
     * Create measurements for all positions of a record
     */
    public static function initializeForRecord(int $tensionRecordId): void
    {
        $measurements = [];
        $now = now();
        $sides = array_keys(self::getCreelSides());
        $rows = array_keys(self::getRows());

        foreach ($sides as $side) {
            foreach ($rows as $row) {
                for ($column = 1; $column <= self::MAX_COLUMNS; $column++) {
                    $measurements[] = [
                        'tension_record_id' => $tensionRecordId,
                        'creel_side' => $side,
                        'row_number' => $row,
                        'column_number' => $column,
                        'max_value' => null,
                        'min_value' => null,
                        'is_complete' => false,
                        'is_out_of_spec' => false,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }
        }

        // Insert in chunks to avoid memory issues
        foreach (array_chunk($measurements, 500) as $chunk) {
            self::insert($chunk);
        }
    }

    /**
     * Get statistics for a tension record grouped by side
     */
    public static function getStatsBySide(int $tensionRecordId): array
    {
        $measurements = self::where('tension_record_id', $tensionRecordId)->get();

        $stats = [];
        foreach (self::getCreelSides() as $side => $name) {
            $sideMeasurements = $measurements->where('creel_side', $side);
            $completedMeasurements = $sideMeasurements->where('is_complete', true);

            $stats[$side] = [
                'creel_side' => $side,
                'total' => $sideMeasurements->count(),
                'completed' => $completedMeasurements->count(),
                'out_of_spec' => $sideMeasurements->where('is_out_of_spec', true)->count(),
                'avg_tension' => $completedMeasurements->avg('avg_value'),
            ];
        }

        return $stats;
    }

    /**
     * Get statistics for a tension record grouped by row
     */
    public static function getStatsByRow(int $tensionRecordId): array
    {
        $measurements = self::where('tension_record_id', $tensionRecordId)->get();

        $stats = [];
        foreach (self::getRows() as $row => $name) {
            $rowMeasurements = $measurements->where('row_number', $row);
            $completedMeasurements = $rowMeasurements->where('is_complete', true);

            $stats[$row] = [
                'row_number' => $row,
                'total' => $rowMeasurements->count(),
                'completed' => $completedMeasurements->count(),
                'out_of_spec' => $rowMeasurements->where('is_out_of_spec', true)->count(),
                'avg_tension' => $completedMeasurements->avg('avg_value'),
            ];
        }

        return $stats;
    }
}
