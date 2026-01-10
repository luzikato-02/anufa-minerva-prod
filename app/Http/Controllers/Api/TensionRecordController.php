<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TensionProblem;
use App\Models\TensionRecord;
use App\Models\TwistingMeasurement;
use App\Models\WeavingMeasurement;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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

            // Log measurement data for debugging
            Log::info('Creating measurements for record', [
                'record_id' => $record->id,
                'record_type' => $record->record_type,
                'measurement_data_structure' => json_encode($validated['measurement_data'] ?? []),
            ]);

            // Create measurement records from the measurement_data array
            $measurementData = $validated['measurement_data'] ?? [];
            if (!empty($measurementData)) {
                $measurementCount = $this->createMeasurementsFromArray($record, $measurementData);
                Log::info('Measurements created', [
                    'record_id' => $record->id,
                    'count' => $measurementCount,
                ]);
            }

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
     * Get measurements for a specific record
     */
    public function measurements(TensionRecord $tensionRecord): JsonResponse
    {
        if ($tensionRecord->isTwisting()) {
            $measurements = $tensionRecord->twistingMeasurements()
                ->orderBy('spindle_number')
                ->get();
        } else {
            $measurements = $tensionRecord->weavingMeasurements()
                ->orderByPosition()
                ->get();
        }

        return response()->json([
            'status' => 'success',
            'data' => $measurements,
            'stats' => $tensionRecord->getMeasurementStats(),
        ]);
    }

    /**
     * Get measurements grouped by position for a specific record
     */
    public function measurementsGrouped(TensionRecord $tensionRecord): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => $tensionRecord->getMeasurementsGrouped(),
            'stats' => $tensionRecord->getMeasurementStats(),
            'tension_stats' => $tensionRecord->getTensionStatistics(),
        ]);
    }

    /**
     * Get out-of-spec measurements for a specific record
     */
    public function outOfSpecMeasurements(TensionRecord $tensionRecord): JsonResponse
    {
        if ($tensionRecord->isTwisting()) {
            $measurements = $tensionRecord->twistingMeasurements()
                ->outOfSpec()
                ->orderBy('spindle_number')
                ->get();
        } else {
            $measurements = $tensionRecord->weavingMeasurements()
                ->outOfSpec()
                ->orderByPosition()
                ->get();
        }

        return response()->json([
            'status' => 'success',
            'data' => $measurements,
            'count' => $measurements->count(),
        ]);
    }

    /**
     * Update a single twisting measurement
     */
    public function updateTwistingMeasurement(
        Request $request,
        TensionRecord $tensionRecord,
        int $spindleNumber
    ): JsonResponse {
        if (!$tensionRecord->isTwisting()) {
            return response()->json([
                'status' => 'error',
                'message' => 'This record is not a twisting record',
            ], 400);
        }

        $validated = $request->validate([
            'max_value' => 'nullable|numeric|min:0',
            'min_value' => 'nullable|numeric|min:0',
        ]);

        $measurement = $tensionRecord->twistingMeasurements()
            ->firstOrCreate(
                ['spindle_number' => $spindleNumber],
                ['tension_record_id' => $tensionRecord->id]
            );

        // Update values
        if (array_key_exists('max_value', $validated)) {
            $measurement->max_value = $validated['max_value'];
        }
        if (array_key_exists('min_value', $validated)) {
            $measurement->min_value = $validated['min_value'];
        }

        // Update completion status and calculated fields
        $measurement->is_complete = $measurement->max_value !== null && $measurement->min_value !== null;
        $measurement->measured_at = now();

        // Calculate avg and range
        if ($measurement->is_complete) {
            $measurement->avg_value = ($measurement->max_value + $measurement->min_value) / 2;
            $measurement->range_value = $measurement->max_value - $measurement->min_value;
        } else {
            $measurement->avg_value = null;
            $measurement->range_value = null;
        }

        // Check if out of spec
        if ($measurement->is_complete && $tensionRecord->spec_tension !== null) {
            $tolerance = $tensionRecord->tension_tolerance ?? 0;
            $measurement->is_out_of_spec = $measurement->avg_value < ($tensionRecord->spec_tension - $tolerance)
                || $measurement->avg_value > ($tensionRecord->spec_tension + $tolerance);
        }

        $measurement->save();

        // Update record progress
        $tensionRecord->recalculateProgress();

        return response()->json([
            'status' => 'success',
            'message' => 'Measurement updated successfully',
            'data' => $measurement,
        ]);
    }

    /**
     * Update a single weaving measurement
     */
    public function updateWeavingMeasurement(
        Request $request,
        TensionRecord $tensionRecord,
        string $side,
        string $row,
        int $column
    ): JsonResponse {
        if (!$tensionRecord->isWeaving()) {
            return response()->json([
                'status' => 'error',
                'message' => 'This record is not a weaving record',
            ], 400);
        }

        $validated = $request->validate([
            'max_value' => 'nullable|numeric|min:0',
            'min_value' => 'nullable|numeric|min:0',
        ]);

        // Validate position
        if (!in_array($side, array_keys(WeavingMeasurement::getCreelSides()))) {
            return response()->json([
                'status' => 'error',
                'message' => 'Invalid creel side',
            ], 400);
        }

        if (!in_array($row, array_keys(WeavingMeasurement::getRows()))) {
            return response()->json([
                'status' => 'error',
                'message' => 'Invalid row number',
            ], 400);
        }

        $measurement = $tensionRecord->weavingMeasurements()
            ->firstOrCreate(
                [
                    'creel_side' => $side,
                    'row_number' => $row,
                    'column_number' => $column,
                ],
                ['tension_record_id' => $tensionRecord->id]
            );

        // Update values
        if (array_key_exists('max_value', $validated)) {
            $measurement->max_value = $validated['max_value'];
        }
        if (array_key_exists('min_value', $validated)) {
            $measurement->min_value = $validated['min_value'];
        }

        // Update completion status and calculated fields
        $measurement->is_complete = $measurement->max_value !== null && $measurement->min_value !== null;
        $measurement->measured_at = now();

        // Calculate avg and range
        if ($measurement->is_complete) {
            $measurement->avg_value = ($measurement->max_value + $measurement->min_value) / 2;
            $measurement->range_value = $measurement->max_value - $measurement->min_value;
        } else {
            $measurement->avg_value = null;
            $measurement->range_value = null;
        }

        // Check if out of spec
        if ($measurement->is_complete && $tensionRecord->spec_tension !== null) {
            $tolerance = $tensionRecord->tension_tolerance ?? 0;
            $measurement->is_out_of_spec = $measurement->avg_value < ($tensionRecord->spec_tension - $tolerance)
                || $measurement->avg_value > ($tensionRecord->spec_tension + $tolerance);
        }

        $measurement->save();

        // Update record progress
        $tensionRecord->recalculateProgress();

        return response()->json([
            'status' => 'success',
            'message' => 'Measurement updated successfully',
            'data' => $measurement,
        ]);
    }

    /**
     * Get weaving measurements statistics by side
     */
    public function weavingStatsBySide(TensionRecord $tensionRecord): JsonResponse
    {
        if (!$tensionRecord->isWeaving()) {
            return response()->json([
                'status' => 'error',
                'message' => 'This record is not a weaving record',
            ], 400);
        }

        return response()->json([
            'status' => 'success',
            'data' => WeavingMeasurement::getStatsBySide($tensionRecord->id),
        ]);
    }

    /**
     * Get weaving measurements statistics by row
     */
    public function weavingStatsByRow(TensionRecord $tensionRecord): JsonResponse
    {
        if (!$tensionRecord->isWeaving()) {
            return response()->json([
                'status' => 'error',
                'message' => 'This record is not a weaving record',
            ], 400);
        }

        return response()->json([
            'status' => 'success',
            'data' => WeavingMeasurement::getStatsByRow($tensionRecord->id),
        ]);
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
     * Create measurements from legacy array format
     * Returns the count of measurements created
     */
    private function createMeasurementsFromArray(TensionRecord $record, array $measurementData): int
    {
        $specTension = $record->spec_tension;
        $tolerance = $record->tension_tolerance ?? 0;

        if ($record->isTwisting()) {
            return $this->createTwistingMeasurements($record, $measurementData, $specTension, $tolerance);
        } else {
            return $this->createWeavingMeasurements($record, $measurementData, $specTension, $tolerance);
        }
    }

    /**
     * Create twisting measurements from array
     */
    private function createTwistingMeasurements(
        TensionRecord $record,
        array $measurementData,
        ?float $specTension,
        float $tolerance
    ): int {
        $measurements = [];
        $now = now();

        foreach ($measurementData as $spindleNumber => $data) {
            if (!is_numeric($spindleNumber) || !is_array($data)) {
                Log::warning('Skipping invalid twisting measurement', [
                    'record_id' => $record->id,
                    'spindle_number' => $spindleNumber,
                    'data' => $data,
                ]);
                continue;
            }

            $maxValue = $data['max'] ?? null;
            $minValue = $data['min'] ?? null;
            $isComplete = $maxValue !== null && $minValue !== null;

            // Calculate avg and range
            $avgValue = null;
            $rangeValue = null;
            if ($isComplete) {
                $avgValue = ($maxValue + $minValue) / 2;
                $rangeValue = $maxValue - $minValue;
            }

            // Check if out of spec
            $isOutOfSpec = false;
            if ($isComplete && $specTension !== null) {
                $isOutOfSpec = $avgValue < ($specTension - $tolerance)
                    || $avgValue > ($specTension + $tolerance);
            }

            $measurements[] = [
                'tension_record_id' => $record->id,
                'spindle_number' => (int) $spindleNumber,
                'max_value' => $maxValue,
                'min_value' => $minValue,
                'avg_value' => $avgValue,
                'range_value' => $rangeValue,
                'is_complete' => $isComplete,
                'is_out_of_spec' => $isOutOfSpec,
                'measured_at' => $isComplete ? $now : null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if (!empty($measurements)) {
            TwistingMeasurement::insert($measurements);
        }

        return count($measurements);
    }

    /**
     * Create weaving measurements from array
     * FIXED VERSION with better error handling and logging
     */
    private function createWeavingMeasurements(
        TensionRecord $record,
        array $measurementData,
        ?float $specTension,
        float $tolerance
    ): int {
        $measurements = [];
        $now = now();
        $validSides = array_keys(WeavingMeasurement::getCreelSides());
        $validRows = array_keys(WeavingMeasurement::getRows());
        
        Log::info('Processing weaving measurements', [
            'record_id' => $record->id,
            'data_keys' => array_keys($measurementData),
            'valid_sides' => $validSides,
            'valid_rows' => $validRows,
        ]);

        foreach ($measurementData as $side => $rows) {
            // Normalize side format
            $normalizedSide = strtoupper($side);
            
            if (!in_array($normalizedSide, $validSides)) {
                Log::warning('Invalid creel side', [
                    'record_id' => $record->id,
                    'side' => $side,
                    'normalized' => $normalizedSide,
                    'valid_sides' => $validSides,
                ]);
                continue;
            }

            if (!is_array($rows)) {
                Log::warning('Rows is not an array', [
                    'record_id' => $record->id,
                    'side' => $normalizedSide,
                    'rows_type' => gettype($rows),
                ]);
                continue;
            }

            Log::info('Processing side', [
                'record_id' => $record->id,
                'side' => $normalizedSide,
                'row_keys' => array_keys($rows),
            ]);

            foreach ($rows as $row => $columns) {
                if (!is_array($columns)) {
                    Log::warning('Columns is not an array', [
                        'record_id' => $record->id,
                        'side' => $normalizedSide,
                        'row' => $row,
                        'columns_type' => gettype($columns),
                    ]);
                    continue;
                }

                // Normalize row format - handle A-E or numeric 1-5 formats
                $rowNumber = strtoupper($row);
                if (!in_array($rowNumber, $validRows)) {
                    // Try to convert numeric row (1-5) to letter format (A-E)
                    if (is_numeric($row) && $row >= 1 && $row <= 5) {
                        $rowNumber = chr(64 + (int)$row); // 1=>A, 2=>B, 3=>C, 4=>D, 5=>E
                    } else {
                        Log::warning('Invalid row format', [
                            'record_id' => $record->id,
                            'side' => $normalizedSide,
                            'row' => $row,
                            'valid_rows' => $validRows,
                        ]);
                        continue;
                    }
                }

                Log::info('Processing row', [
                    'record_id' => $record->id,
                    'side' => $normalizedSide,
                    'row' => $rowNumber,
                    'column_count' => count($columns),
                    'column_keys' => array_keys($columns),
                ]);

                foreach ($columns as $column => $data) {
                    if (!is_numeric($column)) {
                        Log::warning('Column is not numeric', [
                            'record_id' => $record->id,
                            'side' => $normalizedSide,
                            'row' => $rowNumber,
                            'column' => $column,
                        ]);
                        continue;
                    }

                    if (!is_array($data)) {
                        Log::warning('Measurement data is not an array', [
                            'record_id' => $record->id,
                            'side' => $normalizedSide,
                            'row' => $rowNumber,
                            'column' => $column,
                            'data_type' => gettype($data),
                        ]);
                        continue;
                    }

                    $maxValue = $data['max'] ?? null;
                    $minValue = $data['min'] ?? null;
                    $isComplete = $maxValue !== null && $minValue !== null;

                    // Calculate avg and range
                    $avgValue = null;
                    $rangeValue = null;
                    if ($isComplete) {
                        $avgValue = ($maxValue + $minValue) / 2;
                        $rangeValue = $maxValue - $minValue;
                    }

                    // Check if out of spec
                    $isOutOfSpec = false;
                    if ($isComplete && $specTension !== null) {
                        $isOutOfSpec = $avgValue < ($specTension - $tolerance)
                            || $avgValue > ($specTension + $tolerance);
                    }

                    $measurements[] = [
                        'tension_record_id' => $record->id,
                        'creel_side' => $normalizedSide,
                        'row_number' => $rowNumber,
                        'column_number' => (int) $column,
                        'max_value' => $maxValue,
                        'min_value' => $minValue,
                        'avg_value' => $avgValue,
                        'range_value' => $rangeValue,
                        'is_complete' => $isComplete,
                        'is_out_of_spec' => $isOutOfSpec,
                        'measured_at' => $isComplete ? $now : null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }
        }

        Log::info('Weaving measurements prepared', [
            'record_id' => $record->id,
            'total_measurements' => count($measurements),
        ]);

        // Insert in chunks to avoid memory issues
        $insertedCount = 0;
        foreach (array_chunk($measurements, 500) as $chunk) {
            WeavingMeasurement::insert($chunk);
            $insertedCount += count($chunk);
        }

        Log::info('Weaving measurements inserted', [
            'record_id' => $record->id,
            'inserted_count' => $insertedCount,
        ]);

        return $insertedCount;
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