<?php

namespace App\Models;

use App\ControlPlans\PlanDates;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * One revision of a control plan. Its lifecycle: draft → in_review → approved → released, with
 * changes_requested sending it back to the author; releasing it supersedes the previous released revision.
 */
class ControlPlanRevision extends Model
{
    use LogsActivity;

    public const DRAFT = 'draft';

    public const IN_REVIEW = 'in_review';

    public const CHANGES_REQUESTED = 'changes_requested';

    public const APPROVED = 'approved';

    public const RELEASED = 'released';

    public const SUPERSEDED = 'superseded';

    /** Statuses of a revision still being worked on. */
    public const OPEN = [self::DRAFT, self::IN_REVIEW, self::CHANGES_REQUESTED, self::APPROVED];

    /** Statuses in which the author can still edit the content. */
    public const EDITABLE = [self::DRAFT, self::CHANGES_REQUESTED];

    public const HEADER_FIELDS = ['mill', 'sp_ref', 'sp_date', 'issued'];

    public const INFO_FIELDS = [
        'phase', 'title', 'key_contact', 'core_team', 'part_number', 'part_name', 'org_plant', 'org_code',
        'cust_eng_name', 'cust_eng_date', 'cust_qual_name', 'cust_qual_date',
        'other1_name', 'other1_date', 'other2_name', 'other2_date',
    ];

    public const STEP_FIELDS = ['no', 'group', 'name', 'machine'];

    /** The signature block under the plan: who prepared it ("Dibuat oleh") and who approved it ("Disetujui oleh"). */
    public const SIGNATURE_GROUPS = ['prepared', 'approved'];

    public const SIGNER_FIELDS = ['name', 'position'];

    public const MAX_SIGNERS = 8;

    public const LINE_FIELDS = ['product', 'process', 'sc', 'spec', 'measurement', 'size', 'frequency', 'control', 'pic', 'reaction', 'reaction_ref'];

    protected $fillable = [
        'control_plan_id', 'rev_no', 'status', 'header', 'info', 'content', 'history', 'reference_snapshot',
        'author_id', 'submitted_by', 'submitted_at', 'reviewed_by', 'reviewed_at', 'released_by', 'release_date', 'next_review_date',
    ];

    protected $casts = [
        'header' => 'array',
        'info' => 'array',
        'content' => 'array',
        'history' => 'array',
        'reference_snapshot' => 'array',
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'release_date' => 'date:Y-m-d',
        'next_review_date' => 'date:Y-m-d',
    ];

    /**
     * The notes and signature block under the characteristics table, with defaults for content saved before they
     * existed: notes are free text, one note per line; each signature group is a list of {id, user_id, name,
     * position}, where user_id is the account that signs that box in the app (null: signed by hand on paper).
     *
     * @return array{notes: string, signatures: array{prepared: list<array{id: string, user_id: ?int, name: string, position: string}>, approved: list<array{id: string, user_id: ?int, name: string, position: string}>}}
     */
    public static function footer(?array $content): array
    {
        $signatures = [];
        foreach (self::SIGNATURE_GROUPS as $group) {
            $signatures[$group] = array_values(array_map(fn ($s) => [
                'id' => (string) ($s['id'] ?? ''),
                'user_id' => is_numeric($s['user_id'] ?? null) ? (int) $s['user_id'] : null,
                'name' => (string) ($s['name'] ?? ''),
                'position' => (string) ($s['position'] ?? ''),
            ], $content['signatures'][$group] ?? []));
        }

        return ['notes' => (string) ($content['notes'] ?? ''), 'signatures' => $signatures];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(ControlPlan::class, 'control_plan_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(ControlPlanComment::class)->orderBy('id');
    }

    public function signatures(): HasMany
    {
        return $this->hasMany(ControlPlanSignature::class);
    }

    /** The box in the signature block with this id, or null. */
    public function signer(string $signerId): ?array
    {
        foreach (self::footer($this->content)['signatures'] as $people) {
            foreach ($people as $p) {
                if ($p['id'] === $signerId) {
                    return $p;
                }
            }
        }

        return null;
    }

    /**
     * The revision's signatures by signature box id: the image, who signed and when. A signature whose box has
     * since been given to someone else is left out.
     *
     * proxy: who signed on the owner's behalf (control-plans.override), or null when the owner signed.
     *
     * @return array<string, array{image: string, by: string, proxy: ?string, at: string}>
     */
    public function signed(string $fmt): array
    {
        $owners = collect(self::footer($this->content)['signatures'])->flatten(1)->pluck('user_id', 'id');
        $out = [];
        foreach ($this->signatures()->with('user:id,name', 'signer:id,name')->get() as $sig) {
            if (($owners[$sig->signer_id] ?? null) === $sig->user_id) {
                $out[$sig->signer_id] = [
                    'image' => $sig->image,
                    'by' => $sig->user?->name ?? '',
                    'proxy' => $sig->signed_by ? ($sig->signer?->name ?? 'Unknown user') : null,
                    'at' => PlanDates::format($sig->created_at, $fmt),
                ];
            }
        }

        return $out;
    }

    /** Whether the user has a box to sign in this revision's signature block. */
    public function hasSigner(User $user): bool
    {
        foreach (self::footer($this->content)['signatures'] as $people) {
            foreach ($people as $p) {
                if ($p['user_id'] === $user->id) {
                    return true;
                }
            }
        }

        return false;
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function isOpen(): bool
    {
        return in_array($this->status, self::OPEN, true);
    }

    public function isEditable(): bool
    {
        return in_array($this->status, self::EDITABLE, true);
    }

    /** The released revision this one is compared against: the newest released or superseded revision before it. */
    public function previousReleased(): ?self
    {
        return self::where('control_plan_id', $this->control_plan_id)
            ->where('rev_no', '<', $this->rev_no)
            ->whereIn('status', [self::RELEASED, self::SUPERSEDED])
            ->orderByDesc('rev_no')
            ->first();
    }

    /**
     * Released and superseded revisions are open to anyone who can view control plans; a revision still being
     * worked on only to the people who write, review or release them ("drafts never show on the shop floor"), and
     * to the people asked to sign it.
     */
    public function isVisibleTo(User $user): bool
    {
        if (! $user->can('control-plans.view')) {
            return false;
        }

        return ! $this->isOpen() || self::canWork($user) || $this->hasSigner($user);
    }

    public static function canWork(User $user): bool
    {
        return $user->can('control-plans.author') || $user->can('control-plans.review') || $user->can('control-plans.approve');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['rev_no', 'status'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs();
    }
}
