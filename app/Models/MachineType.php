<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MachineType extends Model
{
    protected $fillable = [
        'type_name', 'total_spindles',
        'rpm_min', 'rpm_max',
        'min_runtime_hours', 'max_runtime_hours',
        'description',
    ];

    protected $casts = [
        'total_spindles'    => 'integer',
        'rpm_min'           => 'integer',
        'rpm_max'           => 'integer',
        'min_runtime_hours' => 'decimal:3',
        'max_runtime_hours' => 'decimal:3',
    ];

    public function machineDefinitions(): HasMany
    {
        return $this->hasMany(MachineDefinition::class);
    }
}
