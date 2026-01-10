<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TensionProblem;
use App\Models\TensionRecord;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TensionRecordController extends Controller
{
    /**
     * Display a listing of tension records with filtering and pagination
     */
    public function index(Request $request): JsonResponse
    {
        $query = TensionRecord::query()
            ->with(['user:id,name', 'tensionProblems'])
            ->withCount(['tensionProblems', 'unresolvedProblems']);

        // Global search
        if ($search = $request->input('search')) {
            $query->search($search);
        }

        // Filter by record type
        if ($request->has('type') && $request->type) {
            $query->byType($request->type);
        }

        // Filter by operator
        if ($request->has('operator') && $request->operator) {
            $query->byOperator($request->operator);
        }

        // Filter by machine number
        if ($request->has('machine') && $request->machine) {
            $query->byMachine($request->machine);
        }

        // Filter by item number
        if ($request->has('item') && $request->item) {
            $query->byItem($request->item);
        }

        // Filter by status
        if ($request->has('status') && $request->status) {
            $query->byStatus($request->status);
        }

        // Filter by date range
        if ($request->has('start_date') && $request->has('end_date')) {
            $query->createdBetween($request->start_date, $request->end_date);
        }

        // Filter records with problems only
        if ($request->boolean('with_problems')) {
            $query->withProblems();
        }

        // Filter records with unresolved problems
        if ($request->boolean('with_unresolved_problems')) {
            $query->withUnresolvedProblems();
        }

        // Sorting
        $sortField = $request->get('sort_by', 'created_at');
        $sortDirection = $request->get('sort_direction', 'desc');
        $allowedSortFields = [
            'created_at',
            'updated_at',
            'operator',
            'machine_number',
            'item_number',
            'progress_percentage',
            'record_type',
        ];

        if (in_array($sortField, $allowedSortFields)) {
            $query->orderBy($sortField, $sortDirection);
        } else {
            $query->orderBy('created_at', 'desc');
        }

        // Paginate results
        $perPage = min($request->get('per_page', 10), 100);
        $records = $query->paginate($perPage);

        return response()->json($records);
    }

    /**
     * Store a newly created tension record
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            // Record type
            'record_type' => ['required', Rule::in(array_keys(TensionRecord::getTypes()))],

            // Legacy JSON fields (still supported for backward compatibility)
            'csv_data' => 'required|string',
            'form_data' => 'required|array',
            'measurement_data' => 'required|array',
            'problems' => 'array',
            'metadata' => 'required|array',

            // Normalized common fields
            'operator' => 'nullable|string|max:100',
            'machine_number' => 'nullable|string|max:50',
            'item_number' => 'nullable|string|max:100',
            'item_description' => 'nullable|string|max:255',
            'meters_check' => 'nullable|numeric|min:0',
            'spec_tension' => 'nullable|numeric|min:0',
            'tension_tolerance' => 'nullable|numeric|min:0',

            // Twisting-specific fields
            'dtex_number' => 'nullable|string|max:50',
            'tpm' => 'nullable|integer|min:0',
            'rpm' => 'nullable|integer|min:0',
            'yarn_code' => 'nullable|string|max:100',

            // Weaving-specific fields
            'production_order' => 'nullable|string|max:100',
            'bale_number' => 'nullable|string|max:100',
            'color_code' => 'nullable|string|max:50',

            // Progress tracking
            'total_measurements' => 'nullable|integer|min:0',
            'completed_measurements' => 'nullable|integer|min:0',
            'progress_percentage' => 'nullable|integer|min:0|max:100',

            // Status
            'status' => ['nullable', Rule::in(array_keys(TensionRecord::getStatuses()))],

            // Metadata validation (legacy support)
            'metadata.total_measurements' => 'required|integer|min:0',
            'metadata.completed_measurements' => 'required|integer|min:0',
            'metadata.progress_percentage' => 'required|integer|min:0|max:100',
            'metadata.operator' => 'nullable|string',
            'metadata.machine_number' => 'nullable|string',
            'metadata.item_number' => 'nullable|string',
            'metadata.item_description' => 'nullable|string',
            'metadata.yarn_code' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            // Extract normalized fields from metadata if not provided directly
            $metadata = $validated['metadata'] ?? [];
            $formData = $validated['form_data'] ?? [];

            // Map fields from legacy format to normalized columns
            $recordData = array_merge($validated, [
                // Common fields from metadata
                'operator' => $validated['operator'] ?? $metadata['operator'] ?? null,
                'machine_number' => $validated['machine_number'] ?? $metadata['machine_number'] ?? null,
                'item_number' => $validated['item_number'] ?? $metadata['item_number'] ?? null,
                'item_description' => $validated['item_description'] ?? $metadata['item_description'] ?? null,
                'yarn_code' => $validated['yarn_code'] ?? $metadata['yarn_code'] ?? null,

                // Progress from metadata
                'total_measurements' => $validated['total_measurements'] ?? $metadata['total_measurements'] ?? 0,
                'completed_measurements' => $validated['completed_measurements'] ?? $metadata['completed_measurements'] ?? 0,
                'progress_percentage' => $validated['progress_percentage'] ?? $metadata['progress_percentage'] ?? 0,

                // Extract from form_data for twisting
                'meters_check' => $validated['meters_check'] ?? $this->numericOrNull($formData['metersCheck'] ?? null),
                'spec_tension' => $validated['spec_tension'] ?? $this->numericOrNull($formData['specTens'] ?? null),
                'tension_tolerance' => $validated['tension_tolerance'] ?? $this->numericOrNull($formData['tensPlus'] ?? null),
                'dtex_number' => $validated['dtex_number'] ?? ($formData['dtexNumber'] ?? null),
                'tpm' => $validated['tpm'] ?? $this->numericOrNull($formData['tpm'] ?? null),
                'rpm' => $validated['rpm'] ?? $this->numericOrNull($formData['rpm'] ?? null),

                // Extract from form_data for weaving
                'production_order' => $validated['production_order'] ?? ($formData['productionOrder'] ?? null),
                'bale_number' => $validated['bale_number'] ?? ($formData['baleNumber'] ?? null),
                'color_code' => $validated['color_code'] ?? ($formData['colorCode'] ?? null),

                // Set status
                'status' => $validated['status'] ?? TensionRecord::STATUS_COMPLETED,

                // Set user
                'user_id' => auth()->id(),
            ]);

            // Create the record
            $record = TensionRecord::create($recordData);

            // Create problem records from the problems array
            $problems = $validated['problems'] ?? [];
            if (!empty($problems)) {
                $this->createProblemsFromArray($record, $problems);
            }

            // Load relationships for response
            $record->load(['tensionProblems', 'user:id,name']);
            $record->loadCount(['tensionProblems', 'unresolvedProblems']);

            return response()->json([
                'status' => 'success',
                'message' => 'Tension record saved successfully',
                'data' => $record,
            ], 201);
        });
    }

    /**
     * Display the specified tension record
     */
    public function show(TensionRecord $tensionRecord): JsonResponse
    {
        $tensionRecord->load(['tensionProblems', 'user:id,name']);
        $tensionRecord->loadCount(['tensionProblems', 'unresolvedProblems']);

        return response()->json([
            'status' => 'success',
            'data' => $tensionRecord,
        ]);
    }

    /**
     * Update the specified tension record
     */
    public function update(Request $request, TensionRecord $tensionRecord): JsonResponse
    {
        $validated = $request->validate([
            'record_type' => [Rule::in(array_keys(TensionRecord::getTypes()))],
            'csv_data' => 'string',
            'form_data' => 'array',
            'measurement_data' => 'array',
            'problems' => 'array',
            'metadata' => 'array',

            // Normalized fields
            'operator' => 'nullable|string|max:100',
            'machine_number' => 'nullable|string|max:50',
            'item_number' => 'nullable|string|max:100',
            'item_description' => 'nullable|string|max:255',
            'meters_check' => 'nullable|numeric|min:0',
            'spec_tension' => 'nullable|numeric|min:0',
            'tension_tolerance' => 'nullable|numeric|min:0',
            'dtex_number' => 'nullable|string|max:50',
            'tpm' => 'nullable|integer|min:0',
            'rpm' => 'nullable|integer|min:0',
            'yarn_code' => 'nullable|string|max:100',
            'production_order' => 'nullable|string|max:100',
            'bale_number' => 'nullable|string|max:100',
            'color_code' => 'nullable|string|max:50',
            'total_measurements' => 'nullable|integer|min:0',
            'completed_measurements' => 'nullable|integer|min:0',
            'progress_percentage' => 'nullable|integer|min:0|max:100',
            'status' => [Rule::in(array_keys(TensionRecord::getStatuses()))],
        ]);

        $tensionRecord->update($validated);

        $tensionRecord->load(['tensionProblems', 'user:id,name']);
        $tensionRecord->loadCount(['tensionProblems', 'unresolvedProblems']);

        return response()->json([
            'status' => 'success',
            'message' => 'Tension record updated successfully',
            'data' => $tensionRecord,
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
            'message' => 'Tension record deleted successfully',
        ]);
    }

    /**
     * Download CSV data for a specific record
     */
    public function downloadCsv(TensionRecord $tensionRecord)
    {
        return response($tensionRecord->csv_data)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename="' . $tensionRecord->getCsvFilename() . '"');
    }

    /**
     * Get statistics for dashboard
     */
    public function statistics(): JsonResponse
    {
        $stats = [
            // Record counts by type
            'total_records' => TensionRecord::count(),
            'twisting_records' => TensionRecord::twisting()->count(),
            'weaving_records' => TensionRecord::weaving()->count(),

            // Recent records
            'recent_records' => TensionRecord::with('user:id,name')
                ->withCount('tensionProblems')
                ->orderBy('created_at', 'desc')
                ->take(5)
                ->get()
                ->map(fn ($r) => $r->getSummary()),

            // Unique operators
            'operators' => TensionRecord::whereNotNull('operator')
                ->distinct()
                ->pluck('operator'),

            // Unique machines
            'machines' => TensionRecord::whereNotNull('machine_number')
                ->distinct()
                ->pluck('machine_number'),

            // Problem statistics
            'twisting_problems' => TensionProblem::whereHas('tensionRecord', function ($q) {
                $q->twisting();
            })->count(),

            'weaving_problems' => TensionProblem::whereHas('tensionRecord', function ($q) {
                $q->weaving();
            })->count(),

            // Unresolved problems
            'unresolved_problems' => TensionProblem::unresolved()->count(),

            // Critical problems needing attention
            'critical_problems' => TensionProblem::critical()->unresolved()->count(),

            // Records by status
            'records_by_status' => [
                'completed' => TensionRecord::completed()->count(),
                'in_progress' => TensionRecord::byStatus(TensionRecord::STATUS_IN_PROGRESS)->count(),
                'draft' => TensionRecord::byStatus(TensionRecord::STATUS_DRAFT)->count(),
                'archived' => TensionRecord::byStatus(TensionRecord::STATUS_ARCHIVED)->count(),
            ],

            // Today's records
            'today_records' => TensionRecord::whereDate('created_at', today())->count(),

            // This week's records
            'week_records' => TensionRecord::whereBetween('created_at', [
                now()->startOfWeek(),
                now()->endOfWeek(),
            ])->count(),
        ];

        return response()->json([
            'status' => 'success',
            'data' => $stats,
        ]);
    }

    /**
     * Get problems for a specific record
     */
    public function problems(TensionRecord $tensionRecord): JsonResponse
    {
        $problems = $tensionRecord->tensionProblems()
            ->with('resolver:id,name')
            ->orderBy('reported_at', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $problems,
        ]);
    }

    /**
     * Add a problem to a record
     */
    public function addProblem(Request $request, TensionRecord $tensionRecord): JsonResponse
    {
        $validated = $request->validate([
            'position_identifier' => 'required|string|max:100',
            'problem_type' => ['nullable', Rule::in(array_keys(TensionProblem::getTypes()))],
            'description' => 'required|string',
            'measured_value' => 'nullable|numeric',
            'expected_min' => 'nullable|numeric',
            'expected_max' => 'nullable|numeric',
            'severity' => ['nullable', Rule::in(array_keys(TensionProblem::getSeverityLevels()))],
        ]);

        $validated['problem_type'] = $validated['problem_type'] ?? TensionProblem::TYPE_OTHER;
        $validated['severity'] = $validated['severity'] ?? TensionProblem::SEVERITY_MEDIUM;
        $validated['reported_at'] = now();

        $problem = $tensionRecord->addProblem($validated);
        $problem->load('tensionRecord:id,record_type,machine_number');

        return response()->json([
            'status' => 'success',
            'message' => 'Problem added successfully',
            'data' => $problem,
        ], 201);
    }

    /**
     * Resolve a problem
     */
    public function resolveProblem(Request $request, TensionProblem $tensionProblem): JsonResponse
    {
        $validated = $request->validate([
            'resolution_notes' => 'nullable|string',
        ]);

        $tensionProblem->markAsResolved(auth()->id(), $validated['resolution_notes'] ?? null);
        $tensionProblem->load(['tensionRecord:id,record_type', 'resolver:id,name']);

        return response()->json([
            'status' => 'success',
            'message' => 'Problem marked as resolved',
            'data' => $tensionProblem,
        ]);
    }

    /**
     * Get all problems across all records with filtering
     */
    public function allProblems(Request $request): JsonResponse
    {
        $query = TensionProblem::with(['tensionRecord:id,record_type,machine_number,operator', 'resolver:id,name']);

        // Filter by record type
        if ($request->has('record_type')) {
            $query->whereHas('tensionRecord', function ($q) use ($request) {
                $q->byType($request->record_type);
            });
        }

        // Filter by severity
        if ($request->has('severity')) {
            $query->bySeverity($request->severity);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->byStatus($request->status);
        }

        // Filter by problem type
        if ($request->has('problem_type')) {
            $query->ofType($request->problem_type);
        }

        // Show only unresolved
        if ($request->boolean('unresolved_only')) {
            $query->unresolved();
        }

        $query->orderBy('reported_at', 'desc');

        $perPage = min($request->get('per_page', 20), 100);
        $problems = $query->paginate($perPage);

        return response()->json($problems);
    }

    /**
     * Create problems from legacy array format
     */
    private function createProblemsFromArray(TensionRecord $record, array $problems): void
    {
        foreach ($problems as $problem) {
            $positionIdentifier = $record->isTwisting()
                ? ($problem['spindleNumber'] ?? $problem['spindle_number'] ?? 'unknown')
                : ($problem['position'] ?? 'unknown');

            $record->tensionProblems()->create([
                'position_identifier' => $positionIdentifier,
                'problem_type' => TensionProblem::TYPE_OTHER,
                'description' => $problem['description'] ?? '',
                'severity' => TensionProblem::SEVERITY_MEDIUM,
                'resolution_status' => TensionProblem::STATUS_OPEN,
                'reported_at' => isset($problem['timestamp'])
                    ? \Carbon\Carbon::parse($problem['timestamp'])
                    : now(),
            ]);
        }
    }

    /**
     * Convert string to numeric or null
     */
    private function numericOrNull($value)
    {
        if ($value === null || $value === '') {
            return null;
        }

        return is_numeric($value) ? (float) $value : null;
    }
}
