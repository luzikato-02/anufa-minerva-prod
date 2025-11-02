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
                // 'data' => [
                //     'metadata' => [
                //         'total_batches' => $metadata['total_batches'] ?? count($batchData),
                //         'total_materials' => $metadata['total_materials'] ?? 0,
                //         'total_checked_batches' => $metadata['total_checked_batches'] ?? 0,
                //         'session_leader' => $metadata['session_leader'] ?? null,
                //         'session_status' => $metadata['session_status'] ?? 'active',
                //     ],
                //     'indv_batch_data' => $batchData,
                // ],
                'message' => 'Session loaded successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to load session: ' . $e->getMessage()
            ], 500);
        }
    }

    public function updateSessionStatus(Request $request, $id): JsonResponse
{
    try {
        // Validate request input
        $validated = $request->validate([
            'session_status' => [
                'required',
                Rule::in(['Completed', 'In Progress']), // ✅ limit to allowed statuses
            ],
        ]);

        // Find the record by id or session_id
        $record = StockTakingRecord::where('id', $id)
            ->orWhere('session_id', $id)
            ->first();

        if (!$record) {
            return response()->json([
                'success' => false,
                'message' => 'Session not found',
            ], 404);
        }

        // Update the metadata’s session_status field
        $metadata = $record->metadata ?? [];
        $metadata['session_status'] = $validated['session_status'];
        $record->metadata = $metadata;
        $record->save();

        return response()->json([
            'success' => true,
            'message' => 'Session status updated successfully.',
            'data' => [
                'session_id' => $record->session_id,
                'session_status' => $metadata['session_status'],
            ],
        ]);
    } catch (\Illuminate\Validation\ValidationException $e) {
        return response()->json([
            'success' => false,
            'message' => 'Invalid status value.',
            'errors' => $e->errors(),
        ], 422);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Failed to update session status: ' . $e->getMessage(),
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

        // 🔍 Find the session record
        $record = StockTakingRecord::where('id', $sessionId)
            ->orWhere('session_id', $sessionId)
            ->first();

        if (!$record) {
            return response()->json([
                'exists' => false,
                'message' => 'Session not found'
            ], 404);
        }

        // 🔍 Check if batch exists in the master list
        $batchData = $record->indv_batch_data ?? [];
        $foundBatch = collect($batchData)->first(function ($batch) use ($batchNumber) {
            $batchKey = $batch['Batch Number'] ?? $batch['batch_number'] ?? null;
            return $batchKey === $batchNumber;
        });

        if (!$foundBatch) {
            return response()->json([
                'exists' => false,
                'message' => 'Batch not found in this session',
            ]);
        }

        // ✅ Check if this batch has already been recorded
        $recordedBatches = $record->recorded_batches ?? [];
        $alreadyRecorded = collect($recordedBatches)->contains(function ($recorded) use ($batchNumber) {
            return ($recorded['batch_number'] ?? null) === $batchNumber;
        });

        if ($alreadyRecorded) {
            return response()->json([
                'exists' => true,
                'already_recorded' => true,
                'batch_data' => $foundBatch,
                'message' => 'Batch already found. Move to the next batch.'
            ]);
        }

        // ✅ Otherwise, return batch is valid and ready to record
        return response()->json([
            'exists' => true,
            'already_recorded' => false,
            'batch_data' => $foundBatch,
            'message' => 'Batch is valid but not "found" yet.'
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'exists' => false,
            'message' => 'Failed to check batch: ' . $e->getMessage()
        ], 500);
    }
}


    public function recordBatch(Request $request): JsonResponse
{
    try {
        // Step 1️⃣: Accept both naming formats
        $data = $request->all();

        // Normalize keys so both formats work
        $normalized = [
            'session_id'          => $data['session_id'] ?? null,
            'batch_number'        => $data['batch_number'] ?? $data['Batch Number'] ?? null,
            'material_code'       => $data['material_code'] ?? $data['Material Code'] ?? null,
            'material_description'=> $data['material_description'] ?? $data['Material Desciption'] ?? null,
            'actual_weight'       => $data['actual_weight'] ?? null,
            'total_bobbins'       => $data['total_bobbins'] ?? null,
            'timestamp'           => $data['timestamp'] ?? $data['found_at'] ?? null,
            'user_found'          => $data['user_found'] ?? $data['found_by'] ?? null,
        ];

        // Step 2️⃣: Validate normalized fields
        $validated = validator($normalized, [
            'session_id'           => 'required|string',
            'batch_number'         => 'required|string',
            'material_code'        => 'required|string',
            'material_description' => 'required|string',
            'actual_weight'        => 'required|numeric|min:0',
            'total_bobbins'        => 'required|integer|min:0',
            'timestamp'            => 'required|date',
            'user_found'           => 'required|string',
        ])->validate();

        // Step 3️⃣: Find session
        $record = StockTakingRecord::where('id', $validated['session_id'])
            ->orWhere('session_id', $validated['session_id'])
            ->first();

        if (!$record) {
            return response()->json([
                'success' => false,
                'message' => 'Session not found'
            ], 404);
        }

        // Step 4️⃣: Append new batch entry
        $batchRecording = [
            'batch_number'        => $validated['batch_number'],
            'material_code'       => $validated['material_code'],
            'material_description'=> $validated['material_description'],
            'actual_weight'       => $validated['actual_weight'],
            'total_bobbins'       => $validated['total_bobbins'],
            'timestamp_found'     => $validated['timestamp'],
            'user_found'          => $validated['user_found'],
            'recorded_at'         => now()->toIso8601String(),
        ];

        $recordedBatches = $record->recorded_batches ?? [];
        $recordedBatches[] = $batchRecording;
        $record->recorded_batches = $recordedBatches;

        // Update metadata count
        $metadata = $record->metadata ?? [];
        $metadata['total_checked_batches'] = ($metadata['total_checked_batches'] ?? 0) + 1;
        $record->metadata = $metadata;
        $record->save();

        return response()->json([
            'success' => true,
            'message' => 'Batch recorded successfully',
            'data' => $batchRecording
        ], 201);

    } catch (\Illuminate\Validation\ValidationException $e) {
        return response()->json([
            'success' => false,
            'message' => 'Validation failed',
            'errors' => $e->errors()
        ], 422);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Failed to record batch: ' . $e->getMessage()
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
  /**
 * Send stock_take_summary data as JSON for frontend CSV conversion
 */
public function downloadCsv(StockTakingRecord $stockTakeRecord): JsonResponse
{
    // Step 1: Get stock_take_summary safely
    $summary = $stockTakeRecord->stock_take_summary ?? null;

    // Step 2: Decode JSON if stored as string
    if (is_string($summary)) {
        $summary = json_decode($summary, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid JSON in stock_take_summary.',
            ], 422);
        }
    }

    // Step 3: Validate the summary is a non-empty array
    if (!is_array($summary) || empty($summary)) {
        return response()->json([
            'success' => false,
            'message' => 'No stock_take_summary data found for this session.',
        ], 404);
    }

    // Step 4: Return JSON to frontend
    return response()->json([
        'success' => true,
        'session_id' => $stockTakeRecord->session_id ?? $stockTakeRecord->id,
        'summary' => $summary,
    ]);
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
