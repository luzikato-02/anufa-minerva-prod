<?php

namespace App\Http\Controllers\ControlPlans;

use App\ControlPlans\PlanDates;
use App\ControlPlans\ReferenceCodes;
use App\ControlPlans\RevisionDiff;
use App\Http\Controllers\Controller;
use App\Models\ControlPlan;
use App\Models\ControlPlanReference;
use App\Models\ControlPlanRevision;
use App\Models\ControlPlanSetting;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;

/** The control plan module's pages: plan list, editor, review, print preview, export, reference library, settings, shop-floor viewer. */
class ControlPlanPageController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $canWork = ControlPlanRevision::canWork($user);
        $plans = ControlPlan::with(['released.submitter:id,name', 'open.signatures:id,control_plan_revision_id,signer_id'])->orderBy('doc_no')->get();
        $fmt = ControlPlanSetting::current()->date_format;

        $rows = $plans->map(function (ControlPlan $plan) use ($canWork, $fmt) {
            $open = $canWork ? $plan->open : null;
            $released = $plan->released;
            $current = $open ?? $released;

            return [
                'id' => $plan->id,
                'doc_no' => $plan->doc_no,
                'title' => trim((string) ($current?->info['title'] ?? '')),
                'released' => $released ? ['id' => $released->id, 'rev' => PlanDates::rev($released->rev_no), 'release_date' => PlanDates::format($released->release_date, $fmt)] : null,
                'open' => $open ? ['id' => $open->id, 'rev' => PlanDates::rev($open->rev_no), 'status' => $open->status] : null,
                'next_review' => $released?->next_review_date ? PlanDates::format($released->next_review_date, $fmt) : null,
                'next_review_raw' => $released?->next_review_date?->toDateString(),
            ];
        })->values();

        $openRevisions = $plans->pluck('open')->filter();
        $toSign = fn (ControlPlanRevision $r) => collect(ControlPlanRevision::footer($r->content)['signatures'])->flatten(1)
            ->contains(fn ($p) => $p['user_id'] === $user->id && ! $r->signatures->contains('signer_id', $p['id']));
        $summary = function (ControlPlanRevision $r) use ($plans, $toSign) {
            $base = $r->previousReleased();

            return [
                'id' => $r->id,
                'plan_id' => $r->control_plan_id,
                'doc_no' => $plans->firstWhere('id', $r->control_plan_id)->doc_no,
                'rev' => PlanDates::rev($r->rev_no),
                'status' => $r->status,
                'mill' => $r->header['mill'] ?? '',
                'based_on' => $base ? PlanDates::rev($base->rev_no) : null,
                'to_sign' => $toSign($r),
            ];
        };

        return Inertia::render('control-plans', [
            'plans' => $rows,
            'myDrafts' => $openRevisions
                ->filter(fn ($r) => $canWork && $r->author_id === $user->id && $r->isEditable())
                ->map($summary)->values(),
            'waiting' => $openRevisions
                ->filter(fn ($r) => $toSign($r) || ($canWork && ($r->submitted_by !== $user->id || $user->can('control-plans.override')) && (
                    ($r->status === ControlPlanRevision::IN_REVIEW && $user->can('control-plans.review'))
                    || ($r->status === ControlPlanRevision::APPROVED && $user->can('control-plans.approve'))
                )))
                ->map($summary)->values(),
            'upcoming' => $rows->filter(fn ($r) => $r['next_review_raw'])->sortBy('next_review_raw')
                ->map(fn ($r) => ['id' => $r['id'], 'doc_no' => $r['doc_no'], 'next_review' => $r['next_review'], 'overdue' => $r['next_review_raw'] < now()->toDateString()])
                ->values(),
            'canWork' => $canWork,
        ]);
    }

    public function editor(Request $request, ControlPlan $controlPlan): Response
    {
        $user = $request->user();
        $released = $controlPlan->released;
        $open = ControlPlanRevision::canWork($user) ? $controlPlan->open : null;
        $revision = $open ?? $released;
        abort_if(! $revision, 404, 'This control plan has no revision you can open.');
        $settings = ControlPlanSetting::current();

        return Inertia::render('control-plan-editor', [
            'plan' => ['id' => $controlPlan->id, 'doc_no' => $controlPlan->doc_no],
            'revision' => self::revision($revision, $settings->date_format),
            'released' => $released ? self::revision($released, $settings->date_format) : null,
            'referenceCodes' => ControlPlanReference::orderBy('code')->pluck('code'),
            'reviewPeriod' => $settings->review_period_years,
            'people' => self::people(),
            'sharedLogo' => $settings->logoDataUri(),
        ]);
    }

    public function review(Request $request, ControlPlanRevision $revision): Response
    {
        abort_unless($revision->isVisibleTo($request->user()), 403);
        $fmt = ControlPlanSetting::current()->date_format;
        $base = $revision->previousReleased();
        $revision->load('comments.user:id,name', 'plan');

        return Inertia::render('control-plan-review', [
            'plan' => ['id' => $revision->plan->id, 'doc_no' => $revision->plan->doc_no],
            'revision' => self::revision($revision, $fmt),
            'base' => $base ? ['id' => $base->id, 'rev' => PlanDates::rev($base->rev_no)] : null,
            'diff' => RevisionDiff::compare($base?->content, $revision->content ?? []),
            'comments' => $revision->comments->map(fn ($c) => [
                'id' => $c->id,
                'kind' => $c->kind,
                'body' => $c->body,
                'who' => $c->user?->name ?? 'Unknown user',
                'at' => $c->created_at?->toIso8601String(),
            ]),
        ]);
    }

    public function preview(Request $request, ControlPlanRevision $revision): Response
    {
        abort_unless($revision->isVisibleTo($request->user()), 403);

        return Inertia::render('control-plan-preview', [
            'plan' => ['id' => $revision->plan->id, 'doc_no' => $revision->plan->doc_no],
            'revision' => self::revision($revision, ControlPlanSetting::current()->date_format),
        ]);
    }

    public function export(Request $request, ControlPlan $controlPlan): Response
    {
        $user = $request->user();
        $fmt = ControlPlanSetting::current()->date_format;
        $options = collect([ControlPlanRevision::canWork($user) ? $controlPlan->open : null, $controlPlan->released])
            ->filter()
            ->map(fn (ControlPlanRevision $r) => [
                'id' => $r->id,
                'rev' => PlanDates::rev($r->rev_no),
                'status' => $r->status,
                'release_date' => $r->release_date ? PlanDates::format($r->release_date, $fmt) : null,
            ])->values();
        abort_if($options->isEmpty(), 404, 'This control plan has nothing to export yet.');

        return Inertia::render('control-plan-export', [
            'plan' => ['id' => $controlPlan->id, 'doc_no' => $controlPlan->doc_no],
            'options' => $options,
            'selected' => (int) $request->query('revision', $options->first()['id']),
            'dateFormat' => $fmt,
        ]);
    }

    public function viewer(Request $request, ControlPlan $controlPlan): Response
    {
        $released = $controlPlan->released;
        $fmt = ControlPlanSetting::current()->date_format;

        return Inertia::render('control-plan-viewer', [
            'plan' => ['id' => $controlPlan->id, 'doc_no' => $controlPlan->doc_no],
            'revision' => $released ? self::revision($released, $fmt) : null,
            'machine' => $request->query('machine'),
        ]);
    }

    public function references(Request $request): Response
    {
        // Where each code is used: in every plan's current revision (the open one if there is one, else the released one).
        $uses = [];
        foreach (ControlPlan::with('released', 'open')->get() as $plan) {
            $rev = $plan->current();
            if (! $rev) {
                continue;
            }
            foreach (ReferenceCodes::usages($rev->header ?? [], $rev->content ?? []) as $code => $where) {
                $uses[$code][] = ['plan_id' => $plan->id, 'doc_no' => $plan->doc_no, 'where' => $where];
            }
        }

        return Inertia::render('control-plan-references', [
            'references' => ControlPlanReference::orderBy('code')->get()->map(fn ($r) => [
                'id' => $r->id,
                'code' => $r->code,
                'title' => $r->title ?? '',
                'type' => $r->type ?? '',
                'revision' => $r->revision ?? '',
                'link' => $r->link ?? '',
                'uses' => $uses[$r->code] ?? [],
            ]),
            'unknownCodes' => collect(array_keys($uses))->diff(ControlPlanReference::pluck('code'))->sort()->values(),
        ]);
    }

    public function settings(): Response
    {
        // The permission() scope throws on a permission that was never created, so only ask for the ones that exist.
        $names = Permission::whereIn('name', ['control-plans.author', 'control-plans.review', 'control-plans.approve', 'control-plans.settings'])->pluck('name');
        $users = ($names->isEmpty() ? collect() : User::permission($names->all())->orderBy('name')->get())
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'roles' => array_values(array_filter([
                    $u->can('control-plans.author') ? 'Author' : null,
                    $u->can('control-plans.review') ? 'Reviewer' : null,
                    $u->can('control-plans.approve') ? 'Approver' : null,
                    $u->can('control-plans.settings') ? 'Admin' : null,
                ])),
            ]);

        $settings = ControlPlanSetting::current();

        return Inertia::render('control-plan-settings', [
            'settings' => $settings->only(['mill', 'org_plant', 'org_code', 'date_format', 'review_period_years']),
            'logo' => $settings->logoDataUri(),
            'users' => $users,
        ]);
    }

    /** The accounts a signature box can be given to: everyone who can view control plans. */
    private static function people(): array
    {
        if (! Permission::where('name', 'control-plans.view')->exists()) {
            return [];
        }

        return User::permission('control-plans.view')->orderBy('name')->get(['id', 'name'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name])->all();
    }

    /** A revision as the pages use it, with its dates printed in the configured format. */
    public static function revision(ControlPlanRevision $r, string $fmt): array
    {
        $r->loadMissing('submitter:id,name', 'author:id,name');

        return [
            'id' => $r->id,
            'rev_no' => $r->rev_no,
            'rev' => PlanDates::rev($r->rev_no),
            'status' => $r->status,
            'editable' => $r->isEditable(),
            'header' => $r->header ?? [],
            'info' => $r->info ?? [],
            'content' => ['steps' => $r->content['steps'] ?? [], 'lines' => $r->content['lines'] ?? []] + ControlPlanRevision::footer($r->content),
            'signed' => (object) $r->signed($fmt),
            'history' => $r->history ?? [],
            'author' => $r->author?->name,
            'author_id' => $r->author_id,
            'submitted_by' => $r->submitted_by,
            'submitter' => $r->submitter?->name,
            'release_date' => $r->release_date ? PlanDates::format($r->release_date, $fmt) : null,
            'next_review' => $r->next_review_date ? PlanDates::format($r->next_review_date, $fmt) : null,
            'updated_at' => $r->updated_at?->toIso8601String(),
        ];
    }
}
