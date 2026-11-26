<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/** A rack slot (or any named place) where reeds are stored. */
class ReedLocation extends Model
{
    use LogsActivity;

    protected $fillable = ['code', 'zone', 'notes'];

    public function reeds(): HasMany
    {
        return $this->hasMany(Reed::class, 'location_id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable()->logOnlyDirty()->dontSubmitEmptyLogs();
    }
}
