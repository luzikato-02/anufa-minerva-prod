<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/** One paper stock sheet: a dated list of spool lots recorded by one person. */
class StockSheet extends Model
{
    use HasFactory, SoftDeletes, LogsActivity;

    protected $fillable = ['client_uuid', 'sheet_date', 'leader', 'note', 'user_id'];

    protected $casts = [
        'sheet_date' => 'date:Y-m-d',
    ];

    public function rows(): HasMany
    {
        return $this->hasMany(StockSheetRow::class)->orderBy('line_no');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['sheet_date', 'leader', 'note'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
