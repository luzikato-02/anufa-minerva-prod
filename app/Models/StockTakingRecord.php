<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class StockTakingRecord extends Model
{
    use HasFactory, SoftDeletes, LogsActivity;

    protected $fillable = [
        'session_id',
        'indv_batch_data',
        'metadata',
        'user_id', // if you have user authentication
    ];

    protected $casts = [
        'indv_batch_data' => 'array',
        'metadata' => 'array',
        'recorded_batches' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'stock_take_summary' => 'array',
    ];

    // Scopes for filtering

    public function scopeByLeader($query, $operator)
    {
        return $query->whereJsonContains('metadata->session_leader', $operator);
    }

    /**
     * Find a record by its primary key or its session_id.
     */
    public function scopeForSessionOrId($query, $id)
    {
        return $query->where('id', $id)->orWhere('session_id', $id);
    }

    // Accessors
    public function getLeaderAttribute()
    {
        return $this->metadata['session_leader'] ?? null;
    }

    public function getSessionLeaderAttribute()
    {
        return $this->metadata['session_leader'] ?? null;
    }

    public function getSessionStatusAttribute()
    {
        return $this->metadata['session_status'] ?? null;
    }

    public function getTotalBatchesAttribute()
    {
        return $this->metadata['total_batches'] ?? 0;
    }

    public function getTotalMaterialsAttribute()
    {
        return $this->metadata['total_materials'] ?? 0;
    }

    public function getTotalCheckedBatchesAttribute()
    {
        return $this->metadata['total_checked_batches'] ?? 0;
    }

    // Automatically recompute before saving
    protected static function booted()
    {
        static::saving(function ($record) {
            $record->stock_take_summary = $record->combineBatchData();
        });
    }

    public function combineBatchData()
{
    $indv = collect($this->indv_batch_data ?? []);
    $recorded = collect($this->recorded_batches ?? []);

    // Create a lookup map from recorded batches
    $recordedMap = $recorded->keyBy(fn($item) => $item['batch_number']);

    $combined = $indv->map(function ($batch) use ($recordedMap) {
        // Normalize key from indv_batch_data
        $batchNumber = $batch['batch_number'] ?? null;
        $recorded = $recordedMap->get($batchNumber);

        return [
            'batch_number' => $batchNumber,
            'material_code' => $batch['material_code'] ?? null,
            'material_description' => $batch['material_description'] ?? null,
            'is_recorded' => $recorded ? true : false,
            'actual_weight' => $recorded['actual_weight'] ?? null,
            'total_bobbins' => $recorded['total_bobbins'] ?? null,
            'line_position' => $recorded['line_position'] ?? null,
            'row_position' => $recorded['row_position'] ?? null,
            'timestamp_found' => $recorded['timestamp_found'] ?? null,
            'recorded_at' => $recorded['recorded_at'] ?? null,
            'user_found' => $recorded['user_found'] ?? null,
            'explanation' => $recorded['explanation'] ?? null,
        ];
    });

    return $combined->values();
}

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['session_id', 'metadata'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
