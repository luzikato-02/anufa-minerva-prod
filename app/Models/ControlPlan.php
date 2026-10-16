<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/** One controlled document (a W-WSD control plan), identified by its document number; its content lives in its revisions. */
class ControlPlan extends Model
{
    use SoftDeletes;

    protected $fillable = ['doc_no', 'legacy_history'];

    protected $casts = [
        'legacy_history' => 'array',
    ];

    public function revisions(): HasMany
    {
        return $this->hasMany(ControlPlanRevision::class)->orderBy('rev_no');
    }

    /** The revision the shop floor uses: the newest released one. */
    public function released(): HasOne
    {
        // The status goes inside ofMany(): a where() before latestOfMany() would only filter the newest revision
        // overall, so a plan with a newer draft would seem to have no released revision.
        return $this->hasOne(ControlPlanRevision::class)->ofMany(['rev_no' => 'max'], fn ($q) => $q->where('status', ControlPlanRevision::RELEASED));
    }

    /** The revision being worked on (draft, in review, changes requested or approved), if any. There is at most one. */
    public function open(): HasOne
    {
        return $this->hasOne(ControlPlanRevision::class)->ofMany(['rev_no' => 'max'], fn ($q) => $q->whereIn('status', ControlPlanRevision::OPEN));
    }

    /** The open revision if there is one, else the released one: what the plan currently says. */
    public function current(): ?ControlPlanRevision
    {
        return $this->open ?? $this->released;
    }
}
