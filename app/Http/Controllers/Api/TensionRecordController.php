<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\HandlesJsonColumns;
use App\Http\Controllers\Controller;
use App\Models\TensionRecord;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class TensionRecordController extends Controller
{
    use HandlesJsonColumns;

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

        // Sorting: only whitelisted columns, so sort_by never reaches SQL as-is.
        // Unknown or missing sort_by falls back to newest first.
        $sortable = [
            'recorded_at' => 'created_at',
            'machine' => $this->jsonExtract('metadata', '$.machine_number'),
            'item_number' => $this->jsonExtract('metadata', '$.item_number'),
            'yarn_code' => $this->jsonExtract('metadata', '$.yarn_code'),
            'operator' => $this->jsonExtract('metadata', '$.operator'),
        ];
        $sortBy = $request->input('sort_by');
        $sortDir = strtolower((string) $request->input('sort_dir')) === 'asc' ? 'asc' : 'desc';

        if (is_string($sortBy) && array_key_exists($sortBy, $sortable)) {
            $query->orderByRaw("{$sortable[$sortBy]} {$sortDir}");
            if ($sortBy !== 'recorded_at') {
                $query->orderBy('created_at', 'desc');
            }
        } else {
            $query->orderBy('created_at', 'desc');
        }

        // Paginate results
        $perPage = min((int) $request->get('per_page', 10), 200);
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
            'client_uuid' => 'nullable|uuid',
            'metadata' => 'required|array',
            'metadata.total_measurements' => 'required|integer|min:0',
            'metadata.completed_measurements' => 'required|integer|min:0',
            'metadata.progress_percentage' => 'required|integer|min:0|max:100',
            'metadata.operator' => 'nullable|string',
            'metadata.machine_number' => 'nullable|string',
            'metadata.item_number' => 'nullable|string',
            'metadata.item_description' => 'nullable|string',
            'metadata.yarn_code' => 'nullable|string',
            // Without this rule validated() drops the key and a finished record stays resumable.
            'metadata.status' => 'nullable|in:in_progress,completed',
        ]);

        // Add user_id if authenticated
        // A retried offline upload returns the record it already created.
        if (! empty($validated['client_uuid'])
            && $existing = TensionRecord::where('client_uuid', $validated['client_uuid'])->first()) {
            return response()->json([
                'status' => 'success',
                'message' => 'Tension record already saved',
                'data' => $existing,
            ]);
        }

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
     * Start a resumable weaving-tension session for a production order, or
     * return the existing in-progress session for it if one already exists.
     */
    public function startSession(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'form_data' => 'required|array',
            'form_data.productionOrder' => 'required|string',
        ]);

        $formData = $validated['form_data'];

        $statusExpr = $this->jsonExtract('metadata', '$.status');
        $existing = TensionRecord::byType('weaving')
            ->where('form_data->productionOrder', $formData['productionOrder'])
            ->where(function ($q) use ($statusExpr) {
                $q->where('metadata->status', 'in_progress')
                  ->orWhereRaw("{$statusExpr} IS NULL");
            })
            ->orderBy('created_at', 'desc')
            ->first();

        if ($existing) {
            return response()->json([
                'status' => 'success',
                'message' => 'Resuming existing session',
                'data' => $existing,
            ]);
        }

        $record = TensionRecord::create([
            'record_type' => 'weaving',
            'csv_data' => '',
            'form_data' => $formData,
            'measurement_data' => [],
            'problems' => [],
            'metadata' => [
                'status' => 'in_progress',
                'total_measurements' => 0,
                'completed_measurements' => 0,
                'progress_percentage' => 0,
                'operator' => $formData['operator'] ?? null,
                'machine_number' => $formData['machineNumber'] ?? null,
                'item_number' => $formData['itemNumber'] ?? null,
                'item_description' => $formData['itemDescription'] ?? null,
            ],
            'user_id' => auth()->id(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Session started',
            'data' => $record,
        ], 201);
    }

    /**
     * Fetch the in-progress weaving session for a production order, if any,
     * so measurement entry can resume where it left off.
     */
    public function getSession(string $productionOrder): JsonResponse
    {
        $statusExpr = $this->jsonExtract('metadata', '$.status');
        $record = TensionRecord::byType('weaving')
            ->where('form_data->productionOrder', $productionOrder)
            ->where(function ($q) use ($statusExpr) {
                $q->where('metadata->status', 'in_progress')
                  ->orWhereRaw("{$statusExpr} IS NULL");
            })
            ->orderBy('created_at', 'desc')
            ->first();

        if (! $record) {
            return response()->json([
                'status' => 'error',
                'message' => 'No in-progress session found for this production order',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $record,
        ]);
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
        $filename = preg_replace('/[^\w\-.]/', '-', $filename);
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
     * Key figures for the records page header, each with the comparison it is judged against.
     *
     * Query params:
     *   - type: 'twisting' | 'weaving' | 'all' (default 'all')
     *   - tz_offset: caller's offset from UTC in minutes, so "today" and day buckets are the caller's days
     *
     * Windows: "current" is the last 7 local days including today, "previous" the 7 days before it.
     * Every figure is computed from stored records; nothing here is estimated.
     */
    public function summary(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type'      => 'nullable|in:twisting,weaving,all',
            'tz_offset' => 'nullable|integer|min:-840|max:840',
        ]);
        $type = $validated['type'] ?? 'all';
        $offset = (int) ($validated['tz_offset'] ?? 0);

        $localNow = now()->utc()->addMinutes($offset);
        $todayLocal = $localNow->toDateString();
        $currentStart = $localNow->copy()->startOfDay()->subDays(6);   // 7 days incl. today
        $previousStart = $currentStart->copy()->subDays(7);
        $toLocal = fn ($ts) => \Illuminate\Support\Carbon::parse($ts)->utc()->addMinutes($offset);
        $toUtc = fn ($localTime) => $localTime->copy()->subMinutes($offset);

        $base = fn () => TensionRecord::query()->when($type !== 'all', fn ($q) => $q->byType($type));

        // Records created in the last 14 local days: counts, completion, daily series.
        $recent = $base()
            ->where('created_at', '>=', $toUtc($previousStart))
            ->get(['id', 'created_at', 'metadata', 'form_data', 'measurement_data']);

        $daily = [];
        for ($i = 0; $i < 7; $i++) {
            $daily[$currentStart->copy()->addDays($i)->toDateString()] = 0;
        }
        $currentCount = 0;
        $previousCount = 0;
        $currentCompletion = [];
        $previousCompletion = [];
        $spec = ['current' => [0, 0], 'previous' => [0, 0]]; // [positions measured, out of spec]
        $completionOf = function (array $meta): ?float {
            if (isset($meta['progress_percentage']) && is_numeric($meta['progress_percentage'])) {
                return (float) $meta['progress_percentage'];
            }
            $total = (int) ($meta['total_measurements'] ?? 0);

            return $total > 0 ? ((int) ($meta['completed_measurements'] ?? 0)) / $total * 100 : null;
        };

        foreach ($recent as $record) {
            $local = $toLocal($record->created_at);
            $completion = $completionOf($record->metadata ?? []);
            [$measured, $out] = $this->outOfSpec($record->form_data ?? [], $record->measurement_data ?? []);
            $window = $local->gte($currentStart) ? 'current' : 'previous';
            $spec[$window][0] += $measured;
            $spec[$window][1] += $out;

            if ($local->gte($currentStart)) {
                $currentCount++;
                $daily[$local->toDateString()] = ($daily[$local->toDateString()] ?? 0) + 1;
                if ($completion !== null) {
                    $currentCompletion[] = $completion;
                }
            } else {
                $previousCount++;
                if ($completion !== null) {
                    $previousCompletion[] = $completion;
                }
            }
        }

        // Problems: open now, new today, older than 24h, and resolution times.
        $problemsLengthExpr = $this->jsonArrayLength('problems');
        $withProblems = $base()->whereRaw("{$problemsLengthExpr} > 0")->get(['id', 'problems']);

        $open = 0;
        $newToday = 0;
        $olderThanDay = 0;
        $currentResolveHours = [];
        $previousResolveHours = [];
        $openDaily = array_fill_keys(array_keys($daily), 0);
        $dayAgoUtc = now()->utc()->subDay();

        foreach ($withProblems as $record) {
            foreach ($record->problems ?? [] as $problem) {
                $reported = ! empty($problem['timestamp']) ? \Illuminate\Support\Carbon::parse($problem['timestamp']) : null;
                if ($reported && isset($openDaily[$toLocal($reported)->toDateString()])) {
                    $openDaily[$toLocal($reported)->toDateString()]++;
                }
                if ($reported && $toLocal($reported)->toDateString() === $todayLocal) {
                    $newToday++;
                }

                if (($problem['status'] ?? 'open') !== 'resolved') {
                    $open++;
                    if ($reported && $reported->lt($dayAgoUtc)) {
                        $olderThanDay++;
                    }
                    continue;
                }

                $resolvedAt = $problem['resolution']['resolved_at'] ?? null;
                if (! $reported || ! $resolvedAt) {
                    continue;
                }
                $resolved = \Illuminate\Support\Carbon::parse($resolvedAt);
                $hours = max(0, $reported->diffInMinutes($resolved, false)) / 60;
                $resolvedLocal = $toLocal($resolved);
                if ($resolvedLocal->gte($currentStart)) {
                    $currentResolveHours[] = $hours;
                } elseif ($resolvedLocal->gte($previousStart)) {
                    $previousResolveHours[] = $hours;
                }
            }
        }

        // Machines: which machines recorded in the last 30 days were checked today, and which are overdue.
        $machineExpr = $this->jsonExtract('metadata', '$.machine_number');
        $lastChecks = $base()
            ->where('created_at', '>=', now()->utc()->subDays(30))
            ->whereRaw("{$machineExpr} IS NOT NULL")
            ->selectRaw("{$machineExpr} as machine, MAX(created_at) as last_checked")
            ->groupByRaw($machineExpr)
            ->get();
        $todayStartUtc = $toUtc($localNow->copy()->startOfDay());
        $overdueBeforeUtc = $todayStartUtc->copy()->subDays(2); // no check today or in the 2 days before
        $checkedToday = $lastChecks->filter(fn ($row) => \Illuminate\Support\Carbon::parse($row->last_checked)->gte($todayStartUtc))->count();
        $overdue = $lastChecks->filter(fn ($row) => \Illuminate\Support\Carbon::parse($row->last_checked)->lt($overdueBeforeUtc))->count();

        $avg = fn (array $xs) => $xs ? round(array_sum($xs) / count($xs), 1) : null;
        $median = function (array $xs): ?float {
            if (! $xs) {
                return null;
            }
            sort($xs);
            $mid = intdiv(count($xs), 2);

            return round(count($xs) % 2 ? $xs[$mid] : ($xs[$mid - 1] + $xs[$mid]) / 2, 1);
        };

        return response()->json([
            'status' => 'success',
            'data' => [
                'type' => $type,
                'today' => $todayLocal,
                'records' => [
                    'current' => $currentCount,
                    'previous' => $previousCount,
                    'daily' => array_values($daily),
                ],
                'open_problems' => [
                    'open' => $open,
                    'new_today' => $newToday,
                    'older_than_24h' => $olderThanDay,
                    'reported_daily' => array_values($openDaily),
                ],
                'resolve_hours' => [
                    'current_median' => $median($currentResolveHours),
                    'previous_median' => $median($previousResolveHours),
                    'resolved_current' => count($currentResolveHours),
                ],
                'out_of_spec' => [
                    'current_pct' => $spec['current'][0] ? round($spec['current'][1] / $spec['current'][0] * 100, 2) : null,
                    'previous_pct' => $spec['previous'][0] ? round($spec['previous'][1] / $spec['previous'][0] * 100, 2) : null,
                    'current_positions' => $spec['current'][0],
                    'current_out' => $spec['current'][1],
                ],
                'completion' => [
                    'current_avg' => $avg($currentCompletion),
                    'previous_avg' => $avg($previousCompletion),
                ],
                'machines' => [
                    'checked_today' => $checkedToday,
                    'active_30d' => $lastChecks->count(),
                    'overdue' => $overdue,
                ],
            ],
        ]);
    }

    /**
     * Positions with a reading, and how many of them are out of spec, on one record.
     * Out of spec: max above target + tolerance, or min below target − tolerance.
     * Mirrors classify() in resources/js/lib/tension-heatmap.ts. Records without a
     * usable spec count their positions as measured and none as out of spec.
     *
     * @return array{0: int, 1: int}
     */
    private function outOfSpec(array $form, array $measurements): array
    {
        $target = is_numeric($form['specTens'] ?? null) ? (float) $form['specTens'] : null;
        $tolerance = is_numeric($form['tensPlus'] ?? null) ? (float) $form['tensPlus'] : null;
        $hasSpec = $target !== null && $tolerance !== null && $tolerance > 0;

        $measured = 0;
        $out = 0;
        $check = function ($reading) use (&$measured, &$out, $hasSpec, $target, $tolerance) {
            if (! is_array($reading)) {
                return;
            }
            $max = is_numeric($reading['max'] ?? null) ? (float) $reading['max'] : null;
            $min = is_numeric($reading['min'] ?? null) ? (float) $reading['min'] : null;
            if ($max === null && $min === null) {
                return;
            }
            $measured++;
            if ($hasSpec && (($max !== null && $max > $target + $tolerance) || ($min !== null && $min < $target - $tolerance))) {
                $out++;
            }
        };

        foreach ($measurements as $value) {
            if (! is_array($value)) {
                continue;
            }
            // Twisting: spindle => {max, min}. Weaving: side => row => col => {max, min}.
            if (array_key_exists('max', $value) || array_key_exists('min', $value)) {
                $check($value);
                continue;
            }
            foreach ($value as $row) {
                foreach (is_array($row) ? $row : [] as $reading) {
                    $check($reading);
                }
            }
        }

        return [$measured, $out];
    }

    /**
     * Daily counts for the mobile trend charts: problems reported and measurements recorded per calendar day.
     *
     * Query params:
     *   - type: 'twisting' | 'weaving' (required)
     *   - days: window length ending today, 1-31 (default 14)
     *   - tz_offset: caller's offset from UTC in minutes (e.g. 420 for UTC+7), so days are the caller's calendar days
     *
     * Problems are counted on the day in each problem's own timestamp. Measurements are the record's
     * completed_measurements, counted on the day the record was created (a weaving session that spans
     * several days therefore counts on its first day).
     */
    public function trends(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type'      => 'required|in:twisting,weaving',
            'days'      => 'nullable|integer|min:1|max:31',
            'tz_offset' => 'nullable|integer|min:-840|max:840',
        ]);
        $days = (int) ($validated['days'] ?? 14);
        $offset = (int) ($validated['tz_offset'] ?? 0);

        $toLocalDate = fn ($timestamp) => \Illuminate\Support\Carbon::parse($timestamp)->utc()->addMinutes($offset)->toDateString();

        $startLocal = now()->utc()->addMinutes($offset)->startOfDay()->subDays($days - 1);
        $startUtc = $startLocal->copy()->subMinutes($offset);

        $buckets = [];
        for ($i = 0; $i < $days; $i++) {
            $date = $startLocal->copy()->addDays($i)->toDateString();
            $buckets[$date] = ['date' => $date, 'problems' => 0, 'measurements' => 0];
        }

        TensionRecord::byType($validated['type'])
            ->where(fn ($q) => $q->where('created_at', '>=', $startUtc)->orWhere('updated_at', '>=', $startUtc))
            ->get(['id', 'created_at', 'updated_at', 'problems', 'metadata'])
            ->each(function (TensionRecord $record) use (&$buckets, $toLocalDate) {
                $createdOn = $toLocalDate($record->created_at);
                if (isset($buckets[$createdOn])) {
                    $buckets[$createdOn]['measurements'] += (int) ($record->metadata['completed_measurements'] ?? 0);
                }
                foreach ($record->problems ?? [] as $problem) {
                    if (empty($problem['timestamp'])) {
                        continue;
                    }
                    $reportedOn = $toLocalDate($problem['timestamp']);
                    if (isset($buckets[$reportedOn])) {
                        $buckets[$reportedOn]['problems']++;
                    }
                }
            });

        $rows = array_values($buckets);

        return response()->json([
            'status' => 'success',
            'data' => [
                'type' => $validated['type'],
                'days' => $rows,
                'totals' => [
                    'problems' => array_sum(array_column($rows, 'problems')),
                    'measurements' => array_sum(array_column($rows, 'measurements')),
                ],
            ],
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

        // Whitelisted sort ids on the flattened list; newest record first otherwise.
        $sortable = [
            'recorded_at' => fn ($p) => $p['record_created_at'] ?? '',
            'type'        => fn ($p) => $p['record_type'] ?? '',
            'machine'     => fn ($p) => (string) ($p['machine_number'] ?? ''),
            'position'    => fn ($p) => $p['spindle_number'] !== null ? sprintf('%06d', (int) $p['spindle_number']) : (string) ($p['position'] ?? ''),
            'item_number' => fn ($p) => (string) ($p['item_number'] ?? ''),
            'operator'    => fn ($p) => strtolower((string) ($p['operator'] ?? '')),
            'status'      => fn ($p) => $p['status'] ?? 'open',
        ];
        $sortBy = $request->input('sort_by');
        $valid = is_string($sortBy) && isset($sortable[$sortBy]);
        $key = $valid ? $sortable[$sortBy] : $sortable['recorded_at'];
        $descending = ! $valid || strtolower((string) $request->input('sort_dir')) !== 'asc';
        $flattened = $flattened->sortBy($key, SORT_NATURAL, $descending)->values();

        // Manual pagination
        $perPage = min((int) $request->input('per_page', 10), 200);
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
