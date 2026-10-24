<?php

namespace App\Http\Controllers\ControlPlans;

use App\ControlPlans\DocumentInput;
use App\ControlPlans\ReferenceCodes;
use App\Http\Controllers\Controller;
use App\Models\ControlPlan;
use App\Models\ControlPlanComment;
use App\Models\ControlPlanRevision;
use App\Models\ControlPlanSetting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Changes to control plans and their revisions: creating a plan, starting a revision, saving the draft, and the
 * review workflow (submit → approve or request changes → release). Whoever submitted a revision cannot review
 * or release it themselves, unless they have control-plans.override; the history then says so.
 */
class ControlPlanController extends Controller
{
    /** A new control plan with its first revision as a draft, filled with the document defaults from Settings. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'doc_no' => ['required', 'string', 'max:255', Rule::unique('control_plans', 'doc_no')->whereNull('deleted_at')],
            'title' => 'nullable|string|max:255',
            'rev_no' => 'nullable|integer|min:0|max:999',
        ]);
        $settings = ControlPlanSetting::current();

        $revision = DB::transaction(function () use ($data, $settings, $request) {
            $plan = ControlPlan::create(['doc_no' => trim($data['doc_no'])]);

            return $plan->revisions()->create([
                'rev_no' => $data['rev_no'] ?? 0,
                'status' => ControlPlanRevision::DRAFT,
                'header' => ['mill' => $settings->mill ?? '', 'sp_ref' => '', 'sp_date' => '', 'issued' => ''],
                'info' => array_replace(array_fill_keys(ControlPlanRevision::INFO_FIELDS, ''), [
                    'phase' => 'production',
                    'title' => trim((string) ($data['title'] ?? '')),
                    'org_plant' => $settings->org_plant ?? '',
                    'org_code' => $settings->org_code ?? '',
                ]),
                'content' => self::emptyContent($request->user()),
                'author_id' => $request->user()->id,
            ]);
        });

        return response()->json(['success' => true, 'data' => ['plan_id' => $revision->control_plan_id, 'revision_id' => $revision->id]], 201);
    }

    /** Starts the next revision as a draft copy of the released one. A plan has at most one revision in progress. */
    public function startRevision(Request $request, ControlPlan $controlPlan): JsonResponse
    {
        $revisions = ControlPlanRevision::where('control_plan_id', $controlPlan->id);
        abort_if((clone $revisions)->whereIn('status', ControlPlanRevision::OPEN)->exists(), 422, 'This control plan already has a revision in progress.');
        $released = $controlPlan->released;
        abort_if(! $released, 422, 'This control plan has no released revision to start from.');

        $revision = $controlPlan->revisions()->create([
            // Not $controlPlan->revisions()->max(): that relation is ordered, and Postgres rejects ORDER BY beside an aggregate.
            'rev_no' => $revisions->max('rev_no') + 1,
            'status' => ControlPlanRevision::DRAFT,
            'header' => $released->header,
            'info' => $released->info,
            'content' => $released->content,
            'author_id' => $request->user()->id,
        ]);

        return response()->json(['success' => true, 'data' => ['revision_id' => $revision->id]], 201);
    }

    /**
     * Saves the whole draft: document header, plan information, steps and characteristic lines. Anyone who signed
     * signed the document as it was, so any change deletes every signature on it.
     */
    public function update(Request $request, ControlPlanRevision $revision): JsonResponse
    {
        abort_unless($revision->isEditable(), 422, 'Only a draft can be edited. Withdraw the revision from review first.');
        $data = DocumentInput::validate($request, $revision);
        $before = self::canonical([$revision->plan->doc_no, $revision->header, $revision->info,
            ['steps' => $revision->content['steps'] ?? [], 'lines' => $revision->content['lines'] ?? []] + ControlPlanRevision::footer($revision->content)]);
        $after = self::canonical([$data['doc_no'] ?? $revision->plan->doc_no, $data['header'], $data['info'], $data['content']]);

        DB::transaction(function () use ($data, $revision, $request, $before, $after) {
            if (isset($data['doc_no']) && $data['doc_no'] !== $revision->plan->doc_no) {
                $revision->plan->update(['doc_no' => $data['doc_no']]);
            }
            $revision->update(['header' => $data['header'], 'info' => $data['info'], 'content' => $data['content']]);
            if ($before !== $after && ($cleared = $revision->signatures()->delete()) > 0) {
                $this->note($revision, $request, 'comment', 'Edited the plan after it was signed, so '.($cleared === 1 ? 'the signature was' : "all {$cleared} signatures were").' removed. They need to sign again.');
            }
        });

        return response()->json(['success' => true, 'data' => ControlPlanPageController::revision($revision->fresh(), ControlPlanSetting::current()->date_format)]);
    }

