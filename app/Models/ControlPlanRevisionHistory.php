<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ControlPlanRevisionHistory extends Model
{
    protected $fillable = [
        'control_plan_id',
        'page',
        'date_of_revision',
        'revision_number',
        'description',
        'revised_by',
    ];

    protected $casts = [
        'date_of_revision' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the control plan that owns this revision history
     */
    public function controlPlan(): BelongsTo
    {
        return $this->belongsTo(ControlPlan::class);
    }
}
