<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReedInspection extends Model
{
    /** Checklist items; each is true when the defect was found. */
    public const CHECKS = ['bent_dents', 'open_dents', 'worn_wires', 'rust', 'binding_damage', 'not_straight'];

    protected $fillable = ['reed_id', 'grade', 'checklist', 'defect_dents', 'note', 'user_id', 'inspected_at'];

    protected $casts = [
        'reed_id' => 'integer',
        'checklist' => 'array',
        'inspected_at' => 'datetime',
    ];

    public function reed(): BelongsTo
    {
        return $this->belongsTo(Reed::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
