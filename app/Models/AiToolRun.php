<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Audit row for one tool the data chat ran: what it asked for, how much came back, and how long it took. */
class AiToolRun extends Model
{
    protected $fillable = ['ai_message_id', 'user_id', 'tool', 'arguments', 'row_count', 'duration_ms', 'error'];

    protected $casts = [
        'arguments' => 'array',
        'row_count' => 'integer',
        'duration_ms' => 'integer',
    ];

    public function message(): BelongsTo
    {
        return $this->belongsTo(AiMessage::class, 'ai_message_id');
    }
}
