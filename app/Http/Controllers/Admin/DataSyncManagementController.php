<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DataConflict;
use App\Models\SyncClientDevice;
use App\Models\SyncTransportLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DataSyncManagementController extends Controller
{
    /**
     * Display the data sync dashboard
     */
    public function index(): Response
    {
        $stats = [
            'total_devices' => SyncClientDevice::count(),
            'active_devices' => SyncClientDevice::active()->count(),
            'pending_conflicts' => DataConflict::pending()->count(),
            'total_syncs_today' => SyncTransportLog::whereDate('created_at', today())->count(),
            'failed_syncs_today' => SyncTransportLog::failed()->whereDate('created_at', today())->count(),
        ];

        $recentConflicts = DataConflict::with('resolvedBy')
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        $recentDevices = SyncClientDevice::with('user')
            ->orderBy('last_sync_at', 'desc')
            ->limit(10)
            ->get();

        return Inertia::render('admin/data-sync/index', [
            'stats' => $stats,
            'recentConflicts' => $recentConflicts,
            'recentDevices' => $recentDevices,
        ]);
    }

    /**
     * Display conflicts management page
     */
    public function conflicts(Request $request): Response
    {
        $status = $request->input('status', 'pending');
        $tableName = $request->input('table');

        $query = DataConflict::with('resolvedBy')
            ->orderBy('created_at', 'desc');

        if ($status && $status !== 'all') {
            $query->where('resolution_status', $status);
        }

        if ($tableName) {
            $query->forTable($tableName);
        }

        $conflicts = $query->paginate(20);

        $tableStats = DataConflict::select('table_name')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(CASE WHEN resolution_status = "pending" THEN 1 ELSE 0 END) as pending')
            ->groupBy('table_name')
            ->get();

        return Inertia::render('admin/data-sync/conflicts', [
            'conflicts' => $conflicts,
            'filters' => [
                'status' => $status,
                'table' => $tableName,
            ],
            'tableStats' => $tableStats,
        ]);
    }

    /**
     * Display conflict detail page
     */
    public function showConflict(int $id): Response
    {
        $conflict = DataConflict::with('resolvedBy')->findOrFail($id);

        return Inertia::render('admin/data-sync/conflict-detail', [
            'conflict' => $conflict,
            'diff' => $conflict->getDiff(),
        ]);
    }

    /**
     * Resolve a conflict
     */
    public function resolveConflict(Request $request, int $id)
    {
        $request->validate([
            'resolution' => 'required|in:local_wins,remote_wins,merged,dismissed',
            'merged_data' => 'required_if:resolution,merged|string',
            'notes' => 'nullable|string|max:1000',
        ]);

        $conflict = DataConflict::findOrFail($id);

        if ($conflict->resolution_status !== DataConflict::STATUS_PENDING) {
            return back()->with('error', 'Conflict has already been resolved.');
        }

        $resolution = $request->input('resolution');
        $notes = $request->input('notes');
        $userId = $request->user()->id;

        DB::beginTransaction();
        try {
            switch ($resolution) {
                case 'local_wins':
                    $conflict->resolveWithLocalData($userId, $notes);
                    $this->applyResolution($conflict, $conflict->local_data);
                    break;

                case 'remote_wins':
                    $conflict->resolveWithRemoteData($userId, $notes);
                    break;

                case 'merged':
                    $mergedDataJson = $request->input('merged_data');
                    $mergedData = json_decode($mergedDataJson, true);
                    if (json_last_error() !== JSON_ERROR_NONE) {
                        throw new \InvalidArgumentException('Invalid merged data format');
                    }
                    $conflict->resolveWithMergedData($mergedData, $userId, $notes);
                    $this->applyResolution($conflict, $mergedData);
                    break;

                case 'dismissed':
                    $conflict->dismiss($userId, $notes);
                    break;
            }

            DB::commit();

            return redirect()->route('admin.data-sync.conflicts')
                ->with('success', 'Conflict resolved successfully.');
        } catch (\Exception $e) {
            DB::rollBack();
            return back()->with('error', 'Failed to resolve conflict: ' . $e->getMessage());
        }
    }

    /**
     * Bulk resolve conflicts
     */
    public function bulkResolveConflicts(Request $request)
    {
        $request->validate([
            'conflict_ids' => 'required|array',
            'conflict_ids.*' => 'integer|exists:data_conflicts,id',
            'resolution' => 'required|in:local_wins,remote_wins,dismissed',
        ]);

        $conflictIds = $request->input('conflict_ids');
        $resolution = $request->input('resolution');
        $userId = $request->user()->id;

        $resolved = 0;
        $failed = 0;

        foreach ($conflictIds as $id) {
            $conflict = DataConflict::find($id);
            
            if (!$conflict || $conflict->resolution_status !== DataConflict::STATUS_PENDING) {
                $failed++;
                continue;
            }

            try {
                DB::beginTransaction();
                
                switch ($resolution) {
                    case 'local_wins':
                        $conflict->resolveWithLocalData($userId, 'Bulk resolution');
                        $this->applyResolution($conflict, $conflict->local_data);
                        break;

                    case 'remote_wins':
                        $conflict->resolveWithRemoteData($userId, 'Bulk resolution');
                        break;

                    case 'dismissed':
                        $conflict->dismiss($userId, 'Bulk resolution');
                        break;
                }

                DB::commit();
                $resolved++;
            } catch (\Exception $e) {
                DB::rollBack();
                $failed++;
            }
        }

        return back()->with('success', "Resolved {$resolved} conflicts. Failed: {$failed}.");
    }

    /**
     * Display sync logs page
     */
    public function syncLogs(Request $request): Response
    {
        $status = $request->input('status');
        $direction = $request->input('direction');
        $tableName = $request->input('table');
        $clientId = $request->input('client');

        $query = SyncTransportLog::with('user')
            ->orderBy('created_at', 'desc');

        if ($status) {
            $query->where('status', $status);
        }

        if ($direction) {
            $query->where('sync_direction', $direction);
        }

        if ($tableName) {
            $query->forTable($tableName);
        }

        if ($clientId) {
            $query->forClient($clientId);
        }

        $logs = $query->paginate(50);

        $stats = [
            'total' => SyncTransportLog::count(),
            'success' => SyncTransportLog::successful()->count(),
            'failed' => SyncTransportLog::failed()->count(),
            'pending' => SyncTransportLog::pending()->count(),
            'conflicts' => SyncTransportLog::conflicts()->count(),
        ];

        $clients = SyncClientDevice::select('client_identifier', 'device_name')->get();

        return Inertia::render('admin/data-sync/logs', [
            'logs' => $logs,
            'filters' => [
                'status' => $status,
                'direction' => $direction,
                'table' => $tableName,
                'client' => $clientId,
            ],
            'stats' => $stats,
            'clients' => $clients,
        ]);
    }

    /**
     * Display devices management page
     */
    public function devices(Request $request): Response
    {
        $query = SyncClientDevice::with('user')
            ->withCount([
                'transportLogs',
                'conflicts' => fn ($q) => $q->pending(),
            ])
            ->orderBy('last_sync_at', 'desc');

        if ($request->filled('active_only')) {
            $query->active();
        }

        $devices = $query->paginate(20);

        return Inertia::render('admin/data-sync/devices', [
            'devices' => $devices,
            'filters' => [
                'active_only' => $request->boolean('active_only'),
            ],
        ]);
    }

    /**
     * Deactivate a device
     */
    public function deactivateDevice(int $id)
    {
        $device = SyncClientDevice::findOrFail($id);
        $device->update(['is_active' => false]);

        return back()->with('success', 'Device deactivated successfully.');
    }

    /**
     * Reactivate a device
     */
    public function reactivateDevice(int $id)
    {
        $device = SyncClientDevice::findOrFail($id);
        $device->update(['is_active' => true]);

        return back()->with('success', 'Device reactivated successfully.');
    }

    /**
     * Apply resolution data to the database
     */
    protected function applyResolution(DataConflict $conflict, array $data): void
    {
        $data['synced_at'] = now();
        $data['updated_at'] = now();
        unset($data['id'], $data['created_at'], $data['sync_uuid']);

        DB::table($conflict->table_name)
            ->where('id', $conflict->remote_record_id)
            ->update($data);
    }
}
