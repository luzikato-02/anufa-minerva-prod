<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TorqueCheckReading;
use App\Models\TorqueCheckSheet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TorqueCheckController extends Controller
{
    private const SIDES = ['Ai', 'Ao', 'Bi', 'Bo'];

    public function index(Request $request): JsonResponse
    {
        $query = TorqueCheckSheet::query()
            ->with('creelType:id,name,torque_min,torque_max')
            ->withCount('readings')
            ->withCount(['readings as out_of_range_count' => fn ($q) => $q->whereNotNull('note')]);

        // One withCount per side rather than a driver-specific GROUP_CONCAT/STRING_AGG, so this stays
        // portable between sqlite (tests) and Postgres (dev/prod).
        foreach (self::SIDES as $side) {
            $query->withCount(['readings as '.strtolower($side).'_count' => fn ($q) => $q->where('side', $side)]);
        }

        if ($search = strtolower(trim((string) $request->input('search')))) {
            $query->where(function ($q) use ($search) {
                $q->whereRaw('LOWER(operator_name) LIKE ?', ["%{$search}%"])
                    ->orWhereRaw('LOWER(machine_number) LIKE ?', ["%{$search}%"])
                    ->orWhereRaw('LOWER(session_id) LIKE ?', ["%{$search}%"]);
            });
        }

        $query->orderByDesc('check_date')->orderByDesc('id');

        $page = $query->paginate(min((int) $request->get('per_page', 10), 200));
        $page->getCollection()->transform(function ($sheet) {
            $sheet->sides_recorded = collect(self::SIDES)->filter(fn ($side) => $sheet->{strtolower($side).'_count'} > 0)->values();

            return $sheet;
        });

        return response()->json($page);
    }

    public function show(TorqueCheckSheet $torqueCheckSheet): JsonResponse
    {
        return response()->json(['status' => 'success', 'data' => $torqueCheckSheet->load('readings', 'creelType')]);
    }

    /** Looks up a sheet by the session id it was assigned on its first reading, so it can be resumed on another device. */
    public function getSession(string $sessionId): JsonResponse
    {
        $sheet = TorqueCheckSheet::forSessionOrId($sessionId)->first();

        if (! $sheet) {
            return response()->json(['success' => false, 'message' => 'Session not found'], 404);
        }

        return response()->json(['success' => true, 'data' => $sheet->load('readings', 'creelType')]);
    }

    private function generateUniqueSessionId(): string
    {
        do {
            $sessionId = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        } while (TorqueCheckSheet::where('session_id', $sessionId)->exists());

        return $sessionId;
    }

    /** Reading fields shared by create and update. */
    private function readingRules(bool $partial = false): array
    {
        $req = $partial ? 'sometimes|required' : 'required';

        return [
            'side' => "{$req}|in:".implode(',', self::SIDES),
            'row_no' => "{$req}|integer|between:1,105",
            'column_letter' => "{$req}|in:A,B,C,D,E",
            'value' => "{$req}|numeric|min:0|multiple_of:0.5",
            'note' => 'nullable|string|max:255',
        ];
    }

    /**
     * Records (or corrects) one cell of one side's grid.
     *
     * `session_id` continues an existing sheet (typed in on another device, or resumed after a reload); it must
     * already exist. Without it, the sheet is created on the first cell, found by its client uuid — so every
     * queued upload stands on its own — and assigned a fresh session id for the operator to note down. Either
     * way the reading itself is upserted by side+grid position, so a retried offline submit or an edit to an
     * already-filled cell never creates a duplicate, and the same row/column on a different side is a separate cell.
     */
    public function storeReading(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session_id' => 'nullable|string',
            'sheet_client_uuid' => 'required_without:session_id|uuid',
            'check_date' => 'required_without:session_id|date',
            'operator_name' => 'required_without:session_id|string|max:255',
            'machine_number' => 'required_without:session_id|string|max:255',
            'creel_type_id' => 'required_without:session_id|exists:creel_types,id',
            'client_uuid' => 'nullable|uuid',
        ] + $this->readingRules());

        $reading = DB::transaction(function () use ($data, $request) {
            if (! empty($data['session_id'])) {
                $sheet = TorqueCheckSheet::forSessionOrId($data['session_id'])->first();
                abort_if(! $sheet, 404, 'Session not found');
            } else {
                // Two near-simultaneous first-cell submits (a double tap, a retry racing the original) can both
                // find nothing and try to create the sheet; `firstOrCreate` catches that itself in the common
                // case, but under load its own re-fetch can still lose narrowly — so fall back to one more here.
                try {
                    $sheet = TorqueCheckSheet::firstOrCreate(
                        ['client_uuid' => $data['sheet_client_uuid']],
                        collect($data)->only(['check_date', 'operator_name', 'machine_number', 'creel_type_id'])->all()
                            + ['session_id' => $this->generateUniqueSessionId(), 'user_id' => $request->user()->id],
                    );
                } catch (\Illuminate\Database\UniqueConstraintViolationException) {
                    $sheet = TorqueCheckSheet::where('client_uuid', $data['sheet_client_uuid'])->firstOrFail();
                }
            }

            return TorqueCheckReading::updateOrCreate(
                ['torque_check_sheet_id' => $sheet->id, 'side' => $data['side'], 'row_no' => $data['row_no'], 'column_letter' => $data['column_letter']],
                collect($data)->only(['value', 'note'])->all() + ['client_uuid' => $data['client_uuid'] ?? null, 'user_id' => $request->user()->id],
            );
        });

        return response()->json(['success' => true, 'message' => 'Reading recorded', 'data' => $reading->load('sheet:id,client_uuid,session_id')], 201);
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

    /** One grid section per side that has readings (the paper's layout: one row per NO, columns A-E), plus each side's flagged cells as a problem list. */
    public function downloadCsv(TorqueCheckSheet $torqueCheckSheet): JsonResponse
    {
        $readings = $torqueCheckSheet->readings()->get();
        if ($readings->isEmpty()) {
            return response()->json(['success' => false, 'message' => 'This sheet has no readings yet.'], 404);
        }

        $sections = $readings->groupBy('side')->map(function ($sideReadings, $side) {
            $lastRow = (int) $sideReadings->max('row_no');
            $byPosition = $sideReadings->keyBy(fn ($r) => "{$r->row_no}{$r->column_letter}");

            $grid = [];
            for ($row = 1; $row <= $lastRow; $row++) {
                $line = ['NO' => $row];
                foreach (['A', 'B', 'C', 'D', 'E'] as $col) {
                    $line[$col] = $byPosition->get("{$row}{$col}")?->value;
                }
                $grid[] = $line;
            }

            $problems = $sideReadings->whereNotNull('note')->map(fn ($r) => ['ROW' => $r->row_no, 'COLUMN' => $r->column_letter, 'NOTE' => $r->note])->values();

            return ['side' => $side, 'grid' => $grid, 'problems' => $problems];
        })->sortBy('side')->values();

        return response()->json(['success' => true, 'sheet_id' => $torqueCheckSheet->id, 'sections' => $sections]);
    }
}
