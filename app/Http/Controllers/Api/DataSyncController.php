<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DataConflict;
use App\Models\SyncCheckpoint;
use App\Models\SyncClientDevice;
use App\Models\SyncTransportLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class DataSyncController extends Controller
{
    /**
     * Tables that can be synced
     */
    protected array $syncableTables = [
        'tension_records',
        'twisting_measurements',
        'weaving_measurements',
        'tension_problems',
        'stock_taking_records',
        'finish_earlier_records',
    ];

    /**
     * Register or update a client device
     */
    public function registerDevice(Request $request): JsonResponse
    {
        $request->validate([
            'client_identifier' => 'required|string|max:100',
            'device_name' => 'nullable|string|max:255',
            'device_type' => 'nullable|string|max:50',
            'os_info' => 'nullable|string|max:100',
            'app_version' => 'nullable|string|max:50',
        ]);

        $device = SyncClientDevice::registerDevice(
            $request->only(['client_identifier', 'device_name', 'device_type', 'os_info', 'app_version']),
            $request->user()?->id
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Device registered successfully',
            'data' => $device,
        ]);
    }

    /**
     * Get sync status for a client
     */
    public function getSyncStatus(Request $request): JsonResponse
    {
        $clientIdentifier = $request->input('client_identifier');
        
        if (!$clientIdentifier) {
            return response()->json([
                'status' => 'error',
                'message' => 'Client identifier required',
            ], 400);
        }

        $checkpoints = SyncCheckpoint::where('client_identifier', $clientIdentifier)->get();
        $pendingConflicts = DataConflict::forClient($clientIdentifier)->pending()->count();
        $pendingUploads = SyncTransportLog::forClient($clientIdentifier)
            ->pending()
            ->where('sync_direction', 'upload')
            ->count();

        $tableStatus = [];
        foreach ($this->syncableTables as $table) {
            $checkpoint = $checkpoints->firstWhere('table_name', $table);
            $serverCount = DB::table($table)->count();
            $serverLatest = DB::table($table)->max('updated_at');
            
            $tableStatus[$table] = [
                'server_count' => $serverCount,
                'server_latest' => $serverLatest,
                'last_synced_at' => $checkpoint?->last_synced_at,
                'last_synced_id' => $checkpoint?->last_synced_id,
            ];
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'pending_conflicts' => $pendingConflicts,
                'pending_uploads' => $pendingUploads,
                'tables' => $tableStatus,
            ],
        ]);
    }

    /**
     * Upload data from client to server
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'client_identifier' => 'required|string|max:100',
            'table_name' => 'required|string|in:' . implode(',', $this->syncableTables),
            'records' => 'required|array',
            'records.*.local_id' => 'required|integer',
            'records.*.sync_uuid' => 'nullable|string',
            'records.*.data' => 'required|array',
            'records.*.action' => 'required|in:create,update,delete',
        ]);

        $clientIdentifier = $request->input('client_identifier');
        $tableName = $request->input('table_name');
        $records = $request->input('records');
        $userId = $request->user()?->id;

        $results = [];
        $conflicts = [];

        DB::beginTransaction();
        try {
            foreach ($records as $record) {
                $result = $this->processUploadRecord(
                    $clientIdentifier,
                    $tableName,
                    $record,
                    $userId
                );
                
                if ($result['status'] === 'conflict') {
                    $conflicts[] = $result;
                }
                
                $results[] = $result;
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Upload completed',
                'data' => [
                    'processed' => count($results),
                    'conflicts' => count($conflicts),
                    'results' => $results,
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Sync upload failed', [
                'error' => $e->getMessage(),
                'client' => $clientIdentifier,
                'table' => $tableName,
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Upload failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Process a single upload record
     */
    protected function processUploadRecord(
        string $clientIdentifier,
        string $tableName,
        array $record,
        ?int $userId
    ): array {
        $localId = $record['local_id'];
        $syncUuid = $record['sync_uuid'] ?? Str::uuid()->toString();
        $data = $record['data'];
        $action = $record['action'];

        // Create transport log
        $log = SyncTransportLog::create([
            'sync_direction' => SyncTransportLog::DIRECTION_UPLOAD,
            'table_name' => $tableName,
            'local_record_id' => $localId,
            'action' => $action,
            'status' => SyncTransportLog::STATUS_PENDING,
            'payload' => $data,
            'client_identifier' => $clientIdentifier,
            'user_id' => $userId,
        ]);

        try {
            // Check for existing record by sync_uuid
            $existingRecord = DB::table($tableName)
                ->where('sync_uuid', $syncUuid)
                ->first();

            if ($action === 'delete') {
                if ($existingRecord) {
                    DB::table($tableName)->where('id', $existingRecord->id)->delete();
                }
                $log->markAsSuccess($existingRecord?->id);
                return [
                    'local_id' => $localId,
                    'remote_id' => $existingRecord?->id,
                    'status' => 'success',
                    'action' => 'deleted',
                ];
            }

            if ($action === 'create') {
                if ($existingRecord) {
                    // Record already exists, check for conflict
                    $conflictFields = $this->detectConflicts($existingRecord, $data);
                    
                    if (!empty($conflictFields)) {
                        $conflict = $this->createConflict(
                            $tableName,
                            $localId,
                            $existingRecord->id,
                            $data,
                            (array) $existingRecord,
                            $conflictFields,
                            $clientIdentifier
                        );
                        
                        $log->markAsConflict();
                        
                        return [
                            'local_id' => $localId,
                            'remote_id' => $existingRecord->id,
                            'status' => 'conflict',
                            'conflict_id' => $conflict->id,
                            'conflict_fields' => $conflictFields,
                        ];
                    }
                    
                    // No conflict, record already synced
                    $log->markAsSuccess($existingRecord->id);
                    return [
                        'local_id' => $localId,
                        'remote_id' => $existingRecord->id,
                        'status' => 'success',
                        'action' => 'already_exists',
                    ];
                }

                // Create new record
                $data['sync_uuid'] = $syncUuid;
                $data['synced_at'] = now();
                $data['sync_version'] = 1;
                $data['client_identifier'] = $clientIdentifier;
                $data['created_at'] = $data['created_at'] ?? now();
                $data['updated_at'] = now();

                $remoteId = DB::table($tableName)->insertGetId($data);
                $log->markAsSuccess($remoteId);

                return [
                    'local_id' => $localId,
                    'remote_id' => $remoteId,
                    'sync_uuid' => $syncUuid,
                    'status' => 'success',
                    'action' => 'created',
                ];
            }

            if ($action === 'update') {
                if (!$existingRecord) {
                    // Create the record if it doesn't exist
                    $data['sync_uuid'] = $syncUuid;
                    $data['synced_at'] = now();
                    $data['sync_version'] = 1;
                    $data['client_identifier'] = $clientIdentifier;
                    $data['created_at'] = $data['created_at'] ?? now();
                    $data['updated_at'] = now();

                    $remoteId = DB::table($tableName)->insertGetId($data);
                    $log->markAsSuccess($remoteId);

                    return [
                        'local_id' => $localId,
                        'remote_id' => $remoteId,
                        'sync_uuid' => $syncUuid,
                        'status' => 'success',
                        'action' => 'created',
                    ];
                }

                // Check version for conflict detection
                $localVersion = $data['sync_version'] ?? 1;
                $remoteVersion = $existingRecord->sync_version ?? 1;

                if ($localVersion < $remoteVersion) {
                    // Remote has newer version, conflict
                    $conflictFields = $this->detectConflicts($existingRecord, $data);
                    
                    if (!empty($conflictFields)) {
                        $conflict = $this->createConflict(
                            $tableName,
                            $localId,
                            $existingRecord->id,
                            $data,
                            (array) $existingRecord,
                            $conflictFields,
                            $clientIdentifier
                        );
                        
                        $log->markAsConflict();
                        
                        return [
                            'local_id' => $localId,
                            'remote_id' => $existingRecord->id,
                            'status' => 'conflict',
                            'conflict_id' => $conflict->id,
                            'conflict_fields' => $conflictFields,
                        ];
                    }
                }

                // Update record
                $data['synced_at'] = now();
                $data['sync_version'] = $remoteVersion + 1;
                $data['updated_at'] = now();
                unset($data['id'], $data['created_at'], $data['sync_uuid']);

                DB::table($tableName)
                    ->where('id', $existingRecord->id)
                    ->update($data);

                $log->markAsSuccess($existingRecord->id);

                return [
                    'local_id' => $localId,
                    'remote_id' => $existingRecord->id,
                    'status' => 'success',
                    'action' => 'updated',
                    'new_version' => $remoteVersion + 1,
                ];
            }
        } catch (\Exception $e) {
            $log->markAsFailed($e->getMessage());
            throw $e;
        }

        return [
            'local_id' => $localId,
            'status' => 'error',
            'message' => 'Unknown action',
        ];
    }

    /**
     * Download data from server to client
     */
    public function download(Request $request): JsonResponse
    {
        $request->validate([
            'client_identifier' => 'required|string|max:100',
            'table_name' => 'required|string|in:' . implode(',', $this->syncableTables),
            'since' => 'nullable|date',
            'since_id' => 'nullable|integer',
            'limit' => 'nullable|integer|min:1|max:1000',
        ]);

        $clientIdentifier = $request->input('client_identifier');
        $tableName = $request->input('table_name');
        $since = $request->input('since');
        $sinceId = $request->input('since_id');
        $limit = $request->input('limit', 100);

        $query = DB::table($tableName);

        if ($since) {
            $query->where('updated_at', '>', $since);
        }

        if ($sinceId) {
            $query->where('id', '>', $sinceId);
        }

        $records = $query
            ->orderBy('id')
            ->limit($limit)
            ->get();

        // Update checkpoint
        if ($records->isNotEmpty()) {
            $lastRecord = $records->last();
            SyncCheckpoint::updateOrCreate(
                [
                    'client_identifier' => $clientIdentifier,
                    'table_name' => $tableName,
                ],
                [
                    'last_synced_id' => $lastRecord->id,
                    'last_synced_at' => now(),
                ]
            );
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'table' => $tableName,
                'count' => $records->count(),
                'records' => $records,
                'has_more' => $records->count() >= $limit,
            ],
        ]);
    }

    /**
     * Get pending conflicts
     */
    public function getConflicts(Request $request): JsonResponse
    {
        $clientIdentifier = $request->input('client_identifier');
        
        $query = DataConflict::pending()
            ->with('resolvedBy')
            ->orderBy('created_at', 'desc');

        if ($clientIdentifier) {
            $query->forClient($clientIdentifier);
        }

        $conflicts = $query->paginate(20);

        return response()->json([
            'status' => 'success',
            'data' => $conflicts,
        ]);
    }

    /**
     * Resolve a conflict
     */
    public function resolveConflict(Request $request, int $conflictId): JsonResponse
    {
        $request->validate([
            'resolution' => 'required|in:local_wins,remote_wins,merged,dismissed',
            'merged_data' => 'required_if:resolution,merged|array',
            'notes' => 'nullable|string|max:1000',
        ]);

        $conflict = DataConflict::findOrFail($conflictId);
        
        if ($conflict->resolution_status !== DataConflict::STATUS_PENDING) {
            return response()->json([
                'status' => 'error',
                'message' => 'Conflict already resolved',
            ], 400);
        }

        $resolution = $request->input('resolution');
        $notes = $request->input('notes');
        $userId = $request->user()?->id;

        DB::beginTransaction();
        try {
            switch ($resolution) {
                case 'local_wins':
                    $conflict->resolveWithLocalData($userId, $notes);
                    $this->applyConflictResolution($conflict, $conflict->local_data);
                    break;
                    
                case 'remote_wins':
                    $conflict->resolveWithRemoteData($userId, $notes);
                    // No action needed, remote data is already in place
                    break;
                    
                case 'merged':
                    $mergedData = $request->input('merged_data');
                    $conflict->resolveWithMergedData($mergedData, $userId, $notes);
                    $this->applyConflictResolution($conflict, $mergedData);
                    break;
                    
                case 'dismissed':
                    $conflict->dismiss($userId, $notes);
                    break;
            }

            DB::commit();

            return response()->json([
                'status' => 'success',
                'message' => 'Conflict resolved successfully',
                'data' => $conflict->fresh(),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to resolve conflict', [
                'conflict_id' => $conflictId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'Failed to resolve conflict: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get sync transport logs
     */
    public function getSyncLogs(Request $request): JsonResponse
    {
        $clientIdentifier = $request->input('client_identifier');
        $status = $request->input('status');
        $tableName = $request->input('table_name');

        $query = SyncTransportLog::with('user')
            ->orderBy('created_at', 'desc');

        if ($clientIdentifier) {
            $query->forClient($clientIdentifier);
        }

        if ($status) {
            $query->where('status', $status);
        }

        if ($tableName) {
            $query->forTable($tableName);
        }

        $logs = $query->paginate(50);

        return response()->json([
            'status' => 'success',
            'data' => $logs,
        ]);
    }

    /**
     * Detect conflicts between local and remote data
     */
    protected function detectConflicts($remote, array $local): array
    {
        $conflictFields = [];
        $remoteArray = (array) $remote;

        // Fields to compare (exclude metadata fields)
        $excludeFields = [
            'id', 'sync_uuid', 'synced_at', 'sync_version', 
            'client_identifier', 'created_at', 'updated_at'
        ];

        foreach ($local as $key => $value) {
            if (in_array($key, $excludeFields)) {
                continue;
            }

            if (isset($remoteArray[$key]) && $remoteArray[$key] != $value) {
                $conflictFields[] = $key;
            }
        }

        return $conflictFields;
    }

    /**
     * Create a conflict record
     */
    protected function createConflict(
        string $tableName,
        int $localId,
        int $remoteId,
        array $localData,
        array $remoteData,
        array $conflictFields,
        string $clientIdentifier
    ): DataConflict {
        return DataConflict::create([
            'table_name' => $tableName,
            'local_record_id' => $localId,
            'remote_record_id' => $remoteId,
            'local_data' => $localData,
            'remote_data' => $remoteData,
            'conflict_fields' => $conflictFields,
            'client_identifier' => $clientIdentifier,
        ]);
    }

    /**
     * Apply conflict resolution to database
     */
    protected function applyConflictResolution(DataConflict $conflict, array $data): void
    {
        $data['synced_at'] = now();
        $data['updated_at'] = now();
        unset($data['id'], $data['created_at'], $data['sync_uuid']);

        DB::table($conflict->table_name)
            ->where('id', $conflict->remote_record_id)
            ->update($data);
    }
}
