<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RuntimeUploadBatch extends Model
{
    protected $fillable = [
        'file_name', 'year', 'month', 'row_count', 'skipped_count', 'user_id',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function records(): HasMany
    {
        return $this->hasMany(RuntimeRecord::class, 'upload_batch_id');
    }

    public function aggregates(): HasMany
    {
        return $this->hasMany(RuntimeShiftAggregate::class, 'upload_batch_id');
    }
}
