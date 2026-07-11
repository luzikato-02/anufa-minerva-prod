<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RuntimeShiftAggregate extends Model
{
    protected $fillable = [
        'upload_batch_id', 'machine_number', 'year', 'month', 'date', 'shift',
        'total_runtime_hours', 'actual_machine_runtime', 'avg_rpm',
        'styles', 'styles_parsed', 'has_multi_style', 'has_speed_outlier', 'has_runtime_outlier',
        'machine_definition_id',
    ];

    protected $casts = [
        'date'                  => 'date',
        'styles'                => 'array',
        'styles_parsed'         => 'array',
        'total_runtime_hours'   => 'decimal:3',
        'actual_machine_runtime'=> 'decimal:5',
        'avg_rpm'               => 'decimal:2',
        'has_multi_style'       => 'boolean',
        'has_speed_outlier'     => 'boolean',
        'has_runtime_outlier'   => 'boolean',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(RuntimeUploadBatch::class, 'upload_batch_id');
    }

    public function machineDefinition(): BelongsTo
    {
        return $this->belongsTo(MachineDefinition::class);
    }
}
