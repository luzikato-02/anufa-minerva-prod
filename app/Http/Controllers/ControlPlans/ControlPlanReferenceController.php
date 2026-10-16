<?php

namespace App\Http\Controllers\ControlPlans;

use App\ControlPlans\ReferenceCodes;
use App\Http\Controllers\Controller;
use App\Models\ControlPlanReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** The reference library: document codes control plans refer to. A title or link edited here shows in every draft at once. */
class ControlPlanReferenceController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $reference = ControlPlanReference::create($this->validated($request));

        return response()->json(['success' => true, 'data' => $reference], 201);
    }

    public function update(Request $request, ControlPlanReference $reference): JsonResponse
    {
        $reference->update($this->validated($request, $reference));

        return response()->json(['success' => true, 'data' => $reference->fresh()]);
    }

    private function validated(Request $request, ?ControlPlanReference $reference = null): array
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:255', 'regex:'.ReferenceCodes::EXACT, Rule::unique('control_plan_references', 'code')->ignore($reference?->id)],
            'title' => 'nullable|string|max:255',
            'type' => 'nullable|string|max:255',
            'revision' => 'nullable|string|max:255',
            'link' => 'nullable|string|max:1000',
        ], ['code.regex' => 'Type the code exactly as issued, for example QA-IK-15: capital letters and digits in parts joined by dashes.']);

        return array_map(fn ($v) => is_string($v) ? trim($v) : $v, $data);
    }
}
