<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/** A line on a stock sheet: colour, material, batch, production date, cheese count, weight, position, remark. */
class StockSheetRow extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'stock_sheet_id', 'line_no', 'color', 'material_code', 'batch', 'prod_date',
        'chs', 'actual_weight', 'position', 'remark', 'client_uuid', 'user_id',
    ];

    protected $casts = [
        'prod_date' => 'date:Y-m-d',
        'chs' => 'integer',
        'actual_weight' => 'float',
        'position' => 'integer',
        'line_no' => 'integer',
    ];

    /** The app only knows a row by the uuid it generated, so routes accept that as well as the numeric id. */
    public function resolveRouteBinding($value, $field = null)
    {
        return $this->where(Str::isUuid($value) ? 'client_uuid' : 'id', $value)->first();
    }

    public function sheet(): BelongsTo
    {
        return $this->belongsTo(StockSheet::class, 'stock_sheet_id');
    }
}
