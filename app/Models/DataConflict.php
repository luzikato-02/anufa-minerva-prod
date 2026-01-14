<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DataConflict extends Model
{
    protected $fillable = [
        'table_name',
        'local_record_id',
        'remote_record_id',
        'local_data',
        'remote_data',
        'conflict_fields',
        'resolution_status',
        'resolved_by_user_id',
        'resolved_at',
        'resolution_notes',
        'merged_data',
        'client_identifier',
    ];

    protected $casts = [
        'local_data' => 'array',
        'remote_data' => 'array',
        'conflict_fields' => 'array',
        'merged_data' => 'array',
        'resolved_at' => 'datetime',
    ];

    // Resolution statuses
    const STATUS_PENDING = 'pending';
    const STATUS_LOCAL_WINS = 'local_wins';
    const STATUS_REMOTE_WINS = 'remote_wins';
    const STATUS_MERGED = 'merged';
    const STATUS_DISMISSED = 'dismissed';

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by_user_id');
    }

    public function scopePending($query)
    {
        return $query->where('resolution_status', self::STATUS_PENDING);
    }

    public function scopeResolved($query)
    {
        return $query->whereNotIn('resolution_status', [self::STATUS_PENDING]);
    }

    public function scopeForTable($query, string $tableName)
    {
        return $query->where('table_name', $tableName);
    }

    public function scopeForClient($query, string $clientIdentifier)
    {
        return $query->where('client_identifier', $clientIdentifier);
    }

    public function resolve(string $status, ?int $userId = null, ?string $notes = null, ?array $mergedData = null): void
    {
        $this->update([
            'resolution_status' => $status,
            'resolved_by_user_id' => $userId,
            'resolved_at' => now(),
            'resolution_notes' => $notes,
            'merged_data' => $mergedData,
        ]);
    }

    public function resolveWithLocalData(?int $userId = null, ?string $notes = null): void
    {
        $this->resolve(self::STATUS_LOCAL_WINS, $userId, $notes, $this->local_data);
    }

    public function resolveWithRemoteData(?int $userId = null, ?string $notes = null): void
    {
        $this->resolve(self::STATUS_REMOTE_WINS, $userId, $notes, $this->remote_data);
    }

    public function resolveWithMergedData(array $mergedData, ?int $userId = null, ?string $notes = null): void
    {
        $this->resolve(self::STATUS_MERGED, $userId, $notes, $mergedData);
    }

    public function dismiss(?int $userId = null, ?string $notes = null): void
    {
        $this->resolve(self::STATUS_DISMISSED, $userId, $notes);
    }

    /**
     * Get the table-friendly name
     */
    public function getTableDisplayNameAttribute(): string
    {
        $names = [
            'tension_records' => 'Tension Records',
            'twisting_measurements' => 'Twisting Measurements',
            'weaving_measurements' => 'Weaving Measurements',
            'tension_problems' => 'Tension Problems',
            'stock_taking_records' => 'Stock Taking Records',
            'finish_earlier_records' => 'Finish Earlier Records',
        ];

        return $names[$this->table_name] ?? $this->table_name;
    }

    /**
     * Get diff between local and remote data
     */
    public function getDiff(): array
    {
        $diff = [];
        
        foreach ($this->conflict_fields as $field) {
            $diff[$field] = [
                'local' => $this->local_data[$field] ?? null,
                'remote' => $this->remote_data[$field] ?? null,
            ];
        }

        return $diff;
    }
}
