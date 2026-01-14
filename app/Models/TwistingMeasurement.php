<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TwistingMeasurement extends Model
{
    use HasFactory;

    /**
     * Maximum number of spindles per machine
     */
    public const MAX_SPINDLES = 84;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tension_record_id',
        'spindle_number',
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
        'spindle_number' => 'integer',
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
        'status',
    ];

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
     * Scope to filter by spindle number
     */
    public function scopeForSpindle($query, int $spindleNumber)
    {
        return $query->where('spindle_number', $spindleNumber);
    }

    /**
     * Scope to filter by spindle range
     */
    public function scopeSpindleRange($query, int $from, int $to)
    {
        return $query->whereBetween('spindle_number', [$from, $to]);
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
     * Scope to order by spindle number
     */
    public function scopeOrderBySpindle($query, string $direction = 'asc')
    {
        return $query->orderBy('spindle_number', $direction);
    }

    // =========================================================================
    // ACCESSORS
    // =========================================================================

    /**
     * Get the position label (e.g., "Spindle #42")
     */
    public function getPositionLabelAttribute(): string
    {
        return "Spindle #{$this->spindle_number}";
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
     * Get the average value (calculated column, but accessible as property)
     */
    public function getCalculatedAvgAttribute(): ?float
    {
        if ($this->max_value === null || $this->min_value === null) {
            return null;
        }

        return ($this->max_value + $this->min_value) / 2;
    }

    /**
     * Get the range value (calculated column, but accessible as property)
     */
    public function getCalculatedRangeAttribute(): ?float
    {
        if ($this->max_value === null || $this->min_value === null) {
            return null;
        }

        return $this->max_value - $this->min_value;
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
        static::saving(function (TwistingMeasurement $measurement) {
            $measurement->updateCalculatedFields();
        });
    }

    /**
     * Get summary data for this measurement
     */
    public function getSummary(): array
    {
        return [
            'spindle_number' => $this->spindle_number,
            'position_label' => $this->position_label,
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
     * Create measurements for all spindles of a record
     */
    public static function initializeForRecord(int $tensionRecordId): void
    {
        $measurements = [];
        $now = now();

        for ($spindle = 1; $spindle <= self::MAX_SPINDLES; $spindle++) {
            $measurements[] = [
                'tension_record_id' => $tensionRecordId,
                'spindle_number' => $spindle,
                'max_value' => null,
                'min_value' => null,
                'is_complete' => false,
                'is_out_of_spec' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        self::insert($measurements);
    }
}
