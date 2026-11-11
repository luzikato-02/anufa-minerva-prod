<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A saved set of tension records charted together (see the Compare window on
 * the tension records page). Record ids are kept in legend order.
 */
class TensionComparison extends Model
{
    public const METRICS = ['max', 'min', 'avg', 'spread'];

    public const MIN_RECORDS = 2;

    public const MAX_RECORDS = 8;

    protected $fillable = ['user_id', 'name', 'record_type', 'record_ids', 'metric', 'hidden_ids'];

    protected $casts = [
        'record_ids' => 'array',
        'hidden_ids' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
