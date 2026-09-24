<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/** One torque-check sheet: a dated set of readings for one machine, checked against a creel type's standard. Each
 * reading also carries its own side (Ai/Ao/Bi/Bo), so one sheet can hold a separate 105x5 grid per side. */
class TorqueCheckSheet extends Model
{
    use HasFactory, SoftDeletes, LogsActivity;

    protected $fillable = ['client_uuid', 'session_id', 'check_date', 'operator_name', 'machine_number', 'creel_type_id', 'user_id'];

    protected $casts = [
        'check_date' => 'date:Y-m-d',
    ];

    /**
     * Find by the operator-facing session id (typed to resume elsewhere), the numeric id, or the creating
     * device's own client uuid — the last of these lets a device that saved its first cell while offline
     * discover the session id it was assigned once it is back online.
     *
     * `id` and `client_uuid` are only compared when `$id` actually looks like their type (numeric, and a real
     * uuid, respectively): Postgres (unlike sqlite) rejects a mismatched value outright as a type error against
     * a bigint or native uuid column, even on one side of an `orWhere` that could never have matched anyway.
     */
    public function scopeForSessionOrId($query, $id)
    {
        return $query->where(function ($q) use ($id) {
            $q->where('session_id', $id);
            if (ctype_digit((string) $id)) {
                $q->orWhere('id', $id);
            }
            if (Str::isUuid($id)) {
                $q->orWhere('client_uuid', $id);
            }
        });
    }

    public function readings(): HasMany
    {
        return $this->hasMany(TorqueCheckReading::class)->orderBy('side')->orderBy('row_no')->orderBy('column_letter');
    }

    public function creelType(): BelongsTo
    {
        return $this->belongsTo(CreelType::class);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['check_date', 'operator_name', 'machine_number', 'creel_type_id'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