    public function destroy(ControlPlanRevision $revision): JsonResponse
    {
        abort_unless($revision->isEditable(), 422, 'Only a draft can be discarded.');
        $plan = $revision->plan;

        DB::transaction(function () use ($revision, $plan) {
            $revision->delete();
            // A plan whose only revision was this draft never existed as far as anyone else is concerned.
            if (! ControlPlanRevision::where('control_plan_id', $plan->id)->exists()) {
                $plan->delete();
            }
        });

        return response()->json(['success' => true]);
    }

    /** Deletes a whole plan, released revisions included; its document number is free for a new plan. */
    public function destroyPlan(ControlPlan $controlPlan): JsonResponse
    {
        DB::transaction(fn () => $controlPlan->deleteRevisions()->delete());

        return response()->json(['success' => true]);
    }

    public function submit(Request $request, ControlPlanRevision $revision): JsonResponse
    {
        abort_unless($revision->isEditable(), 422, 'This revision has already been submitted.');
        $data = $request->validate([
            'history' => 'required|array|min:1',
            'history.*.pages' => 'required|string|max:255',
            'history.*.description' => 'required|string|max:5000',
        ]);
        $lines = $revision->content['lines'] ?? [];
        if (! $lines) {
            throw ValidationException::withMessages(['history' => 'Add at least one characteristic before submitting.']);
        }
        $noSize = count(array_filter($lines, fn ($l) => trim((string) ($l['size'] ?? '')) === ''));
        if ($noSize > 0) {
            throw ValidationException::withMessages(['history' => ($noSize === 1 ? '1 characteristic has' : "{$noSize} characteristics have").' no sample size. Fill it in, then submit.']);
        }

        $revision->update([
            'status' => ControlPlanRevision::IN_REVIEW,
            'history' => array_map(fn ($h) => ['pages' => trim($h['pages']), 'description' => trim($h['description'])], $data['history']),
            'submitted_by' => $request->user()->id,
            'submitted_at' => now(),
            'reviewed_by' => null,
            'reviewed_at' => null,
        ]);
        $this->note($revision, $request, 'submitted', 'Submitted Rev '.$revision->rev_no.' for review.');

        return response()->json(['success' => true]);
    }

    /** The author takes a submitted (or approved, not yet released) revision back to edit it. */
    public function withdraw(Request $request, ControlPlanRevision $revision): JsonResponse
    {
        abort_unless(in_array($revision->status, [ControlPlanRevision::IN_REVIEW, ControlPlanRevision::APPROVED], true), 422, 'Only a revision in review can be taken back.');
        $revision->update(['status' => ControlPlanRevision::DRAFT, 'reviewed_by' => null, 'reviewed_at' => null]);
        $this->note($revision, $request, 'withdrawn', 'Took the revision back to draft.');

        return response()->json(['success' => true]);
    }

