<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/** One paper stock sheet: a dated list of spool lots recorded by one person. */
class StockSheet extends Model
{
    use HasFactory, SoftDeletes, LogsActivity;

    protected $fillable = ['client_uuid', 'session_id', 'sheet_date', 'leader', 'note', 'user_id'];

    protected $casts = [
        'sheet_date' => 'date:Y-m-d',
    ];

    /**
     * Find by the operator-facing session id (typed to resume elsewhere), the numeric id, or the creating
     * device's own client uuid — the last of these lets a device that saved its first row while offline
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

    public function rows(): HasMany
    {
        return $this->hasMany(StockSheetRow::class)->orderBy('line_no');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['sheet_date', 'leader', 'note'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
