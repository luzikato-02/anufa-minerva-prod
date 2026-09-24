<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/** One cell of the torque grid: a side/row/column position, its reading, and an optional note if it was out of range. */
class TorqueCheckReading extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['torque_check_sheet_id', 'side', 'row_no', 'column_letter', 'value', 'note', 'client_uuid', 'user_id'];

    protected $casts = [
        'row_no' => 'integer',
        'value' => 'float',
    ];

    /** The app only knows a reading by the uuid it generated, so routes accept that as well as the numeric id. */
    public function resolveRouteBinding($value, $field = null)
    {
        return $this->where(Str::isUuid($value) ? 'client_uuid' : 'id', $value)->first();
    }

    public function sheet(): BelongsTo
    {
        return $this->belongsTo(TorqueCheckSheet::class, 'torque_check_sheet_id');
    }
}
