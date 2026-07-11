<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EnergyRecord;
use App\Models\EnergyUploadBatch;
use App\Models\RuntimeShiftAggregate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;

class EnergyRecordController extends Controller
{
    // Daily energy records — mirrors runtime_shift_aggregates granularity (machine, date, shift).
    // Only returns rows where energy_kwh has been distributed from an uploaded energy file.
    public function index(Request $request)
    {
        $query = DB::table('runtime_shift_aggregates')
            ->select(['id', 'machine_number', 'year', 'month', 'date', 'shift',
                      'total_runtime_hours', 'actual_machine_runtime', 'avg_rpm', 'energy_kwh'])
            ->whereNotNull('energy_kwh');

        if ($v = $request->input('machine'))    $query->where('machine_number', 'like', "%{$v}%");
        if ($v = $request->input('year'))       $query->where('year', $v);
        if ($v = $request->input('month'))      $query->where('month', $v);
        if ($v = $request->input('shift'))      $query->where('shift', $v);
        if ($v = $request->input('date_from'))  $query->whereDate('date', '>=', $v);
        if ($v = $request->input('date_to'))    $query->whereDate('date', '<=', $v);

        return response()->json($query->orderByDesc('date')->orderBy('machine_number')->orderBy('shift')->paginate(50));
    }

    public function batches(Request $request)
    {
        return response()->json(
            EnergyUploadBatch::with('user:id,name')
                ->orderBy('created_at', 'desc')
                ->paginate(20)
        );
    }

    public function destroyBatch(string $id)
    {
        $batch = EnergyUploadBatch::findOrFail($id);

        // Clear distributed energy from shift aggregates before deleting
        $monthlyRecords = EnergyRecord::where('upload_batch_id', $id)->get();
        foreach ($monthlyRecords as $rec) {
            DB::table('runtime_shift_aggregates')
                ->where('machine_number', $rec->machine_number)
                ->where('year', $rec->year)
                ->where('month', $rec->month)
                ->where('shift', $rec->shift)
                ->update(['energy_kwh' => null]);
        }

        $batch->delete();

        return response()->json(['message' => 'Batch deleted.']);
    }

    // Re-distribute energy from all energy_records into runtime_shift_aggregates.
    // Useful when runtime data is added after energy data was already imported.
    public function recalculateEnergy()
    {
        $updated = 0;
        EnergyRecord::chunkById(200, function ($records) use (&$updated) {
            foreach ($records as $rec) {
                $updated += $this->distributeEnergy(
                    $rec->machine_number, $rec->year, $rec->month, $rec->shift, (float) $rec->energy_kwh
                );
            }
        });

        return response()->json(['updated_rows' => $updated]);
    }

    // Daily shift summary: same granularity as runtime_shift_aggregates with energy_kwh appended.
    public function shiftSummary(Request $request)
    {
        $query = RuntimeShiftAggregate::query()->select([
            'id', 'machine_number', 'year', 'month', 'date', 'shift',
            'total_runtime_hours', 'actual_machine_runtime', 'avg_rpm',
            'styles', 'styles_parsed', 'has_multi_style', 'has_speed_outlier', 'has_runtime_outlier',
            'energy_kwh',
        ]);

        if ($v = $request->input('machine'))         $query->where('machine_number', 'like', "%{$v}%");
        if ($v = $request->input('shift'))           $query->where('shift', $v);
        if ($v = $request->input('month'))           $query->where('month', $v);
        if ($v = $request->input('year'))            $query->where('year', $v);
        if ($v = $request->input('date_from'))       $query->whereDate('date', '>=', $v);
        if ($v = $request->input('date_to'))         $query->whereDate('date', '<=', $v);
        if ($request->boolean('missing_energy'))     $query->whereNull('energy_kwh');
        if ($request->boolean('multi_style'))        $query->where('has_multi_style', true);
        if ($request->boolean('speed_outlier'))      $query->where('has_speed_outlier', true);
        if ($request->boolean('runtime_outlier'))    $query->where('has_runtime_outlier', true);

        return response()->json($query->orderBy('date')->orderBy('machine_number')->paginate(50));
    }

    // Energy consumption grouped by (yarn_type, dtex, tpm, speed_bucket).
    // Only single-style shifts are included for unambiguous material attribution.
    public function materialEnergy(Request $request)
    {
        $where  = ['energy_kwh IS NOT NULL', 'JSON_LENGTH(styles_parsed) = 1',
                   "JSON_UNQUOTE(JSON_EXTRACT(styles_parsed, '$[0].yarn_type')) IS NOT NULL",
                   'has_speed_outlier = 0', 'has_runtime_outlier = 0'];
        $params = [];

        if ($v = $request->input('yarn_type')) {
            $where[]  = "JSON_UNQUOTE(JSON_EXTRACT(styles_parsed, '$[0].yarn_type')) LIKE ?";
            $params[] = "%{$v}%";
        }
        if ($v = $request->input('dtex')) {
            $where[]  = "JSON_UNQUOTE(JSON_EXTRACT(styles_parsed, '$[0].dtex')) = ?";
            $params[] = $v;
        }
        if ($v = $request->input('tpm')) {
            $where[]  = "JSON_UNQUOTE(JSON_EXTRACT(styles_parsed, '$[0].tpm')) = ?";
            $params[] = $v;
        }
        if ($v = $request->input('speed_bucket')) {
            $where[]  = 'ROUND(avg_rpm / 500) * 500 = ?';
            $params[] = $v;
        }

        $sql = "
            SELECT
                JSON_UNQUOTE(JSON_EXTRACT(styles_parsed, '\$[0].yarn_type')) AS yarn_type,
                CAST(JSON_UNQUOTE(JSON_EXTRACT(styles_parsed, '\$[0].dtex')) AS UNSIGNED) AS dtex,
                CAST(JSON_UNQUOTE(JSON_EXTRACT(styles_parsed, '\$[0].tpm'))  AS UNSIGNED) AS tpm,
                ROUND(avg_rpm / 500) * 500                                   AS speed_bucket,
                COUNT(*)                                                      AS record_count,
                SUM(total_runtime_hours)                                      AS total_runtime_hours,
                SUM(actual_machine_runtime)                                   AS total_spindle_hours,
                SUM(energy_kwh)                                               AS total_energy_kwh,
                SUM(energy_kwh) / NULLIF(SUM(total_runtime_hours), 0)        AS energy_per_machine_hour,
                SUM(energy_kwh) / NULLIF(SUM(actual_machine_runtime), 0)     AS energy_per_spindle_hour
            FROM runtime_shift_aggregates
            WHERE " . implode(' AND ', $where) . "
            GROUP BY yarn_type, dtex, tpm, speed_bucket
            ORDER BY yarn_type, dtex, tpm, speed_bucket
        ";

        return response()->json(DB::select($sql, $params));
    }

