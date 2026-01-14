<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SyncTransportLog extends Model
{
    protected $fillable = [
        'sync_direction',
        'table_name',
        'local_record_id',
        'remote_record_id',
        'action',
        'status',
        'payload',
        'error_message',
        'client_identifier',
        'user_id',
        'completed_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'completed_at' => 'datetime',
    ];

    // Sync directions
    const DIRECTION_UPLOAD = 'upload';
    const DIRECTION_DOWNLOAD = 'download';

    // Actions
    const ACTION_CREATE = 'create';
    const ACTION_UPDATE = 'update';
    const ACTION_DELETE = 'delete';

    // Statuses
    const STATUS_PENDING = 'pending';
    const STATUS_SUCCESS = 'success';
    const STATUS_FAILED = 'failed';
    const STATUS_CONFLICT = 'conflict';

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    public function scopeSuccessful($query)
    {
        return $query->where('status', self::STATUS_SUCCESS);
    }

    public function scopeFailed($query)
    {
        return $query->where('status', self::STATUS_FAILED);
    }

    public function scopeConflicts($query)
    {
        return $query->where('status', self::STATUS_CONFLICT);
    }

    public function scopeForTable($query, string $tableName)
    {
        return $query->where('table_name', $tableName);
    }

    public function scopeForClient($query, string $clientIdentifier)
    {
        return $query->where('client_identifier', $clientIdentifier);
    }

    public function markAsSuccess(?int $remoteRecordId = null): void
    {
        $this->update([
            'status' => self::STATUS_SUCCESS,
            'remote_record_id' => $remoteRecordId ?? $this->remote_record_id,
            'completed_at' => now(),
        ]);
    }

    public function markAsFailed(string $errorMessage): void
    {
        $this->update([
            'status' => self::STATUS_FAILED,
            'error_message' => $errorMessage,
            'completed_at' => now(),
        ]);
    }

    public function markAsConflict(): void
    {
        $this->update([
            'status' => self::STATUS_CONFLICT,
        ]);
    }
}
