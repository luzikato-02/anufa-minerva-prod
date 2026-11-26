<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/** A fabric style (article) and the reed spec it runs with. */
class ReedFabricStyle extends Model
{
    use LogsActivity;

    protected $fillable = ['code', 'description', 'reed_spec_id', 'ends_per_10cm', 'is_active'];

    protected $casts = [
        'reed_spec_id' => 'integer',
        'ends_per_10cm' => 'float',
        'is_active' => 'boolean',
    ];

    public function reedSpec(): BelongsTo
    {
        return $this->belongsTo(ReedSpec::class);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable()->logOnlyDirty()->dontSubmitEmptyLogs();
    }
}
