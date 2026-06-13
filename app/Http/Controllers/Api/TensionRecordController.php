<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TensionRecord;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TensionRecordController extends Controller
{
    /**
     * Build a SQL fragment that extracts an unquoted scalar value from a JSON column.
     * SQLite's JSON_EXTRACT already returns unquoted scalars; MySQL needs JSON_UNQUOTE.
     */
    private function jsonExtract(string $column, string $path): string
    {
        return DB::connection()->getDriverName() === 'sqlite'
            ? "JSON_EXTRACT({$column}, '{$path}')"
            : "JSON_UNQUOTE(JSON_EXTRACT({$column}, '{$path}'))";
    }

    /**
     * Build a SQL fragment that returns the length of a JSON array column.
     * SQLite uses JSON_ARRAY_LENGTH; MySQL uses JSON_LENGTH.
     */
    private function jsonArrayLength(string $column): string
    {
        return DB::connection()->getDriverName() === 'sqlite'
            ? "JSON_ARRAY_LENGTH({$column})"
            : "JSON_LENGTH({$column})";
    }

    /**
     * Display a listing of tension records
     */
    public function index(Request $request): JsonResponse
    {
        $query = TensionRecord::query();

    // 🔍 Global search (case-insensitive)
    if ($search = $request->input('search')) {
        $search = strtolower($search);
        $operatorExpr = $this->jsonExtract('metadata', '$.operator');
        $machineExpr = $this->jsonExtract('metadata', '$.machine_number');
        $itemNumberExpr = $this->jsonExtract('metadata', '$.item_number');
        $query->where(function ($q) use ($search, $operatorExpr, $machineExpr, $itemNumberExpr) {
            $q->whereRaw('LOWER(record_type) LIKE ?', ["%{$search}%"])
              ->orWhereRaw('LOWER(csv_data) LIKE ?', ["%{$search}%"])
              ->orWhereRaw("LOWER({$operatorExpr}) LIKE ?", ["%{$search}%"])
              ->orWhereRaw("LOWER({$machineExpr}) LIKE ?", ["%{$search}%"])
              ->orWhereRaw("LOWER({$itemNumberExpr}) LIKE ?", ["%{$search}%"]);
        });
    }

        // Filter by record type
        if ($request->has('type')) {
            $query->byType($request->type);
        }

        // Filter by operator
        if ($request->has('operator')) {
            $query->byOperator($request->operator);
        }

        // Filter by machine
        if ($request->has('machine')) {
            $query->byMachine($request->machine);
        }

        // Order by latest first
        $query->orderBy('created_at', 'desc');

        // Paginate results
        $perPage = $request->get('per_page', 10);
        $records = $query->paginate($perPage);

        return response()->json($records);
    }

    /**
     * Store a newly created tension record
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'record_type' => ['required', Rule::in(['twisting', 'weaving'])],
            'csv_data' => 'required|string',
            'form_data' => 'required|array',
            'measurement_data' => 'required|array',
            'problems' => 'array',
            'metadata' => 'required|array',
            'metadata.total_measurements' => 'required|integer|min:0',
            'metadata.completed_measurements' => 'required|integer|min:0',
            'metadata.progress_percentage' => 'required|integer|min:0|max:100',
            'metadata.operator' => 'nullable|string',
            'metadata.machine_number' => 'nullable|string',
            'metadata.item_number' => 'nullable|string',
            'metadata.item_description' => 'nullable|string',
            'metadata.yarn_code' => 'nullable|string',
        ]);

        // Add user_id if authenticated
        if (auth()->check()) {
            $validated['user_id'] = auth()->id();
        }

        $record = TensionRecord::create($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Tension record saved successfully',
            'data' => $record
        ], 201);
    }

    /**
     * Display the specified tension record
     */
    public function show(TensionRecord $tensionRecord): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => $tensionRecord
        ]);
    }

    /**
     * Update the specified tension record
     */
    public function update(Request $request, TensionRecord $tensionRecord): JsonResponse
    {
        $validated = $request->validate([
            'record_type' => [Rule::in(['twisting', 'weaving'])],
            'csv_data' => 'string',
            'form_data' => 'array',
            'measurement_data' => 'array',
            'problems' => 'array',
            'metadata' => 'array',
        ]);

        $tensionRecord->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Tension record updated successfully',
            'data' => $tensionRecord
        ]);
    }

    /**
     * Remove the specified tension record
     */
    public function destroy(TensionRecord $tensionRecord): JsonResponse
    {
        $tensionRecord->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Tension record deleted successfully'
        ]);
    }

    /**
     * Download CSV data for a specific record
     */
    public function downloadCsv(TensionRecord $tensionRecord)
    {
        $filename = sprintf(
            '%s-%s-%s-%s-%s.csv',
            $tensionRecord->record_type,
            $tensionRecord->item_number ?? 'unknown',
            $tensionRecord->machine_number ?? 'unknown',
            $tensionRecord->created_at->format('Y-m-d'),
            $tensionRecord->operator ?? 'unknown'
        );
        return response($tensionRecord->csv_data)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename="' . $filename . '"');
    }

    /**
     * Get statistics for dashboard
     */
    public function statistics(): JsonResponse
    {
        $problemsLengthExpr = $this->jsonArrayLength('problems');

        $stats = [
            'total_records' => TensionRecord::count(),
            'twisting_records' => TensionRecord::byType('twisting')->count(),
            'weaving_records' => TensionRecord::byType('weaving')->count(),
            'recent_records' => TensionRecord::orderBy('created_at', 'desc')->take(5)->get(),
            'operators' => TensionRecord::whereNotNull('operator_generated')
                ->distinct()
                ->pluck('operator_generated'),
            'machines' => TensionRecord::whereNotNull('machine_number_generated')
                ->distinct()
                ->pluck('machine_number_generated'),
            // ✅ Count records where problems array is not empty
            'twisting_problems' => TensionRecord::byType('twisting')
                ->whereRaw("{$problemsLengthExpr} > 0")
                ->count(),

            'weaving_problems' => TensionRecord::byType('weaving')
                ->whereRaw("{$problemsLengthExpr} > 0")
                ->count(),
        ];

        return response()->json([
            'status' => 'success',
            'data' => $stats
        ]);
    }

    /**
     * Flattened, paginated list of all reported problems across all tension records
     * (both twisting and weaving), each annotated with parent record context.
     *
     * Query params:
     *   - search: matches against description, operator, machine_number, item_number (case-insensitive)
     *   - status: 'open' | 'resolved' | 'all' (default 'all')
     *   - type: 'twisting' | 'weaving' | 'all' (default 'all')
     *   - page, per_page: standard pagination
     */
    public function problems(Request $request): JsonResponse
    {
        $problemsLengthExpr = $this->jsonArrayLength('problems');

        $records = TensionRecord::whereRaw("{$problemsLengthExpr} > 0")
            ->when($request->filled('type') && $request->input('type') !== 'all', function ($q) use ($request) {
                $q->byType($request->input('type'));
            })
            ->orderBy('created_at', 'desc')
            ->get();

        $flattened = collect();

        foreach ($records as $record) {
            foreach ($record->problems ?? [] as $problem) {
                $flattened->push([
                    'record_id' => $record->id,
                    'record_type' => $record->record_type,
                    'item_number' => $record->item_number,
                    'operator' => $record->operator,
                    'machine_number' => $record->machine_number,
                    'record_created_at' => $record->created_at?->toIso8601String(),
                    'problem_id' => $problem['id'] ?? null,
                    'spindle_number' => $problem['spindleNumber'] ?? null,
                    'position' => $problem['position'] ?? null,
                    'description' => $problem['description'] ?? null,
                    'timestamp' => $problem['timestamp'] ?? null,
                    'status' => $problem['status'] ?? 'open',
                    'resolution' => $problem['resolution'] ?? null,
                ]);
            }
        }

        // Status filter (default: all)
        $status = $request->input('status', 'all');
        if (in_array($status, ['open', 'resolved'], true)) {
            $flattened = $flattened->filter(fn ($p) => ($p['status'] ?? 'open') === $status)->values();
        }

        // Search filter (case-insensitive across description/operator/machine/item_number/position/spindle)
        if ($search = $request->input('search')) {
            $search = strtolower($search);
            $flattened = $flattened->filter(function ($p) use ($search) {
                return str_contains(strtolower((string) ($p['description'] ?? '')), $search)
                    || str_contains(strtolower((string) ($p['operator'] ?? '')), $search)
                    || str_contains(strtolower((string) ($p['machine_number'] ?? '')), $search)
                    || str_contains(strtolower((string) ($p['item_number'] ?? '')), $search)
                    || str_contains(strtolower((string) ($p['position'] ?? '')), $search)
                    || str_contains(strtolower((string) ($p['spindle_number'] ?? '')), $search);
            })->values();
        }

        $flattened = $flattened->sortByDesc('record_created_at')->values();

        // Manual pagination
        $perPage = (int) $request->input('per_page', 10);
        $page = (int) $request->input('page', 1);
        $total = $flattened->count();
        $items = $flattened->slice(($page - 1) * $perPage, $perPage)->values();

        $paginator = new \Illuminate\Pagination\LengthAwarePaginator(
            $items,
            $total,
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        return response()->json($paginator);
    }

    /**
     * Mark a specific problem (within a tension record's `problems` JSON array) as resolved,
     * storing the resolution action and after-repair tension values.
     */
    public function resolveProblem(Request $request, TensionRecord $tensionRecord, string $problemId): JsonResponse
    {
        $validated = $request->validate([
            'action' => 'required|string',
            'after_repair_max' => 'nullable|numeric',
            'after_repair_min' => 'nullable|numeric',
        ]);

        $problems = $tensionRecord->problems ?? [];

        $index = null;
        foreach ($problems as $i => $p) {
            if ((string) ($p['id'] ?? '') === (string) $problemId) {
                $index = $i;
                break;
            }
        }

        if ($index === null) {
            return response()->json([
                'status' => 'error',
                'message' => 'Problem not found on this record',
            ], 404);
        }

        $problems[$index]['status'] = 'resolved';
        $problems[$index]['resolution'] = [
            'action' => $validated['action'],
            'after_repair_max' => $validated['after_repair_max'] ?? null,
            'after_repair_min' => $validated['after_repair_min'] ?? null,
            'resolved_by' => auth()->user()->name ?? 'Unknown',
            'resolved_at' => now()->toIso8601String(),
        ];

        $tensionRecord->problems = $problems;
        $tensionRecord->save();

        return response()->json([
            'status' => 'success',
            'message' => 'Problem marked as resolved',
            'data' => [
                'record' => $tensionRecord,
                'problem' => $problems[$index],
            ],
        ]);
    }
}
