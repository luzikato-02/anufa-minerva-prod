<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TensionComparison;
use App\Models\TensionRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Saved tension record comparisons. Each user sees and changes only their own.
 */
class TensionComparisonController extends Controller
{
    /** The signed-in user's comparisons, newest change first; `type` narrows to twisting or weaving. */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate(['type' => ['nullable', Rule::in(['twisting', 'weaving'])]]);

        $comparisons = TensionComparison::where('user_id', $request->user()->id)
            ->when($validated['type'] ?? null, fn ($q, $type) => $q->where('record_type', $type))
            ->latest('updated_at')
            ->get();

        // One query to learn which saved records still exist.
        $existing = TensionRecord::whereIn('id', $comparisons->pluck('record_ids')->flatten()->unique())
            ->pluck('id')->flip();

        return response()->json([
            'data' => $comparisons->map(fn (TensionComparison $c) => $this->summary($c) + [
                'available' => collect($c->record_ids)->filter(fn ($id) => $existing->has($id))->count(),
            ])->values(),
        ]);
    }

    /** One comparison with its records in legend order; records deleted since are listed in `missing_ids`. */
    public function show(Request $request, int $id): JsonResponse
    {
        $comparison = $this->own($request, $id);
        $records = TensionRecord::whereIn('id', $comparison->record_ids)->get()->keyBy('id');

        return response()->json([
            'data' => $this->summary($comparison) + [
                'records' => collect($comparison->record_ids)
                    ->filter(fn ($rid) => $records->has($rid))
                    ->map(fn ($rid) => $records[$rid])
                    ->values(),
                'missing_ids' => collect($comparison->record_ids)
                    ->reject(fn ($rid) => $records->has($rid))
                    ->values(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules(required: true));
        $this->assertRecordsMatch($validated['record_ids'], $validated['record_type']);

        $comparison = TensionComparison::create([
            'user_id' => $request->user()->id,
            'name' => trim($validated['name']),
            'record_type' => $validated['record_type'],
            'record_ids' => array_map('intval', $validated['record_ids']),
            'metric' => $validated['metric'] ?? 'avg',
            'hidden_ids' => $this->hiddenWithin($validated['hidden_ids'] ?? [], $validated['record_ids']),
        ]);

        return response()->json(['data' => $this->summary($comparison)], 201);
    }

    /** Rename, or save a changed chart: the records, plotted value or hidden lines. */
    public function update(Request $request, int $id): JsonResponse
    {
        $comparison = $this->own($request, $id);
        $validated = $request->validate($this->rules(required: false));

        if (isset($validated['record_ids'])) {
            $this->assertRecordsMatch($validated['record_ids'], $comparison->record_type);
            $comparison->record_ids = array_map('intval', $validated['record_ids']);
        }
        if (isset($validated['name'])) {
            $comparison->name = trim($validated['name']);
        }
        if (isset($validated['metric'])) {
            $comparison->metric = $validated['metric'];
        }
        if (array_key_exists('hidden_ids', $validated) || isset($validated['record_ids'])) {
            $comparison->hidden_ids = $this->hiddenWithin(
                $validated['hidden_ids'] ?? $comparison->hidden_ids ?? [],
                $comparison->record_ids,
            );
        }
        $comparison->save();

        return response()->json(['data' => $this->summary($comparison)]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->own($request, $id)->delete();

        return response()->json(null, 204);
    }

    private function rules(bool $required): array
    {
        $req = $required ? 'required' : 'sometimes';

        return [
            'name' => [$req, 'string', 'max:100', 'regex:/\S/'],
            'record_type' => $required ? ['required', Rule::in(['twisting', 'weaving'])] : ['prohibited'],
            'record_ids' => [$req, 'array', 'min:'.TensionComparison::MIN_RECORDS, 'max:'.TensionComparison::MAX_RECORDS],
            'record_ids.*' => ['integer', 'distinct'],
            'metric' => ['sometimes', Rule::in(TensionComparison::METRICS)],
            'hidden_ids' => ['sometimes', 'nullable', 'array'],
            'hidden_ids.*' => ['integer'],
        ];
    }

    /** Every id must be an existing record of the comparison's type. */
    private function assertRecordsMatch(array $ids, string $type): void
    {
        $found = TensionRecord::whereIn('id', $ids)->where('record_type', $type)->count();
        if ($found !== count(array_unique($ids))) {
            throw ValidationException::withMessages([
                'record_ids' => "Every record must be an existing {$type} record.",
            ]);
        }
    }

    /** Hidden ids are only kept for records that are part of the comparison. */
    private function hiddenWithin(array $hidden, array $recordIds): array
    {
        return array_values(array_intersect(array_map('intval', $hidden), array_map('intval', $recordIds)));
    }

    /** Someone else's comparison answers 404, so ids reveal nothing. */
    private function own(Request $request, int $id): TensionComparison
    {
        return TensionComparison::where('user_id', $request->user()->id)->findOrFail($id);
    }

    private function summary(TensionComparison $c): array
    {
        return [
            'id' => $c->id,
            'name' => $c->name,
            'record_type' => $c->record_type,
            'record_ids' => $c->record_ids,
            'metric' => $c->metric,
            'hidden_ids' => $c->hidden_ids ?? [],
            'created_at' => $c->created_at?->toIso8601String(),
            'updated_at' => $c->updated_at?->toIso8601String(),
        ];
    }
}
