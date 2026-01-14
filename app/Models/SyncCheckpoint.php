<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SyncCheckpoint extends Model
{
    protected $fillable = [
        'client_identifier',
        'table_name',
        'last_synced_at',
        'last_synced_id',
    ];

    protected $casts = [
        'last_synced_at' => 'datetime',
    ];

    /**
     * Get or create a checkpoint for a client and table
     */
    public static function getOrCreate(string $clientIdentifier, string $tableName): self
    {
        return self::firstOrCreate(
            [
                'client_identifier' => $clientIdentifier,
                'table_name' => $tableName,
            ],
            [
                'last_synced_at' => null,
                'last_synced_id' => null,
            ]
        );
    }

    /**
     * Update the checkpoint after a successful sync
     */
    public function updateCheckpoint(int $lastId, ?\DateTime $lastTime = null): void
    {
        $this->update([
            'last_synced_id' => $lastId,
            'last_synced_at' => $lastTime ?? now(),
        ]);
    }
}
