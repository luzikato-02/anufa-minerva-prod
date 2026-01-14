<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SyncClientDevice extends Model
{
    protected $fillable = [
        'client_identifier',
        'device_name',
        'device_type',
        'os_info',
        'app_version',
        'user_id',
        'last_sync_at',
        'sync_settings',
        'is_active',
    ];

    protected $casts = [
        'sync_settings' => 'array',
        'last_sync_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function checkpoints(): HasMany
    {
        return $this->hasMany(SyncCheckpoint::class, 'client_identifier', 'client_identifier');
    }

    public function transportLogs(): HasMany
    {
        return $this->hasMany(SyncTransportLog::class, 'client_identifier', 'client_identifier');
    }

    public function conflicts(): HasMany
    {
        return $this->hasMany(DataConflict::class, 'client_identifier', 'client_identifier');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function updateLastSync(): void
    {
        $this->update(['last_sync_at' => now()]);
    }

    /**
     * Register or update a device
     */
    public static function registerDevice(array $deviceInfo, ?int $userId = null): self
    {
        return self::updateOrCreate(
            ['client_identifier' => $deviceInfo['client_identifier']],
            [
                'device_name' => $deviceInfo['device_name'] ?? null,
                'device_type' => $deviceInfo['device_type'] ?? 'desktop',
                'os_info' => $deviceInfo['os_info'] ?? null,
                'app_version' => $deviceInfo['app_version'] ?? null,
                'user_id' => $userId,
                'is_active' => true,
            ]
        );
    }
}
