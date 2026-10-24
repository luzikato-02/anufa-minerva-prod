<?php

namespace App\ControlPlans;

use App\Models\ControlPlanRevision;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** A whole control plan document sent by the browser: a saved draft, or a plan being imported. */
class DocumentInput
{
    /**
     * Validates the document and returns it normalised: every known field present as a string, unknown keys
     * dropped. For a saved draft ($revision) the document number may be left out; for an import it is required
     * and must not be taken.
     *
     * @return array{doc_no: ?string, header: array<string, string>, info: array<string, string>, content: array}
     */
    public static function validate(Request $request, ?ControlPlanRevision $revision = null): array
    {
        $unique = Rule::unique('control_plans', 'doc_no')->whereNull('deleted_at');
        $request->validate([
            'doc_no' => [...($revision ? ['sometimes'] : []), 'required', 'string', 'max:255', $revision ? $unique->ignore($revision->control_plan_id) : $unique],
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
            'content.signatures.prepared' => 'nullable|array|max:'.ControlPlanRevision::MAX_SIGNERS,
            'content.signatures.approved' => 'nullable|array|max:'.ControlPlanRevision::MAX_SIGNERS,
            'content.signatures.*.*.id' => 'required|string|max:64',
            'content.signatures.*.*.user_id' => 'nullable|integer|exists:users,id',
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
