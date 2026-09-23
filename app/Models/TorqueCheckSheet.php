<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/** One torque-check sheet: a dated grid of readings for one machine/side, checked against a creel type's standard. */
class TorqueCheckSheet extends Model
{
    use HasFactory, SoftDeletes, LogsActivity;

    protected $fillable = ['client_uuid', 'check_date', 'operator_name', 'machine_number', 'side', 'creel_type_id', 'user_id'];

    protected $casts = [
        'check_date' => 'date:Y-m-d',
    ];

    public function readings(): HasMany
    {
        return $this->hasMany(TorqueCheckReading::class)->orderBy('row_no')->orderBy('column_letter');
    }

    public function creelType(): BelongsTo
    {
        return $this->belongsTo(CreelType::class);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['check_date', 'operator_name', 'machine_number', 'side', 'creel_type_id'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
