<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TensionProblem extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tension_record_id',
        'position_identifier',
        'problem_type',
        'description',
        'measured_value',
        'expected_min',
        'expected_max',
        'severity',
        'resolution_status',
        'resolution_notes',
        'resolved_at',
        'resolved_by',
        'reported_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'measured_value' => 'decimal:2',
        'expected_min' => 'decimal:2',
        'expected_max' => 'decimal:2',
        'reported_at' => 'datetime',
        'resolved_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Problem type constants
     */
    public const TYPE_TENSION_HIGH = 'tension_high';
    public const TYPE_TENSION_LOW = 'tension_low';
    public const TYPE_EQUIPMENT_MALFUNCTION = 'equipment_malfunction';
    public const TYPE_YARN_BREAK = 'yarn_break';
    public const TYPE_QUALITY_ISSUE = 'quality_issue';
    public const TYPE_OTHER = 'other';

    /**
     * Severity level constants
     */
    public const SEVERITY_LOW = 'low';
    public const SEVERITY_MEDIUM = 'medium';
    public const SEVERITY_HIGH = 'high';
    public const SEVERITY_CRITICAL = 'critical';

    /**
     * Resolution status constants
     */
    public const STATUS_OPEN = 'open';
    public const STATUS_ACKNOWLEDGED = 'acknowledged';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_RESOLVED = 'resolved';
    public const STATUS_IGNORED = 'ignored';

    /**
     * Get all available problem types
     */
    public static function getTypes(): array
    {
        return [
            self::TYPE_TENSION_HIGH => 'Tension Too High',
            self::TYPE_TENSION_LOW => 'Tension Too Low',
            self::TYPE_EQUIPMENT_MALFUNCTION => 'Equipment Malfunction',
            self::TYPE_YARN_BREAK => 'Yarn Break',
            self::TYPE_QUALITY_ISSUE => 'Quality Issue',
            self::TYPE_OTHER => 'Other',
        ];
    }

    /**
     * Get all severity levels
     */
    public static function getSeverityLevels(): array
    {
        return [
            self::SEVERITY_LOW => 'Low',
            self::SEVERITY_MEDIUM => 'Medium',
            self::SEVERITY_HIGH => 'High',
            self::SEVERITY_CRITICAL => 'Critical',
        ];
    }

    /**
     * Get all resolution statuses
     */
    public static function getResolutionStatuses(): array
    {
        return [
            self::STATUS_OPEN => 'Open',
            self::STATUS_ACKNOWLEDGED => 'Acknowledged',
            self::STATUS_IN_PROGRESS => 'In Progress',
            self::STATUS_RESOLVED => 'Resolved',
            self::STATUS_IGNORED => 'Ignored',
        ];
    }

    /**
     * Get the tension record that this problem belongs to.
     */
    public function tensionRecord(): BelongsTo
    {
        return $this->belongsTo(TensionRecord::class);
    }

    /**
     * Get the user who resolved this problem.
     */
    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    /**
     * Scope to filter by problem type
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('problem_type', $type);
    }

    /**
     * Scope to filter by severity
     */
    public function scopeBySeverity($query, string $severity)
    {
        return $query->where('severity', $severity);
    }

    /**
     * Scope to filter by resolution status
     */
    public function scopeByStatus($query, string $status)
    {
        return $query->where('resolution_status', $status);
    }

    /**
     * Scope to get unresolved problems
     */
    public function scopeUnresolved($query)
    {
        return $query->whereIn('resolution_status', [
            self::STATUS_OPEN,
            self::STATUS_ACKNOWLEDGED,
            self::STATUS_IN_PROGRESS,
        ]);
    }

    /**
     * Scope to get resolved problems
     */
    public function scopeResolved($query)
    {
        return $query->where('resolution_status', self::STATUS_RESOLVED);
    }

    /**
     * Scope to get critical problems
     */
    public function scopeCritical($query)
    {
        return $query->where('severity', self::SEVERITY_CRITICAL);
    }

    /**
     * Check if the problem is resolved
     */
    public function isResolved(): bool
    {
        return $this->resolution_status === self::STATUS_RESOLVED;
    }

    /**
     * Check if the problem needs attention (unresolved and high/critical severity)
     */
    public function needsAttention(): bool
    {
        return !$this->isResolved() &&
            in_array($this->severity, [self::SEVERITY_HIGH, self::SEVERITY_CRITICAL]);
    }

    /**
     * Mark the problem as resolved
     */
    public function markAsResolved(?int $userId = null, ?string $notes = null): self
    {
        $this->update([
            'resolution_status' => self::STATUS_RESOLVED,
            'resolved_at' => now(),
            'resolved_by' => $userId ?? auth()->id(),
            'resolution_notes' => $notes,
        ]);

        return $this;
    }

    /**
     * Get formatted position identifier based on record type
     */
    public function getFormattedPositionAttribute(): string
    {
        $recordType = $this->tensionRecord?->record_type;

        if ($recordType === 'twisting') {
            return "Spindle #{$this->position_identifier}";
        }

        return "Position: {$this->position_identifier}";
    }

    /**
     * Get human-readable problem type
     */
    public function getProblemTypeNameAttribute(): string
    {
        return self::getTypes()[$this->problem_type] ?? $this->problem_type;
    }

    /**
     * Get human-readable severity
     */
    public function getSeverityNameAttribute(): string
    {
        return self::getSeverityLevels()[$this->severity] ?? $this->severity;
    }

    /**
     * Get human-readable resolution status
     */
    public function getResolutionStatusNameAttribute(): string
    {
        return self::getResolutionStatuses()[$this->resolution_status] ?? $this->resolution_status;
    }
}
