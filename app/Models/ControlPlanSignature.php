<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One person's signature in a box of a revision's "Dibuat oleh" / "Disetujui oleh" block. user_id is the box's
 * owner; signed_by is set when someone with control-plans.override signed it for them.
 */
class ControlPlanSignature extends Model
{
    protected $fillable = ['control_plan_revision_id', 'signer_id', 'user_id', 'signed_by', 'image'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function signer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'signed_by');
    }
}
