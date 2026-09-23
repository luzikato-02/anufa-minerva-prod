<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/** A category of creel with its own acceptable torque range, set by an admin/engineer. */
class CreelType extends Model
{
    use HasFactory, SoftDeletes, LogsActivity;

    protected $fillable = ['name', 'torque_min', 'torque_max'];

    protected $casts = [
        'torque_min' => 'float',
        'torque_max' => 'float',
    ];

    public function torqueCheckSheets(): HasMany
    {
        return $this->hasMany(TorqueCheckSheet::class);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['name', 'torque_min', 'torque_max'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
