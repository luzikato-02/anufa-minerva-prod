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

    protected $fillable = ['client_uuid', 'session_id', 'check_date', 'operator_name', 'machine_number', 'side', 'creel_type_id', 'user_id'];

    protected $casts = [
        'check_date' => 'date:Y-m-d',
    ];

    /**
     * Find by the operator-facing session id (typed to resume elsewhere), the numeric id, or the creating
     * device's own client uuid — the last of these lets a device that saved its first cell while offline
     * discover the session id it was assigned once it is back online.
     */
    public function scopeForSessionOrId($query, $id)
    {
        return $query->where('id', $id)->orWhere('session_id', $id)->orWhere('client_uuid', $id);
    }

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
