<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MachineDefinition;
use App\Models\RuntimeRecord;
use App\Models\RuntimeShiftAggregate;
use App\Models\RuntimeUploadBatch;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;

class RuntimeRecordController extends Controller
{
    public function index(Request $request)
    {
        $query = RuntimeRecord::query()->select([
            'id', 'upload_batch_id', 'machine_id', 'machine_number', 'side',
            'year', 'month', 'date', 'shift', 'style_description',
            'yarn_type', 'dtex', 'tpm', 'yarn_code', 'machine_code', 'counter_length',
            'runtime_hours', 'actual_runtime_hours', 'rpm',
            'machine_definition_id', 'created_at',
        ]);

        if ($v = $request->input('machine'))    $query->where('machine_number', 'like', "%{$v}%");
        if ($v = $request->input('side'))       $query->where('side', strtoupper($v));
        if ($v = $request->input('shift'))      $query->where('shift', $v);
        if ($v = $request->input('month'))      $query->where('month', $v);
        if ($v = $request->input('year'))       $query->where('year', $v);
        if ($v = $request->input('date_from'))  $query->whereDate('date', '>=', $v);
        if ($v = $request->input('date_to'))    $query->whereDate('date', '<=', $v);

        return response()->json($query->orderBy('date')->orderBy('machine_id')->paginate(50));
    }

    public function aggregates(Request $request)
    {
        $query = RuntimeShiftAggregate::query()->select([
            'id', 'upload_batch_id', 'machine_number', 'year', 'month', 'date', 'shift',
            'total_runtime_hours', 'actual_machine_runtime', 'avg_rpm', 'styles', 'styles_parsed',
            'has_multi_style', 'has_speed_outlier', 'has_runtime_outlier',
            'machine_definition_id', 'created_at',
        ]);

        if ($v = $request->input('machine'))         $query->where('machine_number', 'like', "%{$v}%");
        if ($v = $request->input('shift'))           $query->where('shift', $v);
        if ($v = $request->input('month'))           $query->where('month', $v);
        if ($v = $request->input('year'))            $query->where('year', $v);
        if ($v = $request->input('date_from'))       $query->whereDate('date', '>=', $v);
        if ($v = $request->input('date_to'))         $query->whereDate('date', '<=', $v);
        if ($request->boolean('multi_style'))        $query->where('has_multi_style', true);
        if ($request->boolean('speed_outlier'))      $query->where('has_speed_outlier', true);
        if ($request->boolean('runtime_outlier'))    $query->where('has_runtime_outlier', true);

        return response()->json($query->orderBy('date')->orderBy('machine_number')->paginate(50));
    }

    public function batches(Request $request)
    {
        return response()->json(
            RuntimeUploadBatch::with('user:id,name')
                ->orderBy('created_at', 'desc')
                ->paginate(20)
        );
    }

    public function destroyBatch(string $id)
    {
        RuntimeUploadBatch::findOrFail($id)->delete();

        return response()->json(['message' => 'Batch deleted.']);
    }

