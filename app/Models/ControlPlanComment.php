<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A comment on a revision under review, or a record of a workflow step taken on it (approved, released, …). */
class ControlPlanComment extends Model
{
    protected $fillable = ['control_plan_revision_id', 'user_id', 'kind', 'body'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
