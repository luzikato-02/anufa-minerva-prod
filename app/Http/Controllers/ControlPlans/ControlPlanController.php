<?php

namespace App\Http\Controllers\ControlPlans;

use App\ControlPlans\ReferenceCodes;
use App\Http\Controllers\Controller;
use App\Models\ControlPlan;
use App\Models\ControlPlanComment;
use App\Models\ControlPlanReference;
use App\Models\ControlPlanRevision;
use App\Models\ControlPlanSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Changes to control plans and their revisions: creating a plan, starting a revision, saving the draft, and the
 * review workflow (submit → approve or request changes → release). The author of a revision can never review
 * or release it themselves.
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
                'content' => self::emptyContent(),
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

    /** Saves the whole draft: document header, plan information, steps and characteristic lines. */
    public function update(Request $request, ControlPlanRevision $revision): JsonResponse
    {
        abort_unless($revision->isEditable(), 422, 'Only a draft can be edited. Withdraw the revision from review first.');
        $data = $this->validateDocument($request, $revision);

        DB::transaction(function () use ($data, $revision) {
            if (isset($data['doc_no']) && $data['doc_no'] !== $revision->plan->doc_no) {
                $revision->plan->update(['doc_no' => $data['doc_no']]);
            }
            $revision->update(['header' => $data['header'], 'info' => $data['info'], 'content' => $data['content']]);
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
        $this->guardReviewer($request, $revision, ControlPlanRevision::IN_REVIEW);

        $revision->update(['status' => ControlPlanRevision::APPROVED, 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);
        $this->note($revision, $request, 'approved', 'Approved for release.');

        return response()->json(['success' => true]);
    }

    /**
     * Releases an approved revision: it gets today's date and its next review date, the previous released
     * revision is superseded, and the reference library entries it uses are kept with it as they are now.
     */
    public function release(Request $request, ControlPlanRevision $revision): JsonResponse
    {
        $this->guardReviewer($request, $revision, ControlPlanRevision::APPROVED);
        $settings = ControlPlanSetting::current();

        DB::transaction(function () use ($revision, $request, $settings) {
            ControlPlanRevision::where('control_plan_id', $revision->control_plan_id)
                ->where('status', ControlPlanRevision::RELEASED)
                ->update(['status' => ControlPlanRevision::SUPERSEDED]);

            $codes = ReferenceCodes::all($revision->header ?? [], $revision->content ?? []);
            $revision->update([
                'status' => ControlPlanRevision::RELEASED,
                'released_by' => $request->user()->id,
                'release_date' => today(),
                'next_review_date' => today()->addYears($settings->review_period_years),
                'reference_snapshot' => ControlPlanReference::whereIn('code', $codes)->get(['code', 'title', 'type', 'revision', 'link'])->toArray(),
            ]);
            $this->note($revision, $request, 'released', 'Released Rev '.$revision->rev_no.'.');
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

    /** Reviewing and releasing need the right status and someone other than the person who submitted it. */
    private function guardReviewer(Request $request, ControlPlanRevision $revision, string $status): void
    {
        abort_unless($revision->status === $status, 422, 'This revision is not waiting for that step.');
        abort_if($revision->submitted_by === $request->user()->id, 403, 'You submitted this revision, so someone else has to review and release it.');
    }

    private function note(ControlPlanRevision $revision, Request $request, string $kind, string $body): ControlPlanComment
    {
        return $revision->comments()->create(['user_id' => $request->user()->id, 'kind' => $kind, 'body' => $body]);
    }

    public static function emptyContent(): array
    {
        $step = Str::uuid()->toString();

        return [
            'steps' => [['id' => $step, 'no' => '1', 'group' => '', 'name' => '', 'machine' => '']],
            'lines' => [array_fill_keys(ControlPlanRevision::LINE_FIELDS, '') + ['id' => Str::uuid()->toString(), 'step_id' => $step]],
            'notes' => '',
            // One blank signer in each group, so a new plan prints the signature boxes to fill by hand.
            'signatures' => collect(ControlPlanRevision::SIGNATURE_GROUPS)
                ->mapWithKeys(fn ($g) => [$g => [['id' => Str::uuid()->toString(), 'name' => '', 'position' => '']]])
                ->all(),
        ];
    }

    /** Validates a saved draft and returns it normalised: every known field present as a string, unknown keys dropped. */
    private function validateDocument(Request $request, ControlPlanRevision $revision): array
    {
        $request->validate([
            'doc_no' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('control_plans', 'doc_no')->ignore($revision->control_plan_id)->whereNull('deleted_at')],
            'header' => 'required|array',
            'header.*' => 'nullable|string|max:255',
            'info' => 'required|array',
            'info.phase' => 'required|in:prototype,pre_launch,production',
            'info.*' => 'nullable|string|max:255',
            'content' => 'required|array',
            'content.steps' => 'required|array|min:1',
            'content.steps.*.id' => 'required|string|max:64|distinct',
            'content.steps.*.no' => 'nullable|string|max:50',
            'content.steps.*.group' => 'nullable|string|max:255',
            'content.steps.*.name' => 'nullable|string|max:255',
            'content.steps.*.machine' => 'nullable|string|max:255',
            'content.lines' => 'required|array|min:1',
            'content.lines.*.id' => 'required|string|max:64|distinct',
            'content.lines.*.step_id' => 'required|string|max:64',
            'content.lines.*.*' => 'nullable|string|max:2000',
            'content.notes' => 'nullable|string|max:5000',
            'content.signatures' => 'nullable|array',
            'content.signatures.prepared' => 'nullable|array|max:8',
            'content.signatures.approved' => 'nullable|array|max:8',
            'content.signatures.*.*.id' => 'required|string|max:64',
            'content.signatures.*.*.name' => 'nullable|string|max:255',
            'content.signatures.*.*.position' => 'nullable|string|max:255',
        ]);

        $str = fn ($v) => (string) ($v ?? '');
        $steps = array_map(fn ($s) => ['id' => $s['id']] + array_map($str, array_replace(array_fill_keys(ControlPlanRevision::STEP_FIELDS, ''), array_intersect_key($s, array_flip(ControlPlanRevision::STEP_FIELDS)))), $request->input('content.steps'));
        $stepIds = array_column($steps, 'id');
        $lines = [];
        foreach ($request->input('content.lines') as $i => $line) {
            if (! in_array($line['step_id'], $stepIds, true)) {
                throw ValidationException::withMessages(["content.lines.$i.step_id" => 'A line belongs to a process step that is not in the plan.']);
            }
            $lines[] = ['id' => $line['id'], 'step_id' => $line['step_id']]
                + array_map($str, array_replace(array_fill_keys(ControlPlanRevision::LINE_FIELDS, ''), array_intersect_key($line, array_flip(ControlPlanRevision::LINE_FIELDS))));
        }
        // A step left without lines has nothing to print; drop it rather than keep an invisible step.
        $used = array_flip(array_column($lines, 'step_id'));
        $steps = array_values(array_filter($steps, fn ($s) => isset($used[$s['id']])));

        $pick = fn (array $fields, string $key) => array_map($str, array_replace(array_fill_keys($fields, ''), array_intersect_key((array) $request->input($key), array_flip($fields))));

        return [
            'doc_no' => $request->has('doc_no') ? trim($request->input('doc_no')) : null,
            'header' => $pick(ControlPlanRevision::HEADER_FIELDS, 'header'),
            'info' => $pick(ControlPlanRevision::INFO_FIELDS, 'info'),
            'content' => ['steps' => $steps, 'lines' => $lines] + ControlPlanRevision::footer($request->input('content')),
        ];
    }
}
