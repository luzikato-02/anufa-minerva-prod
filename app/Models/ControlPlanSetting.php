<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** The control plan module's settings: one row, created with the defaults on first use. */
class ControlPlanSetting extends Model
{
    protected $fillable = ['mill', 'org_plant', 'org_code', 'date_format', 'review_period_years'];

    protected $casts = [
        'review_period_years' => 'integer',
    ];

    public static function current(): self
    {
        return self::query()->first() ?? self::create([
            'mill' => '',
            'org_plant' => '',
            'org_code' => '',
            'date_format' => 'id',
            'review_period_years' => 2,
        ]);
    }
}
