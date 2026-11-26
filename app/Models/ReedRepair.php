<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReedRepair extends Model
{
    protected $fillable = ['reed_id', 'vendor', 'defects', 'sent_on', 'returned_on', 'cost', 'work_done'];

    protected $casts = [
        'reed_id' => 'integer',
        'sent_on' => 'date:Y-m-d',
        'returned_on' => 'date:Y-m-d',
        'cost' => 'float',
    ];

    public function reed(): BelongsTo
    {
        return $this->belongsTo(Reed::class);
    }
}
