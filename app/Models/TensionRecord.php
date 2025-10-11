<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TensionRecord extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'record_type',
        'csv_data',
        'form_data',
        'measurement_data',
        'problems',
        'metadata',
        'user_id', // if you have user authentication
    ];

    protected $casts = [
        'form_data' => 'array',
        'measurement_data' => 'array',
        'problems' => 'array',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // Scopes for filtering
    public function scopeByType($query, $type)
    {
        return $query->where('record_type', $type);
    }

    public function scopeByOperator($query, $operator)
    {
        return $query->whereJsonContains('metadata->operator', $operator);
    }

    public function scopeByMachine($query, $machineNumber)
    {
        return $query->whereJsonContains('metadata->machine_number', $machineNumber);
    }

    // Accessors
    public function getOperatorAttribute()
    {
        return $this->metadata['operator'] ?? null;
    }

    public function getMachineNumberAttribute()
    {
        return $this->metadata['machine_number'] ?? null;
    }

    public function getItemNumberAttribute()
    {
        return $this->metadata['item_number'] ?? null;
    }

    public function getProgressPercentageAttribute()
    {
        return $this->metadata['progress_percentage'] ?? 0;
    }

    public function getTotalMeasurementsAttribute()
    {
        return $this->metadata['total_measurements'] ?? 0;
    }

    public function getCompletedMeasurementsAttribute()
    {
        return $this->metadata['completed_measurements'] ?? 0;
    }
}