    public function requestChanges(Request $request, ControlPlanRevision $revision): JsonResponse
    {
        $this->guardReviewer($request, $revision, ControlPlanRevision::IN_REVIEW);
        $data = $request->validate(['body' => 'required|string|max:5000']);

        $revision->update(['status' => ControlPlanRevision::CHANGES_REQUESTED, 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);
        $this->note($revision, $request, 'changes_requested', trim($data['body']));

        return response()->json(['success' => true]);
    }

    public function approve(Request $request, ControlPlanRevision $revision): JsonResponse
    {
        $self = $this->guardReviewer($request, $revision, ControlPlanRevision::IN_REVIEW);

        $revision->update(['status' => ControlPlanRevision::APPROVED, 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);
        $this->note($revision, $request, 'approved', "Approved for release{$self}.");

        return response()->json(['success' => true]);
    }

    /**
     * Releases an approved revision: it gets today's date and its next review date, the previous released
     * revision is superseded, and the reference library entries it uses are kept with it as they are now.
     */
    public function release(Request $request, ControlPlanRevision $revision): JsonResponse
    {
        $self = $this->guardReviewer($request, $revision, ControlPlanRevision::APPROVED);
        $settings = ControlPlanSetting::current();

        DB::transaction(function () use ($revision, $request, $settings, $self) {
            ControlPlanRevision::where('control_plan_id', $revision->control_plan_id)
                ->where('status', ControlPlanRevision::RELEASED)
                ->update(['status' => ControlPlanRevision::SUPERSEDED]);

            $revision->update([
                'status' => ControlPlanRevision::RELEASED,
                'released_by' => $request->user()->id,
                'release_date' => today(),
                'next_review_date' => today()->addYears($settings->review_period_years),
                'reference_snapshot' => ReferenceCodes::snapshot($revision->header ?? [], $revision->content ?? []),
            ]);
            $this->note($revision, $request, 'released', 'Released Rev '.$revision->rev_no.$self.'.');
        });

        return response()->json(['success' => true]);
    }

    public function comment(Request $request, ControlPlanRevision $revision): JsonResponse
    {
        abort_unless(ControlPlanRevision::canWork($request->user()), 403);
        $data = $request->validate(['body' => 'required|string|max:5000']);
        $comment = $this->note($revision, $request, 'comment', trim($data['body']));

        return response()->json(['success' => true, 'data' => $comment], 201);
    }

    /**
     * Reviewing and releasing need the right status and someone other than the person who submitted it, unless
     * they have control-plans.override. Returns what to add to the history note when they used it.
     */
    private function guardReviewer(Request $request, ControlPlanRevision $revision, string $status): string
    {
        abort_unless($revision->status === $status, 422, 'This revision is not waiting for that step.');
        if ($revision->submitted_by !== $request->user()->id) {
            return '';
        }
        abort_unless($request->user()->can('control-plans.override'), 403, 'You submitted this revision, so someone else has to review and release it.');

        return ' (also the submitter)';
    }

    private function note(ControlPlanRevision $revision, Request $request, string $kind, string $body): ControlPlanComment
    {
        return $revision->comments()->create(['user_id' => $request->user()->id, 'kind' => $kind, 'body' => $body]);
    }

    /** A document as a string that only changes when its values do, whatever order its keys were saved in. */
    private static function canonical(mixed $value): string
    {
        $sort = function (mixed $v) use (&$sort): mixed {
            if (! is_array($v)) {
                return $v === null ? '' : (string) $v;
            }
            if (! array_is_list($v)) {
                ksort($v);
            }

            return array_map($sort, $v);
        };

        return json_encode($sort($value));
    }

    /** A new plan's content: one empty line, and one box in each signature group, the author's under "Dibuat oleh". */
    public static function emptyContent(?User $author = null): array
    {
        $step = Str::uuid()->toString();
        $box = fn (?User $u) => ['id' => Str::uuid()->toString(), 'user_id' => $u?->id, 'name' => $u?->name ?? '', 'position' => ''];

        return [
            'steps' => [['id' => $step, 'no' => '1', 'group' => '', 'name' => '', 'machine' => '']],
            'lines' => [array_fill_keys(ControlPlanRevision::LINE_FIELDS, '') + ['id' => Str::uuid()->toString(), 'step_id' => $step]],
            'notes' => '',
            'signatures' => ['prepared' => [$box($author)], 'approved' => [$box(null)]],
        ];
    }
}
