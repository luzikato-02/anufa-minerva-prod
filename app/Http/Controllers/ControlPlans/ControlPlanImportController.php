<?php

namespace App\Http\Controllers\ControlPlans;

use App\ControlPlans\DocumentInput;
use App\ControlPlans\Import\DocxReader;
use App\ControlPlans\Import\PdfReader;
use App\ControlPlans\Import\PlanImport;
use App\ControlPlans\ReferenceCodes;
use App\Http\Controllers\Controller;
use App\Models\ControlPlan;
use App\Models\ControlPlanRevision;
use App\Models\ControlPlanSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Bringing a plan kept in Word or PDF into the app, once, when it moves here: the file is read into a preview
 * (nothing saved), the author checks and corrects it, then the plan is created from what they confirmed, either
 * as a draft that goes through review like any other, or, for approvers, straight as the released revision it
 * already is on paper.
 */
class ControlPlanImportController extends Controller
{
    public function preview(Request $request): JsonResponse
    {
        $request->validate(['file' => 'required|file|max:10240']);
        $file = $request->file('file');
        $ext = strtolower($file->getClientOriginalExtension());
        if ($ext === 'doc') {
            throw ValidationException::withMessages(['file' => 'This is an older Word file (.doc). Open it in Word, save it as Word Document (.docx), then import that file.']);
        }
        if (! in_array($ext, ['docx', 'pdf'], true)) {
            throw ValidationException::withMessages(['file' => 'Choose a Word (.docx) or PDF file.']);
        }

        try {
            $doc = $ext === 'docx' ? DocxReader::read($file->getRealPath()) : PdfReader::read($file->getRealPath());
            $plan = PlanImport::from($doc);
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['file' => $e->getMessage()]);
        } catch (\Throwable $e) {
            report($e);
            throw ValidationException::withMessages(['file' => 'This file could not be read. If it opens in Word, save it again as .docx and import that.']);
        }

        // What the document leaves blank comes from Settings, as for a new plan.
        $settings = ControlPlanSetting::current();
        $plan['header']['mill'] = $plan['header']['mill'] !== '' ? $plan['header']['mill'] : ($settings->mill ?? '');
        foreach (['org_plant', 'org_code'] as $field) {
            $plan['info'][$field] = $plan['info'][$field] !== '' ? $plan['info'][$field] : ($settings->$field ?? '');
        }
        $existing = $plan['doc_no'] !== '' ? ControlPlan::where('doc_no', $plan['doc_no'])->first() : null;
        if ($existing) {
            array_unshift($plan['warnings'], "{$plan['doc_no']} is already in the app. Change the document number, or open the existing plan and start its next revision instead.");
        }

        return response()->json(['success' => true, 'data' => $plan + [
            'file_name' => $file->getClientOriginalName(),
            'existing_plan_id' => $existing?->id,
            'review_period_years' => $settings->review_period_years,
        ]]);
    }

    public function store(Request $request): JsonResponse
    {
        $released = $request->input('status') === 'released';
        abort_if($released && ! $request->user()->can('control-plans.approve'), 403, 'Only someone who can release control plans can import one as released.');
        $meta = $request->validate([
            'status' => 'required|in:draft,released',
            'rev_no' => 'required|integer|min:0|max:999',
            'file_name' => 'nullable|string|max:255',
            'history' => 'nullable|array|max:500',
            'history.*.page' => 'nullable|string|max:255',
            'history.*.date' => 'nullable|string|max:255',
            'history.*.rev' => 'nullable|string|max:50',
            'history.*.description' => 'nullable|string|max:5000',
            'history.*.revised_by' => 'nullable|string|max:255',
            'release_date' => 'nullable|required_if:status,released|date',
            'next_review_date' => 'nullable|date|after_or_equal:release_date',
        ]);
        $doc = DocumentInput::validate($request);
        $user = $request->user();
        $settings = ControlPlanSetting::current();
        $revNo = (int) $meta['rev_no'];

        $history = array_values(array_filter(array_map(fn ($h) => array_map(fn ($v) => trim((string) ($v ?? '')), [
            'page' => $h['page'] ?? '', 'date' => $h['date'] ?? '', 'rev' => $h['rev'] ?? '',
            'description' => $h['description'] ?? '', 'revised_by' => $h['revised_by'] ?? '',
        ]), $meta['history'] ?? []), fn ($h) => implode('', $h) !== ''));
        // A draft's own history rows become its entries, so the submit dialog starts with them; released, the
        // whole table stays as it was printed.
        $isThisRevision = fn (array $h) => preg_match('/\d+/', $h['rev'], $m) === 1 && (int) $m[0] === $revNo;
        $own = $released ? [] : array_values(array_filter($history, $isThisRevision));
        $legacy = $released ? $history : array_values(array_filter($history, fn ($h) => ! $isThisRevision($h)));

        $content = $doc['content'];
        if (! $content['signatures']['prepared'] && ! $content['signatures']['approved']) {
            $content['signatures'] = ControlPlanController::emptyContent($user)['signatures'];
        }
        $file = trim((string) ($meta['file_name'] ?? '')) ?: 'a file';
        $rev = 'Rev '.str_pad((string) $revNo, 2, '0', STR_PAD_LEFT);

        $revision = DB::transaction(function () use ($doc, $content, $legacy, $own, $released, $meta, $revNo, $user, $settings, $file, $rev) {
            $plan = ControlPlan::create(['doc_no' => $doc['doc_no'], 'legacy_history' => $legacy ?: null]);
            $attributes = [
                'rev_no' => $revNo,
                'status' => $released ? ControlPlanRevision::RELEASED : ControlPlanRevision::DRAFT,
                'header' => $doc['header'],
                'info' => $doc['info'],
                'content' => $content,
                'history' => array_map(fn ($h) => ['pages' => $h['page'] !== '' ? $h['page'] : 'All', 'description' => $h['description']], $own) ?: null,
                'author_id' => $user->id,
            ];
            if ($released) {
                $releaseDate = Carbon::parse($meta['release_date']);
                $attributes += [
                    'submitted_by' => $user->id,
                    'submitted_at' => now(),
                    'reviewed_by' => $user->id,
                    'reviewed_at' => now(),
                    'released_by' => $user->id,
                    'release_date' => $releaseDate,
                    'next_review_date' => isset($meta['next_review_date']) ? Carbon::parse($meta['next_review_date']) : $releaseDate->copy()->addYears($settings->review_period_years),
                    'reference_snapshot' => ReferenceCodes::snapshot($doc['header'], $content),
                ];
            }
            $revision = $plan->revisions()->create($attributes);
            $revision->comments()->create([
                'user_id' => $user->id,
                'kind' => $released ? 'released' : 'comment',
                'body' => $released ? "Imported {$rev} as released from {$file}." : "Imported {$rev} from {$file}.",
            ]);

            return $revision;
        });

        return response()->json(['success' => true, 'data' => ['plan_id' => $revision->control_plan_id, 'revision_id' => $revision->id]], 201);
    }
}
