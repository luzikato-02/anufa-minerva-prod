<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One person's signature in a box of a revision's "Dibuat oleh" / "Disetujui oleh" block. */
class ControlPlanSignature extends Model
{
    protected $fillable = ['control_plan_revision_id', 'signer_id', 'user_id', 'image'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
