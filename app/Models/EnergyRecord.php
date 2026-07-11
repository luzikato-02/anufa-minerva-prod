<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EnergyRecord extends Model
{
    protected $fillable = [
        'upload_batch_id', 'machine_number', 'year', 'month', 'shift', 'energy_kwh',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(EnergyUploadBatch::class, 'upload_batch_id');
    }
}
