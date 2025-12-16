<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ControlPlanItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'control_plan_id',
        'process_no',
        'process_step',
        'process_items',
        'machine_device_jig_tools',
        'product_process_characteristics',
        'special_characteristics',
        'product_process_specification_tolerance',
        'sample_size',
        'sample_frequency',
        'control_method',
        'reaction_plan',
        'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the control plan that owns this item
     */
    public function controlPlan(): BelongsTo
    {
        return $this->belongsTo(ControlPlan::class);
    }
}
