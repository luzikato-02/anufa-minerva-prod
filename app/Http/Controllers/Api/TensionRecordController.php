<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TensionRecord;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class TensionRecordController extends Controller
{
    /**
     * Display a listing of tension records
     */
    public function index(Request $request): JsonResponse
    {
        $query = TensionRecord::query();

    // 🔍 Global search (case-insensitive)
    if ($search = $request->input('search')) {
        $search = strtolower($search);
        $query->where(function ($q) use ($search) {
            $q->whereRaw('LOWER(record_type) LIKE ?', ["%{$search}%"])
              ->orWhereRaw('LOWER(csv_data) LIKE ?', ["%{$search}%"])
              ->orWhereRaw('LOWER(JSON_UNQUOTE(JSON_EXTRACT(metadata, "$.operator"))) LIKE ?', ["%{$search}%"])
              ->orWhereRaw('LOWER(JSON_UNQUOTE(JSON_EXTRACT(metadata, "$.machine_number"))) LIKE ?', ["%{$search}%"]);
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

        // Search in item numbers
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereJsonContains('metadata->item_number', $search)
                  ->orWhereJsonContains('metadata->operator', $search)
                  ->orWhereJsonContains('metadata->machine_number', $search);
            });
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
            '%s-%s-%s.csv',
            $tensionRecord->record_type,
            $tensionRecord->item_number ?? 'unknown',
            $tensionRecord->created_at->format('Y-m-d')
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
        $stats = [
            'total_records' => TensionRecord::count(),
            'twisting_records' => TensionRecord::byType('twisting')->count(),
            'weaving_records' => TensionRecord::byType('weaving')->count(),
            'recent_records' => TensionRecord::orderBy('created_at', 'desc')->take(5)->get(),
            'operators' => TensionRecord::selectRaw("JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.operator')) as operator")
                ->whereNotNull('metadata->operator')
                ->groupBy('operator')
                ->pluck('operator'),
            'machines' => TensionRecord::selectRaw("JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.machine_number')) as machine")
                ->whereNotNull('metadata->machine_number')
                ->groupBy('machine')
                ->pluck('machine'),
            // ✅ Count records where problems array is not empty
            'twisting_problems' => TensionRecord::byType('twisting')
                ->whereRaw('JSON_LENGTH(problems) > 0')
                ->count(),

            'weaving_problems' => TensionRecord::byType('weaving')
                ->whereRaw('JSON_LENGTH(problems) > 0')
                ->count(),
        ];

        return response()->json([
            'status' => 'success',
            'data' => $stats
        ]);
    }
}
