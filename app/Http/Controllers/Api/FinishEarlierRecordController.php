<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller; 
use App\Http\Controllers\Concerns\HandlesJsonColumns;
use App\Models\FinishEarlierRecord;
use Illuminate\Http\Request;
use Barryvdh\DomPDF\Facade\Pdf;

class FinishEarlierRecordController extends Controller
{
    use HandlesJsonColumns;

    
    /**
     * List all recorded sessions.
     */
    public function index(Request $request)
    {
        // Default: 10 rows per page, but frontend can override using ?per_page=
        $perPage = min((int) $request->get('per_page', 10), 200);

        $query = FinishEarlierRecord::query();

        // The display page has always sent `search`; it used to be ignored.
        if ($search = strtolower(trim((string) $request->get('search', '')))) {
            $fields = array_map(fn ($f) => $this->jsonExtract('metadata', "$.{$f}"), ['production_order', 'style', 'machine_number', 'shift_group']);
            $query->where(function ($q) use ($fields, $search) {
                foreach ($fields as $expr) {
                    $q->orWhereRaw("LOWER({$expr}) LIKE ?", ["%{$search}%"]);
                }
            });
        }

        $records = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json($records);
    }

    /**
     * Show one specific session by ID.
     */
    public function show($id)
    {
        $record = FinishEarlierRecord::findOrFail($id);

        return response()->json([
            'message' => 'Record fetched.',
            'data'    => $record,
        ]);
    }
    
    
    /**
     * Create a new session with metadata only.
     * Entries will start as an empty array.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'machine_number'     => 'required|string',
            'style'              => 'required|string',
            'production_order'   => 'required|string',
            'roll_construction'  => 'nullable|string',
            'shift_group'  => 'required|string',
        ]);

        // Build initial metadata
        $metadata = [
            'machine_number'        => $validated['machine_number'],
            'style'                 => $validated['style'],
            'production_order'      => $validated['production_order'],
            'roll_construction'     => $validated['roll_construction'] ?? '',
            'shift_group'           => $validated['shift_group'],
            'total_finish_earlier'  => 0,     // placeholder
            'average_meters_finish' => 0,     // placeholder
        ];

        $record = FinishEarlierRecord::create([
            'metadata' => $metadata,
            'entries'  => [],   // start empty
        ]);

        return response()->json([
            'message' => 'Session created successfully.',
            'id'      => $record->id,
            'data'    => $record,
        ]);
    }

    /**
     * Call the session to fetch the data to frontend.
     */
    public function getSession($productionOrder)
    {
        // Find record where production_order inside metadata equals given session id
        $record = FinishEarlierRecord::where('metadata->production_order', $productionOrder)->first();

        if (!$record) {
            return response()->json([
                'message' => 'Session not found'
            ], 404);
        }

        return response()->json($record);
    }

    /**
     * Add an entry to an existing session.
     */
    public function addEntry(Request $request, $productionOrder)
    {
        $data = $request->validate([
        'creel_side'    => 'required|string',
        'row_number'    => 'required|string',
        'column_number' => 'required|string',
        'meters_finish' => 'required|numeric',
        ]);

        // Find the session by production_order inside metadata
        $record = FinishEarlierRecord::where('metadata->production_order', $productionOrder)->first();

        if (! $record) {
            return response()->json(['message' => 'Session not found'], 404);
        }

        $record->addEntry($data);

        return response()->json([
            'message' => 'Entry added and metadata updated.',
            'record'  => $record
        ]);
    }

    /**
     * Finish session: Calculate totals and averages.
     */
    public function finish($id)
    {
        $record = FinishEarlierRecord::findOrFail($id);

        $entries = $record->entries;
        $total = count($entries);
        $average = $total > 0
            ? array_sum(array_column($entries, 'meters_finish')) / $total
            : 0;

        // Update metadata
        $metadata = $record->metadata;
        $metadata['total_finish_earlier']  = $total;
        $metadata['average_meters_finish'] = $average;

        $record->update([
            'metadata' => $metadata,
        ]);

        return response()->json([
            'message' => 'Recording finished.',
            'data' => $record,
        ]);
    }

