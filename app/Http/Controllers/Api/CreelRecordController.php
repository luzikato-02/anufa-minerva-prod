<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CreelRecord;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\IOFactory;

class CreelRecordController extends Controller
{
    public function index(Request $request)
    {
        $query = CreelRecord::query()->select([
            'id', 'order_number', 'machine', 'date_string',
            'operator', 'material', 'metadata', 'created_at',
        ]);

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                    ->orWhere('machine', 'like', "%{$search}%")
                    ->orWhere('operator', 'like', "%{$search}%");
            });
        }

        $records = $query->orderBy('created_at', 'desc')->paginate(15);

        return response()->json($records);
    }

    public function store(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        $file        = $request->file('file');
        $reader      = IOFactory::createReaderForFile($file->path());
        $spreadsheet = $reader->load($file->path());
        $rows        = $spreadsheet->getActiveSheet()->toArray(null, true, true, true);

        if (count($rows) < 2) {
            return response()->json(['message' => 'File contains no data rows.'], 422);
        }

        $rawBatches  = [];
        $totalWeight = 0.0;
        $firstRow    = null;

        foreach (array_slice($rows, 1) as $row) {
            if (empty($row['G'])) {
                continue;
            }

            if ($firstRow === null) {
                $firstRow = $row;
            }

            $netWeight = (float) ($row['B'] ?? 0);

            $rawBatches[] = [
                'batch'      => (string) ($row['G'] ?? ''),
                'net_weight' => $netWeight,
                'creel_side' => (string) ($row['C'] ?? ''),
                'creel_from' => (string) ($row['D'] ?? ''),
                'creel_to'   => (string) ($row['E'] ?? ''),
                'count'      => (int)    ($row['F'] ?? 0),
                'material'   => $row['H'] ?? null,
                'shift_load' => (string) ($row['L'] ?? ''),
                'user_name'  => $row['M'] ?? null,
            ];

            $totalWeight += $netWeight;
        }

        if (empty($rawBatches)) {
            return response()->json(['message' => 'No valid data rows found in the file.'], 422);
        }

        $batches = array_map(
            fn ($b) => ['batch' => $b['batch'], 'positions' => []],
            $rawBatches,
        );

        $record = CreelRecord::create([
            'order_number' => (string) ($firstRow['A'] ?? 'UNKNOWN'),
            'machine'      => (string) ($firstRow['I'] ?? null),
            'date_string'  => (string) ($firstRow['J'] ?? null),
            'operator'     => (string) ($firstRow['K'] ?? null),
            'material'     => (string) ($firstRow['H'] ?? null),
            'raw_batches'  => $rawBatches,
            'batches'      => $batches,
            'metadata'     => [
                'batch_count'  => count($rawBatches),
                'file_name'    => $file->getClientOriginalName(),
                'upload_date'  => now()->toDateTimeString(),
                'total_weight' => round($totalWeight, 2),
            ],
            'user_id' => $request->user()?->id,
        ]);

        return response()->json($record, 201);
    }

    public function show(string $id)
    {
        $record = CreelRecord::findOrFail($id);

        return response()->json($record);
    }

    /**
     * Save manually assigned bobbin positions.
     * Accepts { batches: [{ batch, positions: [{side,column,row}] }] }.
     * The ERP quota (count) lives exclusively in raw_batches and is never touched here.
     */
    public function positions(Request $request, string $id)
    {
        $record = CreelRecord::findOrFail($id);

        $request->validate([
            'batches'                      => 'required|array',
            'batches.*.batch'              => 'required|string',
            'batches.*.positions'          => 'present|array',
            'batches.*.positions.*.side'   => 'required|string|in:AI,AO,BI,BO',
            'batches.*.positions.*.column' => 'required|integer|min:1|max:100',
            'batches.*.positions.*.row'    => 'required|string|in:A,B,C,D,E',
        ]);

        $incoming = collect($request->input('batches'))->keyBy('batch');

        $updatedBatches = array_map(function ($batch) use ($incoming) {
            $batchId = $batch['batch'];
            if ($incoming->has($batchId)) {
                $batch['positions'] = array_map(fn ($p) => [
                    'side'   => (string) $p['side'],
                    'column' => (int)    $p['column'],
                    'row'    => (string) $p['row'],
                ], $incoming->get($batchId)['positions']);
            }
            return $batch;
        }, $record->batches ?? []);

        $record->update(['batches' => $updatedBatches]);

        return response()->json($record);
    }

    /**
     * Save weaving specification fields (DF width, GF width, standard total ends)
     * into the record's metadata JSON without touching batch assignments.
     */
    public function specs(Request $request, string $id)
    {
        $record = CreelRecord::findOrFail($id);

        $request->validate([
            'df_width'            => 'nullable|numeric|min:0',
            'gf_width'            => 'nullable|numeric|min:0',
            'standard_total_ends' => 'nullable|integer|min:0',
        ]);

        $meta = $record->metadata ?? [];
        foreach (['df_width', 'gf_width', 'standard_total_ends'] as $key) {
            if ($request->has($key)) {
                $meta[$key] = $request->input($key);
            }
        }

        $record->update(['metadata' => $meta]);

        return response()->json($record);
    }

    /**
     * Update raw XLSX metadata without touching assigned positions.
     * The count field here is the ERP quota, not the assigned bobbin count.
     */
    public function rawUpdate(Request $request, string $id)
    {
        $record = CreelRecord::findOrFail($id);

        $request->validate([
            'raw_batches'                => 'required|array',
            'raw_batches.*.batch'        => 'required|string',
            'raw_batches.*.count'        => 'required|integer|min:0',
            'raw_batches.*.creel_side'   => 'nullable|string',
            'raw_batches.*.creel_from'   => 'nullable|string',
            'raw_batches.*.creel_to'     => 'nullable|string',
            'raw_batches.*.net_weight'   => 'nullable|numeric',
            'raw_batches.*.material'     => 'nullable|string',
            'raw_batches.*.shift_load'   => 'nullable|string',
            'raw_batches.*.user_name'    => 'nullable|string',
        ]);

        $record->update(['raw_batches' => $request->input('raw_batches')]);

        return response()->json($record);
    }

    public function destroy(string $id)
    {
        $record = CreelRecord::findOrFail($id);
        $record->delete();

        return response()->json(['message' => 'Record deleted.']);
    }
}
