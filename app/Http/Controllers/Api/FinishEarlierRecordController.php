<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller; 
use App\Models\FinishEarlierRecord;
use Illuminate\Http\Request;

class FinishEarlierRecordController extends Controller
{
    
    /**
     * List all recorded sessions.
     */
    public function index(Request $request)
    {
        // Default: 10 rows per page, but frontend can override using ?per_page=
        $perPage = $request->get('per_page', 10);

        $records = FinishEarlierRecord::orderBy('created_at', 'desc')
        ->paginate($perPage);

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
            'roll_construction'  => 'required|string',
            'shift_group'  => 'required|string',
        ]);

        // Build initial metadata
        $metadata = [
            'machine_number'        => $validated['machine_number'],
            'style'                 => $validated['style'],
            'production_order'      => $validated['production_order'],
            'roll_construction'     => $validated['roll_construction'],
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
