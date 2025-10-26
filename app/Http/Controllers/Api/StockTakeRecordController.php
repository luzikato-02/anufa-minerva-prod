<?php

namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\StockTakingRecord;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class StockTakeRecordController extends Controller
{
    /**
     * Display a listing of stock take records
     */
    public function index(Request $request): JsonResponse
    {
        $query = StockTakingRecord::query();

    // 🔍 Global search (case-insensitive)
    if ($search = $request->input('search')) {
        $search = strtolower($search);
        $query->where(function ($q) use ($search) {
            $q->whereRaw('LOWER(record_type) LIKE ?', ["%{$search}%"])
              ->orWhereRaw('LOWER(csv_data) LIKE ?', ["%{$search}%"])
              ->orWhereRaw('LOWER(JSON_UNQUOTE(JSON_EXTRACT(metadata, "$.session_leader"))) LIKE ?', ["%{$search}%"]);
        });
    }

        // Filter by operator
        if ($request->has('session_leader')) {
            $query->byOperator($request->session_leader);
        }

        // Order by latest first
        $query->orderBy('created_at', 'desc');

        // Paginate results
        $perPage = $request->get('per_page', 10);
        $records = $query->paginate($perPage);

        return response()->json($records);
    }

    public function getSession(Request $request, $sessionId): JsonResponse
    {
        try {
            // Find the stock taking record by session ID
            $record = StockTakingRecord::where('id', $sessionId)
                ->orWhere('session_id', $sessionId)
                ->first();

            if (!$record) {
                return response()->json([
                    'success' => false,
                    'message' => 'Session not found'
                ], 404);
            }

            // Extract metadata and batch data
            $metadata = $record->metadata ?? [];
            $batchData = $record->indv_batch_data ?? [];

            return response()->json([
                'success' => true,
                'data' => [
                    'metadata' => [
                        'total_batches' => $metadata['total_batches'] ?? count($batchData),
                        'total_materials' => $metadata['total_materials'] ?? 0,
                        'total_checked_batches' => $metadata['total_checked_batches'] ?? 0,
                        'session_leader' => $metadata['session_leader'] ?? null,
                        'session_status' => $metadata['session_status'] ?? 'active',
                    ],
                    'indv_batch_data' => $batchData,
                ],
                'message' => 'Session loaded successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to load session: ' . $e->getMessage()
            ], 500);
        }
    }

    public function checkBatch(Request $request): JsonResponse
    {
        try {
            $sessionId = $request->query('session_id');
            $batchNumber = $request->query('batch_number');

            if (!$sessionId || !$batchNumber) {
                return response()->json([
                    'exists' => false,
                    'message' => 'Session ID and batch number are required'
                ], 400);
            }

            // Find the session record
            $record = StockTakingRecord::where('id', $sessionId)
                ->orWhere('session_id', $sessionId)
                ->first();

            if (!$record) {
                return response()->json([
                    'exists' => false,
                    'message' => 'Session not found'
                ], 404);
            }

            // Search for the batch in indv_batch_data
            $batchData = $record->indv_batch_data ?? [];
            $foundBatch = null;

            foreach ($batchData as $batch) {
                $batchKey = $batch['Batch Number'] ?? $batch['batch_number'] ?? null;
                if ($batchKey === $batchNumber) {
                    $foundBatch = $batch;
                    break;
                }
            }


            if ($foundBatch) {
                return response()->json([
                    'exists' => true,
                    'batch_data' => $foundBatch,
                    'message' => 'Batch exists'
                ]);
            }

            return response()->json([
                'exists' => false,
                'batch_data' => null,
                'message' => 'Batch not found in this session'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'exists' => false,
                'message' => 'Failed to check batch: ' . $e->getMessage()
            ], 500);
        }
    }

    protected function generateUniqueSessionId(): string
    {
        do {
            $sessionId = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        } while (StockTakingRecord::where('session_id', $sessionId)->exists());

        return $sessionId;
    }

    /**
     * Store a newly created tension record
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'indv_batch_data' => 'required|array',
            'metadata' => 'required|array',
            'metadata.total_batches' => 'required|integer|min:0',
            'metadata.total_checked_batches' => 'required|integer|min:0',
            'metadata.total_materials' => 'required|integer|min:0',
            'metadata.session_leader' => 'nullable|string',
            'metadata.session_status' => 'nullable|string',
        ]);

        // ✅ Add auto-generated 6-digit session ID
        $validated['session_id'] = $this->generateUniqueSessionId();

        // Add user_id if authenticated
        if (auth()->check()) {
            $validated['user_id'] = auth()->id();
        }

        $record = StockTakingRecord::create($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'New stock take session initiated.',
            'data' => $record
        ], 201);
    }

    /**
     * Display the specified tension record
     */
    public function show(StockTakingRecord $stockTakeRecord): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => $stockTakeRecord
        ]);
    }

    /**
     * Update the specified tension record
     */
    public function update(Request $request, StockTakingRecord $stockTakeRecord): JsonResponse
    {
        $validated = $request->validate([
            'indv_batch_data' => 'array',
            'metadata' => 'array',
        ]);

        $stockTakeRecord->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Stock take record updated successfully',
            'data' => $stockTakeRecord
        ]);
    }

    /**
     * Remove the specified tension record
     */
    public function destroy(StockTakingRecord $stockTakeRecord): JsonResponse
    {
        $stockTakeRecord->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Stock take session deleted successfully.',
        ]);
    }

    /**
     * Download CSV data for a specific record
     */
    public function downloadCsv(StockTakingRecord $stockTakeRecord)
    {
        $filename = sprintf(
            '%s-%s.csv',
            $stockTakeRecord->created_at->format('Y-m-d'),
            $tensionRecord->session_leader ?? 'unknown'
        );
        return response($stockTakeRecord->csv_data)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename="' . $filename . '"');
    }

    /**
     * Get statistics for dashboard
     */
    // public function statistics(): JsonResponse
    // {
    //     $stats = [
    //         'total_records' => TensionRecord::count(),
    //         'twisting_records' => TensionRecord::byType('twisting')->count(),
    //         'weaving_records' => TensionRecord::byType('weaving')->count(),
    //         'recent_records' => TensionRecord::orderBy('created_at', 'desc')->take(5)->get(),
    //         'operators' => TensionRecord::selectRaw("JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.operator')) as operator")
    //             ->whereNotNull('metadata->operator')
    //             ->groupBy('operator')
    //             ->pluck('operator'),
    //         'machines' => TensionRecord::selectRaw("JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.machine_number')) as machine")
    //             ->whereNotNull('metadata->machine_number')
    //             ->groupBy('machine')
    //             ->pluck('machine'),
    //         // ✅ Count records where problems array is not empty
    //         'twisting_problems' => TensionRecord::byType('twisting')
    //             ->whereRaw('JSON_LENGTH(problems) > 0')
    //             ->count(),

    //         'weaving_problems' => TensionRecord::byType('weaving')
    //             ->whereRaw('JSON_LENGTH(problems) > 0')
    //             ->count(),
    //     ];

    //     return response()->json([
    //         'status' => 'success',
    //         'data' => $stats
    //     ]);
    // }
}
