<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One physical reed. Status, location and wear counters are a cache of the movement log; change them only
 * through App\Services\Reeds\ReedLifecycle so every change is logged.
 */
class Reed extends Model
{
    public const IN_STOCK = 'in_stock';

    public const RESERVED = 'reserved';

    public const ON_LOOM = 'on_loom';

    public const RETURNED = 'returned';

    public const QUARANTINE = 'quarantine';

    public const IN_REPAIR = 'in_repair';

    public const SCRAPPED = 'scrapped';

    public const STATUSES = [
        self::IN_STOCK, self::RESERVED, self::ON_LOOM, self::RETURNED,
        self::QUARANTINE, self::IN_REPAIR, self::SCRAPPED,
    ];

    /** A good, usable, needs repair, unusable. */
    public const GRADES = ['A', 'B', 'C', 'X'];

    protected $fillable = [
        'serial_no', 'reed_spec_id', 'status', 'grade', 'location_id', 'loom_number', 'fabric_style_id',
        'order_no', 'mounted_at', 'reserved_at', 'supplier', 'po_no', 'received_on', 'unit_cost',
        'meters_woven', 'days_mounted', 'issue_count', 'repair_count', 'last_inspected_at', 'notes',
    ];

    protected $casts = [
        'reed_spec_id' => 'integer',
        'location_id' => 'integer',
        'fabric_style_id' => 'integer',
        'mounted_at' => 'datetime',
        'reserved_at' => 'datetime',
        'received_on' => 'date:Y-m-d',
        'unit_cost' => 'float',
        'meters_woven' => 'float',
        'days_mounted' => 'integer',
        'issue_count' => 'integer',
        'repair_count' => 'integer',
        'last_inspected_at' => 'datetime',
    ];

    public function spec(): BelongsTo
    {
        return $this->belongsTo(ReedSpec::class, 'reed_spec_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(ReedLocation::class, 'location_id');
    }

    public function fabricStyle(): BelongsTo
    {
        return $this->belongsTo(ReedFabricStyle::class, 'fabric_style_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(ReedMovement::class);
    }

    public function inspections(): HasMany
    {
        return $this->hasMany(ReedInspection::class);
    }

    public function repairs(): HasMany
    {
        return $this->hasMany(ReedRepair::class);
    }

    public function openRepair(): ?ReedRepair
    {
        return $this->repairs()->whereNull('returned_on')->latest('id')->first();
    }
}
