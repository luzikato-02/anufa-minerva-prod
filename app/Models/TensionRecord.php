<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class TensionRecord extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * Record type constants
     */
    public const TYPE_TWISTING = 'twisting';
    public const TYPE_WEAVING = 'weaving';

    /**
     * Status constants
     */
    public const STATUS_DRAFT = 'draft';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_ARCHIVED = 'archived';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'record_type',
        'csv_data',
        'form_data',
        'measurement_data',
        'problems',
        'metadata',
        'user_id',
        // Normalized common fields
        'operator',
        'machine_number',
        'item_number',
        'item_description',
        'meters_check',
        'spec_tension',
        'tension_tolerance',
        // Twisting-specific fields
        'dtex_number',
        'tpm',
        'rpm',
        'yarn_code',
        // Weaving-specific fields
        'production_order',
        'bale_number',
        'color_code',
        // Progress tracking
        'total_measurements',
        'completed_measurements',
        'progress_percentage',
        // Session info
        'recording_started_at',
        'recording_completed_at',
        'status',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'form_data' => 'array',
        'measurement_data' => 'array',
        'problems' => 'array',
        'metadata' => 'array',
        'meters_check' => 'decimal:2',
        'spec_tension' => 'decimal:2',
        'tension_tolerance' => 'decimal:2',
        'tpm' => 'integer',
        'rpm' => 'integer',
        'total_measurements' => 'integer',
        'completed_measurements' => 'integer',
        'progress_percentage' => 'integer',
        'recording_started_at' => 'datetime',
        'recording_completed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var array<int, string>
     */
    protected $appends = [
        'is_complete',
        'has_problems',
        'tension_range',
    ];

    /**
     * Get all available record types
     */
    public static function getTypes(): array
    {
        return [
            self::TYPE_TWISTING => 'Twisting',
            self::TYPE_WEAVING => 'Weaving',
        ];
    }

    /**
     * Get all available statuses
     */
    public static function getStatuses(): array
    {
        return [
            self::STATUS_DRAFT => 'Draft',
            self::STATUS_IN_PROGRESS => 'In Progress',
            self::STATUS_COMPLETED => 'Completed',
            self::STATUS_ARCHIVED => 'Archived',
        ];
    }

    // =========================================================================
    // RELATIONSHIPS
    // =========================================================================

    /**
     * Get the user that owns the record.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the problems associated with this record.
     */
    public function tensionProblems(): HasMany
    {
        return $this->hasMany(TensionProblem::class);
    }

    /**
     * Get unresolved problems for this record.
     */
    public function unresolvedProblems(): HasMany
    {
        return $this->tensionProblems()->unresolved();
    }

    /**
     * Get critical problems for this record.
     */
    public function criticalProblems(): HasMany
    {
        return $this->tensionProblems()->critical();
    }

    /**
     * Get twisting measurements for this record.
     * Only applicable for twisting records.
     */
    public function twistingMeasurements(): HasMany
    {
        return $this->hasMany(TwistingMeasurement::class);
    }

    /**
     * Get weaving measurements for this record.
     * Only applicable for weaving records.
     */
    public function weavingMeasurements(): HasMany
    {
        return $this->hasMany(WeavingMeasurement::class);
    }

    /**
     * Get measurements for this record (polymorphic based on type).
     * Returns the appropriate relationship based on record_type.
     */
    public function measurements(): HasMany
    {
        if ($this->isTwisting()) {
            return $this->twistingMeasurements();
        }

        return $this->weavingMeasurements();
    }

    /**
     * Get completed measurements for this record.
     */
    public function completedMeasurements(): HasMany
    {
        return $this->measurements()->complete();
    }

    /**
     * Get out-of-spec measurements for this record.
     */
    public function outOfSpecMeasurements(): HasMany
    {
        return $this->measurements()->outOfSpec();
    }

    // =========================================================================
    // SCOPES
    // =========================================================================

    /**
     * Scope to filter by record type
     */
    public function scopeByType($query, string $type)
    {
        return $query->where('record_type', $type);
    }

    /**
     * Scope to filter twisting records only
     */
    public function scopeTwisting($query)
    {
        return $query->where('record_type', self::TYPE_TWISTING);
    }

    /**
     * Scope to filter weaving records only
     */
    public function scopeWeaving($query)
    {
        return $query->where('record_type', self::TYPE_WEAVING);
    }

    /**
     * Scope to filter by operator
     */
    public function scopeByOperator($query, string $operator)
    {
        return $query->where('operator', 'like', "%{$operator}%");
    }

    /**
     * Scope to filter by machine number
     */
    public function scopeByMachine($query, string $machineNumber)
    {
        return $query->where('machine_number', $machineNumber);
    }

    /**
     * Scope to filter by item number
     */
    public function scopeByItem($query, string $itemNumber)
    {
        return $query->where('item_number', 'like', "%{$itemNumber}%");
    }

    /**
     * Scope to filter by status
     */
    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope to filter completed records
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', self::STATUS_COMPLETED);
    }

    /**
     * Scope to filter records with problems
     */
    public function scopeWithProblems($query)
    {
        return $query->has('tensionProblems');
    }

    /**
     * Scope to filter records with unresolved problems
     */
    public function scopeWithUnresolvedProblems($query)
    {
        return $query->whereHas('tensionProblems', function ($q) {
            $q->unresolved();
        });
    }

    /**
     * Scope to filter by date range
     */
    public function scopeCreatedBetween($query, $startDate, $endDate)
    {
        return $query->whereBetween('created_at', [$startDate, $endDate]);
    }

    /**
     * Scope for global search
     */
    public function scopeSearch($query, string $search)
    {
        return $query->where(function ($q) use ($search) {
            $q->where('operator', 'like', "%{$search}%")
                ->orWhere('machine_number', 'like', "%{$search}%")
                ->orWhere('item_number', 'like', "%{$search}%")
                ->orWhere('item_description', 'like', "%{$search}%")
                ->orWhere('yarn_code', 'like', "%{$search}%")
                ->orWhere('production_order', 'like', "%{$search}%");
        });
    }

    // =========================================================================
    // ACCESSORS
    // =========================================================================

    /**
     * Check if the record is complete
     */
    public function getIsCompleteAttribute(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    /**
     * Check if the record has any problems
     */
    public function getHasProblemsAttribute(): bool
    {
        return $this->tensionProblems()->exists();
    }

    /**
     * Get the tension range string
     */
    public function getTensionRangeAttribute(): ?string
    {
        if ($this->spec_tension === null) {
            return null;
        }

        $tolerance = $this->tension_tolerance ?? 0;
        $min = $this->spec_tension - $tolerance;
        $max = $this->spec_tension + $tolerance;

        return "{$min} - {$max}";
    }

    /**
     * Get the record type display name
     */
    public function getRecordTypeNameAttribute(): string
    {
        return self::getTypes()[$this->record_type] ?? $this->record_type;
    }

    /**
     * Get the status display name
     */
    public function getStatusNameAttribute(): string
    {
        return self::getStatuses()[$this->status] ?? $this->status;
    }

    /**
     * Get problems count
     */
    public function getProblemsCountAttribute(): int
    {
        return $this->tensionProblems()->count();
    }

    /**
     * Get unresolved problems count
     */
    public function getUnresolvedProblemsCountAttribute(): int
    {
        return $this->unresolvedProblems()->count();
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Check if this is a twisting record
     */
    public function isTwisting(): bool
    {
        return $this->record_type === self::TYPE_TWISTING;
    }

    /**
     * Check if this is a weaving record
     */
    public function isWeaving(): bool
    {
        return $this->record_type === self::TYPE_WEAVING;
    }

    /**
     * Mark record as completed
     */
    public function markAsCompleted(): self
    {
        $this->update([
            'status' => self::STATUS_COMPLETED,
            'recording_completed_at' => now(),
        ]);

        return $this;
    }

    /**
     * Mark record as archived
     */
    public function archive(): self
    {
        $this->update(['status' => self::STATUS_ARCHIVED]);
        return $this;
    }

    /**
     * Add a problem to this record
     */
    public function addProblem(array $problemData): TensionProblem
    {
        return $this->tensionProblems()->create($problemData);
    }

    /**
     * Get CSV filename for download
     */
    public function getCsvFilename(): string
    {
        return sprintf(
            '%s-%s-%s-%s-%s.csv',
            $this->record_type,
            $this->item_number ?? 'unknown',
            $this->machine_number ?? 'unknown',
            $this->created_at->format('Y-m-d'),
            str_replace(' ', '_', $this->operator ?? 'unknown')
        );
    }

    /**
     * Calculate and update progress
     */
    public function updateProgress(int $completed, int $total): self
    {
        $percentage = $total > 0 ? min(100, round(($completed / $total) * 100)) : 0;

        $this->update([
            'completed_measurements' => $completed,
            'total_measurements' => $total,
            'progress_percentage' => $percentage,
        ]);

        return $this;
    }

    /**
     * Get summary statistics for this record
     */
    public function getSummary(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->record_type,
            'type_name' => $this->record_type_name,
            'operator' => $this->operator,
            'machine_number' => $this->machine_number,
            'item_number' => $this->item_number,
            'progress' => "{$this->progress_percentage}%",
            'measurements' => "{$this->completed_measurements}/{$this->total_measurements}",
            'status' => $this->status_name,
            'problems_count' => $this->problems_count,
            'unresolved_problems' => $this->unresolved_problems_count,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }

    // =========================================================================
    // MEASUREMENT HELPER METHODS
    // =========================================================================

    /**
     * Initialize measurement records for this tension record.
     * Creates empty measurement slots based on record type.
     */
    public function initializeMeasurements(): void
    {
        if ($this->isTwisting()) {
            TwistingMeasurement::initializeForRecord($this->id);
        } else {
            WeavingMeasurement::initializeForRecord($this->id);
        }
    }

    /**
     * Get measurement statistics for this record.
     */
    public function getMeasurementStats(): array
    {
        $measurements = $this->measurements();

        return [
            'total' => $measurements->count(),
            'completed' => $measurements->complete()->count(),
            'incomplete' => $measurements->incomplete()->count(),
            'in_spec' => $measurements->inSpec()->complete()->count(),
            'out_of_spec' => $measurements->outOfSpec()->count(),
        ];
    }

    /**
     * Recalculate and update progress based on actual measurements.
     */
    public function recalculateProgress(): self
    {
        $stats = $this->getMeasurementStats();

        return $this->updateProgress($stats['completed'], $stats['total']);
    }

    /**
     * Update out-of-spec status for all measurements based on current spec.
     */
    public function updateMeasurementSpecStatus(): void
    {
        if ($this->spec_tension === null) {
            return;
        }

        $tolerance = $this->tension_tolerance ?? 0;
        $minSpec = $this->spec_tension - $tolerance;
        $maxSpec = $this->spec_tension + $tolerance;

        // Get the appropriate measurements relationship
        $measurements = $this->isTwisting()
            ? $this->twistingMeasurements()->where('is_complete', true)->get()
            : $this->weavingMeasurements()->where('is_complete', true)->get();

        // Update each measurement
        foreach ($measurements as $measurement) {
            $avgValue = $measurement->avg_value ?? (($measurement->max_value + $measurement->min_value) / 2);
            $isOutOfSpec = $avgValue < $minSpec || $avgValue > $maxSpec;

            if ($measurement->is_out_of_spec !== $isOutOfSpec) {
                $measurement->update(['is_out_of_spec' => $isOutOfSpec]);
            }
        }
    }

    /**
     * Get measurements grouped by position for display.
     * For twisting: grouped by spindle ranges
     * For weaving: grouped by side and row
     */
    public function getMeasurementsGrouped(): array
    {
        if ($this->isTwisting()) {
            return $this->getTwistingMeasurementsGrouped();
        }

        return $this->getWeavingMeasurementsGrouped();
    }

    /**
     * Get twisting measurements grouped by spindle ranges.
     */
    private function getTwistingMeasurementsGrouped(): array
    {
        $measurements = $this->twistingMeasurements()
            ->orderBy('spindle_number')
            ->get();

        return [
            'spindles_1_21' => $measurements->whereBetween('spindle_number', [1, 21])->values(),
            'spindles_22_42' => $measurements->whereBetween('spindle_number', [22, 42])->values(),
            'spindles_43_63' => $measurements->whereBetween('spindle_number', [43, 63])->values(),
            'spindles_64_84' => $measurements->whereBetween('spindle_number', [64, 84])->values(),
        ];
    }

    /**
     * Get weaving measurements grouped by side and row.
     */
    private function getWeavingMeasurementsGrouped(): array
    {
        $measurements = $this->weavingMeasurements()
            ->orderByPosition()
            ->get();

        $grouped = [];
        foreach (WeavingMeasurement::getCreelSides() as $sideCode => $sideName) {
            $grouped[$sideCode] = [];
            foreach (WeavingMeasurement::getRows() as $rowCode => $rowName) {
                $grouped[$sideCode][$rowCode] = $measurements
                    ->where('creel_side', $sideCode)
                    ->where('row_number', $rowCode)
                    ->values();
            }
        }

        return $grouped;
    }

    /**
     * Get average tension value across all completed measurements.
     */
    public function getAverageTension(): ?float
    {
        return $this->measurements()
            ->complete()
            ->avg('avg_value');
    }

    /**
     * Get tension statistics (min, max, avg, std dev).
     */
    public function getTensionStatistics(): array
    {
        $query = $this->measurements()->complete();

        return [
            'min' => $query->min('avg_value'),
            'max' => $query->max('avg_value'),
            'avg' => $query->avg('avg_value'),
            'count' => $query->count(),
        ];
    }
}