    /**
     * Create a complete record from a scanned form in one atomic write.
     */
    public function submitScan(Request $request)
    {
        $validated = $request->validate([
            'metadata.machine_number'    => 'required|string',
            'metadata.style'             => 'required|string',
            'metadata.production_order'  => 'required|string',
            'metadata.roll_construction' => 'sometimes|nullable|string',
            'metadata.shift_group'       => 'required|string',
            'entries'                    => 'required|array|min:1',
            'entries.*.creel_side'       => 'required|string',
            'entries.*.row_number'       => 'required|string',
            'entries.*.column_number'    => 'required|string',
            'entries.*.meters_finish'    => 'required|numeric',
            'conflict_resolution'        => 'sometimes|in:replace,merge',
        ]);

        $productionOrder = $validated['metadata']['production_order'];
        $existing = FinishEarlierRecord::where('metadata->production_order', $productionOrder)->first();

        if ($existing && !isset($validated['conflict_resolution'])) {
            return response()->json([
                'conflict' => true,
                'existing' => [
                    'id'          => $existing->id,
                    'entry_count' => count($existing->entries ?? []),
                    'created_at'  => $existing->created_at->toDateTimeString(),
                ],
            ], 409);
        }

        $entries = $validated['entries'];
        $meta    = $validated['metadata'];

        if ($existing && ($validated['conflict_resolution'] ?? '') === 'merge') {
            $merged = array_merge($existing->entries ?? [], $entries);
            $total  = count($merged);
            $meta['total_finish_earlier']  = $total;
            $meta['average_meters_finish'] = $total > 0
                ? (int) round(array_sum(array_column($merged, 'meters_finish')) / $total)
                : 0;
            $existing->update(['metadata' => $meta, 'entries' => $merged]);
            return response()->json(['message' => 'Record merged.', 'id' => $existing->id, 'data' => $existing], 200);
        }

        if ($existing) {
            $existing->delete();
        }

        $total = count($entries);
        $meta['total_finish_earlier']  = $total;
        $meta['average_meters_finish'] = $total > 0
            ? (int) round(array_sum(array_column($entries, 'meters_finish')) / $total)
            : 0;

        $record = FinishEarlierRecord::create(['metadata' => $meta, 'entries' => $entries]);

        return response()->json([
            'message' => 'Record created from scan.',
            'id'      => $record->id,
            'data'    => $record,
        ], 201);
    }

    /**
     * Update metadata fields and/or entries for an existing record.
     */
    public function update(Request $request, $id)
    {
        $record = FinishEarlierRecord::findOrFail($id);

        $validated = $request->validate([
            'machine_number'          => 'sometimes|required|string',
            'style'                   => 'sometimes|required|string',
            'production_order'        => 'sometimes|required|string',
            'shift_group'             => 'sometimes|required|string',
            'roll_construction'       => 'nullable|string',
            'entries'                 => 'sometimes|array',
            'entries.*.creel_side'    => 'required_with:entries|string',
            'entries.*.row_number'    => 'required_with:entries|string',
            'entries.*.column_number' => 'required_with:entries|string',
            'entries.*.meters_finish' => 'required_with:entries|numeric',
        ]);

        $metaKeys = ['machine_number', 'style', 'production_order', 'shift_group', 'roll_construction'];
        $metaUpdates = array_intersect_key($validated, array_flip($metaKeys));

        $updates = [];
        $metadata = array_merge($record->metadata, $metaUpdates);

        if (isset($validated['entries'])) {
            $entries = $validated['entries'];
            $total = count($entries);
            $metadata['total_finish_earlier']  = $total;
            $metadata['average_meters_finish'] = $total > 0
                ? (int) round(array_sum(array_column($entries, 'meters_finish')) / $total)
                : 0;
            $updates['entries'] = $entries;
        }

        $updates['metadata'] = $metadata;
        $record->update($updates);

        return response()->json(['message' => 'Record updated.', 'data' => $record]);
    }

    /**
     * Delete a record completely.
     */
    public function destroy($id)
    {
        $record = FinishEarlierRecord::findOrFail($id);
        $record->delete();

        return response()->json([
            'message' => 'Record deleted successfully.'
        ]);
    }

    /**
     * Generate a pdf file.
     */
    public function exportPdf($productionOrder)
    {
        $record = FinishEarlierRecord::where('metadata->production_order', $productionOrder)->first();

        if (!$record) {
            return response()->json(['message' => 'Session not found'], 404);
        }

        $metadata = $record->metadata;
        $entries = $record->entries ?? [];

        $pdf = Pdf::loadView('pdf.finish_earlier_report', [
            'metadata' => $metadata,
            'entries'  => $entries,
        ])->setPaper('A4', 'portrait');

        return $pdf->download("FinishEarlier_{$productionOrder}.pdf");
    }

    
    /**
     * Return CSV format for user to download
     */
    public function downloadCsv($productionOrder)
    {
        $record = FinishEarlierRecord::where('metadata->production_order', $productionOrder)->first();

    if (!$record) {
        return response()->json([
            'message' => 'Session not found'
        ], 404);
    }

    return response()->json([
        'metadata' => $record->metadata,
        'entries'  => $record->entries ?? [],
    ]);
    }


}
