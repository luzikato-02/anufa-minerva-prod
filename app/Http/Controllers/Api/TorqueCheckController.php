<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TorqueCheckReading;
use App\Models\TorqueCheckSheet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TorqueCheckController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = TorqueCheckSheet::query()
            ->with('creelType:id,name,torque_min,torque_max')
            ->withCount('readings')
            ->withCount(['readings as out_of_range_count' => fn ($q) => $q->whereNotNull('note')]);

        if ($search = strtolower(trim((string) $request->input('search')))) {
            $query->where(function ($q) use ($search) {
                $q->whereRaw('LOWER(operator_name) LIKE ?', ["%{$search}%"])
                    ->orWhereRaw('LOWER(machine_number) LIKE ?', ["%{$search}%"]);
            });
        }

        $query->orderByDesc('check_date')->orderByDesc('id');

        return response()->json($query->paginate(min((int) $request->get('per_page', 10), 200)));
    }

    public function show(TorqueCheckSheet $torqueCheckSheet): JsonResponse
    {
        return response()->json(['status' => 'success', 'data' => $torqueCheckSheet->load('readings', 'creelType')]);
    }

    /** Reading fields shared by create and update. */
    private function readingRules(bool $partial = false): array
    {
        $req = $partial ? 'sometimes|required' : 'required';

        return [
            'row_no' => "{$req}|integer|between:1,105",
            'column_letter' => "{$req}|in:A,B,C,D,E",
            'value' => "{$req}|numeric|min:0|multiple_of:0.5",
            'note' => 'nullable|string|max:255',
        ];
    }

    /**
     * Records (or corrects) one cell. The sheet is created on the first cell, found by its client uuid, so every
     * queued upload stands on its own; the reading itself is upserted by grid position, so a retried offline
     * submit or an edit to an already-filled cell never creates a duplicate.
     */
    public function storeReading(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sheet_client_uuid' => 'required|uuid',
            'check_date' => 'required|date',
            'operator_name' => 'required|string|max:255',
            'machine_number' => 'required|string|max:255',
            'side' => 'required|in:Ai,Ao,Bi,Bo',
            'creel_type_id' => 'required|exists:creel_types,id',
            'client_uuid' => 'nullable|uuid',
        ] + $this->readingRules());

        $reading = DB::transaction(function () use ($data, $request) {
            $sheet = TorqueCheckSheet::firstOrCreate(
                ['client_uuid' => $data['sheet_client_uuid']],
                collect($data)->only(['check_date', 'operator_name', 'machine_number', 'side', 'creel_type_id'])->all()
                    + ['user_id' => $request->user()->id],
            );

            return TorqueCheckReading::updateOrCreate(
                ['torque_check_sheet_id' => $sheet->id, 'row_no' => $data['row_no'], 'column_letter' => $data['column_letter']],
                collect($data)->only(['value', 'note'])->all() + ['client_uuid' => $data['client_uuid'] ?? null, 'user_id' => $request->user()->id],
            );
        });

        return response()->json(['success' => true, 'message' => 'Reading recorded', 'data' => $reading->load('sheet:id,client_uuid')], 201);
    }

    public function updateReading(Request $request, TorqueCheckReading $reading): JsonResponse
    {
        $reading->update($request->validate(['value' => 'sometimes|required|numeric|min:0|multiple_of:0.5', 'note' => 'nullable|string|max:255']));

        return response()->json(['status' => 'success', 'data' => $reading->fresh()]);
    }

    public function destroyReading(TorqueCheckReading $reading): JsonResponse
    {
        $reading->delete();

        return response()->json(['status' => 'success', 'message' => 'Reading cleared']);
    }

    public function update(Request $request, TorqueCheckSheet $torqueCheckSheet): JsonResponse
    {
        $torqueCheckSheet->update($request->validate([
            'check_date' => 'sometimes|date',
            'operator_name' => 'sometimes|string|max:255',
            'machine_number' => 'sometimes|string|max:255',
            'side' => 'sometimes|in:Ai,Ao,Bi,Bo',
            'creel_type_id' => 'sometimes|exists:creel_types,id',
        ]));

        return response()->json(['status' => 'success', 'data' => $torqueCheckSheet->fresh()]);
    }

    public function destroy(TorqueCheckSheet $torqueCheckSheet): JsonResponse
    {
        $torqueCheckSheet->readings()->delete();
        $torqueCheckSheet->delete();

        return response()->json(['status' => 'success', 'message' => 'Torque check sheet deleted successfully.']);
    }

    /** The grid in the paper's layout (one row per NO, columns A-E), plus the flagged cells as a problem list. */
    public function downloadCsv(TorqueCheckSheet $torqueCheckSheet): JsonResponse
    {
        $readings = $torqueCheckSheet->readings()->get();
        if ($readings->isEmpty()) {
            return response()->json(['success' => false, 'message' => 'This sheet has no readings yet.'], 404);
        }

        $lastRow = (int) $readings->max('row_no');
        $byPosition = $readings->keyBy(fn ($r) => "{$r->row_no}{$r->column_letter}");

        $grid = [];
        for ($row = 1; $row <= $lastRow; $row++) {
            $line = ['NO' => $row];
            foreach (['A', 'B', 'C', 'D', 'E'] as $col) {
                $line[$col] = $byPosition->get("{$row}{$col}")?->value;
            }
            $grid[] = $line;
        }

        $problems = $readings->whereNotNull('note')->map(fn ($r) => ['ROW' => $r->row_no, 'COLUMN' => $r->column_letter, 'NOTE' => $r->note])->values();

        return response()->json(['success' => true, 'sheet_id' => $torqueCheckSheet->id, 'grid' => $grid, 'problems' => $problems]);
    }
}
