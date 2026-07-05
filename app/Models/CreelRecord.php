<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class CreelRecord extends Model
{
    use HasFactory, SoftDeletes, LogsActivity;

    protected $fillable = [
        'order_number',
        'machine',
        'date_string',
        'operator',
        'material',
        'batches',
        'raw_batches',
        'metadata',
        'user_id',
    ];

    protected $casts = [
        'batches'     => 'array',
        'raw_batches' => 'array',
        'metadata'    => 'array',
        'created_at'  => 'datetime',
        'updated_at'  => 'datetime',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['order_number', 'metadata'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
