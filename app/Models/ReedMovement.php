<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One line of a reed's history. Insert-only: nothing updates or deletes these rows. */
class ReedMovement extends Model
{
    protected $fillable = [
        'reed_id', 'type', 'from_status', 'to_status', 'from_location_id', 'to_location_id', 'loom_number',
        'fabric_style_id', 'order_no', 'meters', 'note', 'client_uuid', 'user_id', 'occurred_at',
    ];

    protected $casts = [
        'reed_id' => 'integer',
        'meters' => 'float',
        'occurred_at' => 'datetime',
    ];

    public function reed(): BelongsTo
    {
        return $this->belongsTo(Reed::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function fromLocation(): BelongsTo
    {
        return $this->belongsTo(ReedLocation::class, 'from_location_id');
    }

    public function toLocation(): BelongsTo
    {
        return $this->belongsTo(ReedLocation::class, 'to_location_id');
    }

    public function fabricStyle(): BelongsTo
    {
        return $this->belongsTo(ReedFabricStyle::class, 'fabric_style_id');
    }
}
