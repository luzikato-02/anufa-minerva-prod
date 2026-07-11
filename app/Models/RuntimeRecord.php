<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RuntimeRecord extends Model
{
    protected $fillable = [
        'upload_batch_id', 'machine_id', 'machine_number', 'side',
        'year', 'month', 'date', 'shift',
        'style_description', 'yarn_type', 'dtex', 'tpm', 'yarn_code', 'machine_code', 'counter_length',
        'runtime_hours', 'actual_runtime_hours', 'rpm',
        'machine_definition_id', 'user_id',
    ];

    protected $casts = [
        'date'                 => 'date',
        'runtime_hours'        => 'decimal:3',
        'actual_runtime_hours' => 'decimal:5',
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