    public function store(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:20480',
        ]);

        $file   = $request->file('file');
        $reader = IOFactory::createReaderForFile($file->path());
        $reader->setReadDataOnly(true);
        $rows = $reader->load($file->path())->getActiveSheet()->toArray(null, true, true, true);

        // Pre-load all machine definitions keyed by machine_number for O(1) lookup
        $machineDefinitions = MachineDefinition::with('machineType:id,total_spindles,rpm_min,rpm_max,min_runtime_hours,max_runtime_hours')
            ->get()
            ->keyBy('machine_number');

        $records    = [];
        $skipped    = 0;
        $batchYear  = null;
        $batchMonth = null;
        $undefined  = [];

        foreach (array_slice($rows, 1) as $row) {
            $rawId = trim((string) ($row['A'] ?? ''));

            if ($rawId === '' || str_starts_with($rawId, '> ')) {
                $skipped++;
                continue;
            }

            // Split machine_id into machine_number + side (e.g. "2401L" → "2401", "L")
            $machineNumber = $rawId;
            $side          = null;
            if (preg_match('/^(.+?)([LR])$/i', $rawId, $m)) {
                $machineNumber = $m[1];
                $side          = strtoupper($m[2]);
            }

            // Excel serial date (epoch: 1899-12-30 accounts for Excel's 1900 leap year bug)
            $serial = (int) ($row['C'] ?? 0);
            $date   = Carbon::create(1899, 12, 30)->addDays($serial);
            $month  = (int) ($row['B'] ?? $date->month);
            $year   = $date->year;

            $batchYear  ??= $year;
            $batchMonth ??= $month;

            $def           = $machineDefinitions->get($machineNumber);
            $totalSpindles = $def?->machineType?->total_spindles;
            $runtimeHours  = round(self::excelTimeToHours($row['F'] ?? 0), 3);
            $actualRuntime = $totalSpindles ? round($runtimeHours / $totalSpindles, 5) : null;
            $styleStr      = (string) ($row['E'] ?? '');
            $styleParsed   = self::parseStyle($styleStr);

            if (!$def) {
                $undefined[$machineNumber] = true;
            }

            $records[] = [
                'machine_id'            => $rawId,
                'machine_number'        => $machineNumber,
                'side'                  => $side,
                'year'                  => $year,
                'month'                 => $month,
                'date'                  => $date->toDateString(),
                'shift'                 => (int) ($row['D'] ?? 0),
                'style_description'     => $styleStr,
                'yarn_type'             => $styleParsed['yarn_type'],
                'dtex'                  => $styleParsed['dtex'],
                'tpm'                   => $styleParsed['tpm'],
                'yarn_code'             => $styleParsed['yarn_code'],
                'machine_code'          => $styleParsed['machine_code'],
                'counter_length'        => $styleParsed['counter_length'],
                'runtime_hours'         => $runtimeHours,
                'actual_runtime_hours'  => $actualRuntime,
                'rpm'                   => (int) ($row['G'] ?? 0),
                'machine_definition_id' => $def?->id,
                'user_id'               => $request->user()?->id,
                'created_at'            => now(),
                'updated_at'            => now(),
            ];
        }

        if (empty($records)) {
            return response()->json(['message' => 'No valid data rows found.'], 422);
        }

        $batch = RuntimeUploadBatch::create([
            'file_name'     => $file->getClientOriginalName(),
            'year'          => $batchYear,
            'month'         => $batchMonth,
            'row_count'     => count($records),
            'skipped_count' => $skipped,
            'user_id'       => $request->user()?->id,
        ]);

        // Insert raw records in chunks; insertOrIgnore handles re-upload deduplication
        foreach (array_chunk($records, 500) as $chunk) {
            foreach ($chunk as &$r) {
                $r['upload_batch_id'] = $batch->id;
            }
            DB::table('runtime_records')->insertOrIgnore($chunk);
        }

        // Build shift aggregates from this import's data
        $this->buildShiftAggregates($batch->id, $records, $machineDefinitions);

        return response()->json([
            'batch'     => $batch,
            'imported'  => count($records),
            'skipped'   => $skipped,
            'undefined_machines' => array_keys($undefined),
        ], 201);
    }

    // Parses "NY 1400 365*365 YR021000022 B92,15080" into its components.
    // tpm: takes only the first value from "X*Y" (both sides are the same spec).
    private static function parseStyle(string $style): array
    {
        $parsed = [
            'yarn_type'      => null,
            'dtex'           => null,
            'tpm'            => null,
            'yarn_code'      => null,
            'machine_code'   => null,
            'counter_length' => null,
        ];

        if (!preg_match(
            '/^(\S+)\s+(\d+)\s+(\d+)\*\d+\s+(YR\S+)\s+(\w+),(\d+)/i',
            trim($style),
            $m,
        )) {
            return $parsed;
        }

        $parsed['yarn_type']      = strtoupper($m[1]);
        $parsed['dtex']           = (int) $m[2];
        $parsed['tpm']            = (int) $m[3];
        $parsed['yarn_code']      = strtoupper($m[4]);
        $parsed['machine_code']   = strtoupper($m[5]);
        $parsed['counter_length'] = (int) $m[6];

        return $parsed;
    }

    // Excel stores HH:MM:SS time cells as a fraction of a day (e.g. 21:44:13 → 0.9057).
    // With readDataOnly the format string is unavailable, so the raw float comes through.
    // If the value arrives as a string (some XLSX readers preserve the display format),
    // parse H:M:S directly. Otherwise multiply the day fraction by 24 to get hours.
    private static function excelTimeToHours(mixed $value): float
    {
        if (is_string($value) && str_contains($value, ':')) {
            $parts = explode(':', trim($value));
            return (int) ($parts[0] ?? 0)
                + (int) ($parts[1] ?? 0) / 60
                + (int) ($parts[2] ?? 0) / 3600;
        }
        // Raw Excel day fraction → hours
        return (float) $value * 24;
    }

    // Re-derives machine_definition_id + actual spindle hours for every existing record/aggregate
    // against the current machine definitions. Needed because a machine can be defined in
    // Machine Maintenance *after* its runtime data was already imported.
    public function recalculate()
    {
        return $this->recalculateForQuery(RuntimeRecord::query(), RuntimeShiftAggregate::query());
    }

    public function recalculateBatch(string $id)
    {
        RuntimeUploadBatch::findOrFail($id);

        return $this->recalculateForQuery(
            RuntimeRecord::query()->where('upload_batch_id', $id),
            RuntimeShiftAggregate::query()->where('upload_batch_id', $id),
        );
    }

    private function recalculateForQuery($recordQuery, $aggregateQuery)
    {
        $machineDefinitions = MachineDefinition::with('machineType:id,total_spindles,rpm_min,rpm_max,min_runtime_hours,max_runtime_hours')
            ->get()
            ->keyBy('machine_number');

        $updatedRecords = 0;
        $rowsByShift    = [];

        $recordQuery->chunkById(500, function ($records) use ($machineDefinitions, &$updatedRecords, &$rowsByShift) {
            foreach ($records as $record) {
                $def           = $machineDefinitions->get($record->machine_number);
                $totalSpindles = $def?->machineType?->total_spindles;

                $record->machine_definition_id = $def?->id;
                $record->actual_runtime_hours  = $totalSpindles ? round($record->runtime_hours / $totalSpindles, 5) : null;
                $record->save();
                $updatedRecords++;

                $key = "{$record->machine_number}|{$record->date->toDateString()}|{$record->shift}";
                $rowsByShift[$key][] = ['rpm' => $record->rpm, 'actual_runtime_hours' => $record->actual_runtime_hours];
            }
        });

        $updatedAggregates = 0;

        $aggregateQuery->chunkById(500, function ($aggregates) use ($machineDefinitions, $rowsByShift, &$updatedAggregates) {
            foreach ($aggregates as $agg) {
                $def           = $machineDefinitions->get($agg->machine_number);
                $type          = $def?->machineType;
                $totalSpindles = $type?->total_spindles;
                $rows          = $rowsByShift["{$agg->machine_number}|{$agg->date->toDateString()}|{$agg->shift}"] ?? [];

                $agg->machine_definition_id  = $def?->id;
                $agg->actual_machine_runtime = $totalSpindles ? round($agg->total_runtime_hours / $totalSpindles, 5) : null;
                $agg->has_speed_outlier      = collect($rows)->contains(fn ($r) =>
                    ($type?->rpm_min !== null && $r['rpm'] < $type->rpm_min) ||
                    ($type?->rpm_max !== null && $r['rpm'] > $type->rpm_max)
                );
                $agg->has_runtime_outlier    = collect($rows)->contains(fn ($r) =>
                    $r['actual_runtime_hours'] !== null && (
                        ($type?->min_runtime_hours !== null && $r['actual_runtime_hours'] < $type->min_runtime_hours) ||
                        ($type?->max_runtime_hours !== null && $r['actual_runtime_hours'] > $type->max_runtime_hours)
                    )
                );
                $agg->save();
                $updatedAggregates++;
            }
        });

        return response()->json([
            'updated_records'    => $updatedRecords,
            'updated_aggregates' => $updatedAggregates,
        ]);
    }

    private function buildShiftAggregates(int $batchId, array $records, $machineDefinitions): void
    {
        // Group by (machine_number, date, shift)
        $groups = [];
        foreach ($records as $r) {
            $key = "{$r['machine_number']}|{$r['date']}|{$r['shift']}";
            $groups[$key][] = $r;
        }

        $aggregates = [];
        foreach ($groups as $rows) {
            $first         = $rows[0];
            $machineNumber = $first['machine_number'];
            $def           = $machineDefinitions->get($machineNumber);
            $totalSpindles = $def?->machineType?->total_spindles;
            $rpmMin        = $def?->machineType?->rpm_min;
            $rpmMax        = $def?->machineType?->rpm_max;
            $minRuntime    = $def?->machineType?->min_runtime_hours;
            $maxRuntime    = $def?->machineType?->max_runtime_hours;

            $totalRuntime  = array_sum(array_column($rows, 'runtime_hours'));
            $avgRpm        = array_sum(array_column($rows, 'rpm')) / count($rows);
            $styles        = array_values(array_unique(array_filter(array_column($rows, 'style_description'))));
            $actualRuntime = $totalSpindles ? round($totalRuntime / $totalSpindles, 5) : null;

            // Parse each unique style string; deduplicate by yarn_code so identical specs aren't repeated
            $stylesParsed = array_values(array_unique(
                array_filter(array_map(fn($s) => self::parseStyle($s), $styles), fn($p) => $p['yarn_type'] !== null),
                SORT_REGULAR,
            ));

            $hasSpeedOutlier   = false;
            $hasRuntimeOutlier = false;

            foreach ($rows as $r) {
                if ($rpmMin !== null && $r['rpm'] < $rpmMin) $hasSpeedOutlier = true;
                if ($rpmMax !== null && $r['rpm'] > $rpmMax) $hasSpeedOutlier = true;
                if ($r['actual_runtime_hours'] !== null) {
                    if ($minRuntime !== null && $r['actual_runtime_hours'] < $minRuntime) $hasRuntimeOutlier = true;
                    if ($maxRuntime !== null && $r['actual_runtime_hours'] > $maxRuntime) $hasRuntimeOutlier = true;
                }
            }

            $aggregates[] = [
                'upload_batch_id'       => $batchId,
                'machine_number'        => $machineNumber,
                'year'                  => $first['year'],
                'month'                 => $first['month'],
                'date'                  => $first['date'],
                'shift'                 => $first['shift'],
                'total_runtime_hours'   => round($totalRuntime, 3),
                'actual_machine_runtime'=> $actualRuntime,
                'avg_rpm'               => round($avgRpm, 2),
                'styles'                => json_encode($styles),
                'styles_parsed'         => json_encode($stylesParsed),
                'has_multi_style'       => count($styles) > 1,
                'has_speed_outlier'     => $hasSpeedOutlier,
                'has_runtime_outlier'   => $hasRuntimeOutlier,
                'machine_definition_id' => $def?->id,
                'created_at'            => now(),
                'updated_at'            => now(),
            ];
        }

        foreach (array_chunk($aggregates, 500) as $chunk) {
            DB::table('runtime_shift_aggregates')->insertOrIgnore($chunk);
        }
    }
}