    public function store(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:20480',
        ]);

        $file        = $request->file('file');
        $reader      = IOFactory::createReaderForFile($file->path());
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($file->path());

        if ($spreadsheet->getSheetCount() < 2) {
            return response()->json(['message' => 'File must have two sheets (metadata + per-machine data).'], 422);
        }

        $sheet1Rows = $spreadsheet->getSheet(0)->toArray(null, true, true, true);
        $sheet2Rows = $spreadsheet->getSheet(1)->toArray(null, true, true, true);

        [$year, $month] = $this->parseDateRow($sheet1Rows[5] ?? []);

        $records      = [];
        $machinesSeen = [];

        // Sheet2 is 1-indexed (keys 1-N); position 8 = key 9 = first machine row
        foreach (array_slice($sheet2Rows, 8, 36) as $row) {
            $source = trim((string) ($row['B'] ?? ''));

            if ($source === '' || stripos($source, 'Total') === 0) {
                continue;
            }

            // Strip "TCF2." prefix → machine_number (e.g. "TCF2.2401" → "2401")
            $machineNumber = preg_replace('/^[A-Z]+\d+\./i', '', $source) ?: $source;
            $machinesSeen[$machineNumber] = true;

            $shiftValues = [
                1 => (float) ($row['G'] ?? 0),
                2 => (float) ($row['E'] ?? 0),
                3 => (float) ($row['C'] ?? 0),
            ];

            foreach ($shiftValues as $shift => $kwh) {
                $records[] = [
                    'machine_number' => $machineNumber,
                    'year'           => $year,
                    'month'          => $month,
                    'shift'          => $shift,
                    'energy_kwh'     => round($kwh, 3),
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ];
            }
        }

        if (empty($records)) {
            return response()->json(['message' => 'No valid machine data rows found in Sheet2.'], 422);
        }

        $batch = EnergyUploadBatch::create([
            'file_name'     => $file->getClientOriginalName(),
            'year'          => $year,
            'month'         => $month,
            'machine_count' => count($machinesSeen),
            'user_id'       => $request->user()?->id,
        ]);

        foreach ($records as &$r) {
            $r['upload_batch_id'] = $batch->id;
        }

        // Store monthly totals as source of truth
        DB::table('energy_records')->insertOrIgnore($records);

        // Distribute monthly kWh evenly across daily shift-aggregate rows
        $distributedRows = 0;
        foreach ($records as $rec) {
            $distributedRows += $this->distributeEnergy(
                $rec['machine_number'], $year, $month, $rec['shift'], $rec['energy_kwh']
            );
        }

        return response()->json([
            'batch'           => $batch,
            'imported'        => count($machinesSeen),
            'distributed_rows' => $distributedRows,
        ], 201);
    }

    // Distributes monthly_kwh evenly across all daily rows in runtime_shift_aggregates
    // for the given machine/year/month/shift. Returns count of updated rows.
    private function distributeEnergy(string $machineNumber, int $year, int $month, int $shift, float $monthlyKwh): int
    {
        $dailyRows = DB::table('runtime_shift_aggregates')
            ->where('machine_number', $machineNumber)
            ->where('year', $year)
            ->where('month', $month)
            ->where('shift', $shift)
            ->pluck('id');

        if ($dailyRows->isEmpty()) {
            return 0;
        }

        // Equal distribution per day
        $dailyKwh = round($monthlyKwh / $dailyRows->count(), 3);

        DB::table('runtime_shift_aggregates')
            ->whereIn('id', $dailyRows)
            ->update(['energy_kwh' => $dailyKwh]);

        return $dailyRows->count();
    }

    // Extract year and month from the date-range string in Sheet1 row 6 (array key 5).
    // Example cell value: "6/1/2026 12:00:00 AM - 6/30/2026 ..."
    private function parseDateRow(array $row): array
    {
        foreach ($row as $cell) {
            $str = (string) $cell;
            if (preg_match('#^(\d{1,2})/(\d{1,2})/(\d{4})#', $str, $m)) {
                return [(int) $m[3], (int) $m[1]];
            }
        }

        $now = now();
        return [$now->year, $now->month];
    }
}
