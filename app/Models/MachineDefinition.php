<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MachineDefinition extends Model
{
    protected $fillable = [
        'machine_number', 'machine_type_id', 'is_active', 'notes',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function machineType(): BelongsTo
    {
        return $this->belongsTo(MachineType::class);
    }
}
