<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * A reed catalogue entry: dent density, size and wire. Many physical reeds share one spec.
 * Every attribute except the code and min_stock is free text, kept as typed.
 */
class ReedSpec extends Model
{
    use LogsActivity;

    protected $fillable = [
        'code', 'dents_per_10cm', 'width_mm', 'working_width_mm', 'height_mm', 'reed_type',
        'wire_profile', 'wire_thickness_mm', 'wire_material', 'min_stock', 'notes',
    ];

    protected $casts = [
        'min_stock' => 'integer',
    ];

    public function reeds(): HasMany
    {
        return $this->hasMany(Reed::class);
    }

    public function fabricStyles(): HasMany
    {
        return $this->hasMany(ReedFabricStyle::class);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logFillable()->logOnlyDirty()->dontSubmitEmptyLogs();
    }
}
