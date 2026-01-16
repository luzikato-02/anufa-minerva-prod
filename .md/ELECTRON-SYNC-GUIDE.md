# Electron Sync Architecture - Detailed Guide

## Overview

The Electron app implements an **offline-first sync system** that allows users to work without internet, then automatically sync changes when reconnected.

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────┐
│           USER WORKING IN ELECTRON APP               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ React Component (online or offline)         │   │
│  │  - Create tension record                    │   │
│  │  - Add measurements                         │   │
│  │  - Save locally                             │   │
│  └────────────────┬────────────────────────────┘   │
│                   │                                 │
│  ┌────────────────▼────────────────────────────┐   │
│  │ Electron IPC Call                           │   │
│  │ electronAPI.dbExecute(INSERT ...)           │   │
│  └────────────────┬────────────────────────────┘   │
│                   │                                 │
│  ┌────────────────▼────────────────────────────┐   │
│  │ Local SQLite Database                       │   │
│  │ ┌──────────────────────────────────────┐   │   │
│  │ │ tension_records                      │   │   │
│  │ │ ├─ id: 1                             │   │   │
│  │ │ ├─ record_type: 'twisting'           │   │   │
│  │ │ ├─ local_modified: 1 ← MARKED!       │   │   │
│  │ │ ├─ synced_at: NULL                   │   │   │
│  │ │ ├─ remote_id: NULL                   │   │   │
│  │ │ └─ created_at: NOW                   │   │   │
│  │ └──────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  ✅ Data saved locally                              │
│  📡 No internet? No problem! Keep working.         │
│  🔄 Waiting for sync...                            │
│                                                      │
└──────────────────────────────────────────────────────┘
                        │
                        │ User clicks: File → Data Sync → Sync Now
                        │ Or automatically when network detected
                        ▼
┌──────────────────────────────────────────────────────┐
│           SYNC PROCESS INITIATED                     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ STEP 1: Fetch Unsynced Records              │   │
│  │ electronAPI.getUnsyncedRecords('tension_records')│
│  │                                              │   │
│  │ SELECT * FROM tension_records                │   │
│  │  WHERE local_modified = 1                   │   │
│  │    AND synced_at IS NULL                    │   │
│  └────────────────┬────────────────────────────┘   │
│                   │                                 │
│  ┌────────────────▼────────────────────────────┐   │
│  │ STEP 2: Upload to Server API                │   │
│  │ POST http://server:8000/api/tension-records │   │
│  │ {                                            │   │
│  │   "records": [                              │   │
│  │     {                                       │   │
│  │       "id": 1,                             │   │
│  │       "record_type": "twisting",           │   │
│  │       "machine_number": "M-001",           │   │
│  │       ...                                  │   │
│  │     }                                       │   │
│  │   ]                                         │   │
│  │ }                                            │   │
│  └────────────────┬────────────────────────────┘   │
│                   │                                 │
│          ┌────────┴────────┐                        │
│          │                 │                        │
│    ┌─────▼─────┐     ┌─────▼──────┐                │
│    │  SUCCESS  │     │  CONFLICT   │               │
│    │           │     │             │               │
│    │ Server    │     │ Server has  │               │
│    │ creates   │     │ newer version               │
│    │ record    │     │             │               │
│    │ (remote   │     │ Create      │               │
│    │  ID: 42)  │     │ conflict    │               │
│    │           │     │ record      │               │
│    └─────┬─────┘     └─────┬──────┘                │
│          │                 │                        │
└──────────┼─────────────────┼─────────────────────────┘
           │                 │
           ▼                 ▼
┌──────────────────────────────────────────────────────┐
│    STEP 3: Update Local Database                     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  SUCCESS PATH:                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ electronAPI.markAsSynced(tableName, 1, 42)  │   │
│  │                                              │   │
│  │ UPDATE tension_records SET                   │   │
│  │   synced_at = NOW,                          │   │
│  │   local_modified = 0,                       │   │
│  │   remote_id = 42                            │   │
│  │  WHERE id = 1                               │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  CONFLICT PATH:                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ electronAPI.createConflict({                 │   │
│  │   table_name: 'tension_records',             │   │
│  │   local_record_id: 1,                        │   │
│  │   remote_record_id: 42,                      │   │
│  │   local_data: { ... },                       │   │
│  │   remote_data: { ... },                      │   │
│  │   conflict_fields: ['machine_number', ...]   │   │
│  │ })                                            │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ✅ Sync complete                                    │
│  ⚠️ Or conflicts pending user review                │
│                                                      │
└──────────────────────────────────────────────────────┘
           │
           │ User clicks: File → Data Sync → Resolve Conflicts
           │ (if conflicts exist)
           ▼
┌──────────────────────────────────────────────────────┐
│    STEP 4: Conflict Resolution (if needed)           │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Admin Panel: Admin → Data Sync                     │
│                                                      │
│  For each conflict:                                 │
│  ┌──────────────────────────────────────────────┐   │
│  │  Conflict ID: 5                              │   │
│  │  Table: tension_records                      │   │
│  │                                              │   │
│  │  LOCAL VERSION:          REMOTE VERSION:     │   │
│  │  machine: "M-001"        machine: "M-002"    │   │
│  │  operator: "John"        operator: "Jane"    │   │
│  │  status: "draft"         status: "completed" │   │
│  │                                              │   │
│  │  [Keep Local] [Keep Remote] [Merge]         │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Admin chooses: "Keep Remote"                       │
│                                                      │
│  electronAPI.resolveConflict(5, {                  │
│    status: 'resolved',                             │
│    user_id: admin_id,                              │
│    notes: 'Chose server version',                  │
│    merged_data: null                               │
│  })                                                 │
│                                                      │
│  UPDATE data_conflicts SET                          │
│    resolution_status = 'resolved',                 │
│    resolved_at = NOW,                              │
│    resolved_by_user_id = admin_id,                │
│    merged_data = NULL                              │
│   WHERE id = 5                                     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Detailed Sync Process

### Phase 1: User Creates/Modifies Data (Offline)

**Scenario**: User working offline creates a tension record.

```tsx
// React Component
const saveTensionRecord = async (recordData) => {
  // First: Try API (might fail offline)
  try {
    const response = await fetch('/api/tension-records', {
      method: 'POST',
      body: JSON.stringify(recordData)
    });
    // If online, save to server directly
  } catch (error) {
    // Offline or API error - save locally instead
    const result = await window.electronAPI.dbExecute(
      `INSERT INTO tension_records 
       (record_type, machine_number, operator, local_modified, created_at)
       VALUES (?, ?, ?, 1, datetime('now'))`,
      [recordData.type, recordData.machine, recordData.operator]
    );
    
    if (result.success) {
      console.log('Saved locally with ID:', result.lastInsertRowid);
      // Show "⏳ Pending sync" badge
      setStatus('pending-sync');
    }
  }
};
```

**Local Database State After Save:**

```sql
tension_records table:
┌─────┬───────────┬──────────────┬─────────┬──────────┬────────────┐
│ id  │ record... │ machine...   │ operator│ local_..  │ synced_at  │
├─────┼───────────┼──────────────┼─────────┼──────────┼────────────┤
│ 1   │ twisting  │ M-001        │ John    │ 1 ←────  │ NULL       │
└─────┴───────────┴──────────────┴─────────┴──────────┴────────────┘
                                            Marked for sync!
```

---

### Phase 2: Upload (Upload Local → Server)

**Triggered by**: User clicks "Sync Now" or network restored

```tsx
// Sync Manager Component
const performSync = async () => {
  console.log('🔄 Starting sync...');
  
  // STEP 1: Get all unsynced local records
  const unsyncedResult = await window.electronAPI.getUnsyncedRecords('tension_records');
  
  if (!unsyncedResult.success) {
    console.error('Failed to get unsynced records');
    return;
  }
  
  const unsyncedRecords = unsyncedResult.data;
  console.log(`📤 Uploading ${unsyncedRecords.length} records...`);
  
  // STEP 2: Send to server API
  for (const localRecord of unsyncedRecords) {
    try {
      const response = await fetch('/api/tension-records/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          local_id: localRecord.id,
          data: localRecord
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // STEP 3: Mark as synced in local DB
        const markResult = await window.electronAPI.markAsSynced(
          'tension_records',
          localRecord.id,
          result.remote_id // Server's new ID
        );
        
        if (markResult.success) {
          console.log(`✅ Record ${localRecord.id} synced (remote ID: ${result.remote_id})`);
          
          // Log the sync transport
          await window.electronAPI.logSyncTransport({
            sync_direction: 'upload',
            table_name: 'tension_records',
            record_id: localRecord.id,
            remote_record_id: result.remote_id,
            action: 'create',
            status: 'success',
            payload: localRecord
          });
        }
      } else if (response.status === 409) {
        // CONFLICT: Server has different version
        console.log(`⚠️ Conflict for record ${localRecord.id}`);
        
        // STEP 3b: Create conflict record
        const conflictData = result; // Contains local/remote versions
        await window.electronAPI.createConflict({
          table_name: 'tension_records',
          local_record_id: localRecord.id,
          remote_record_id: result.remote_id,
          local_data: localRecord,
          remote_data: result.server_version,
          conflict_fields: result.differing_fields
        });
      }
    } catch (error) {
      console.error(`❌ Upload failed for record ${localRecord.id}:`, error);
      
      // Log failed sync attempt
      await window.electronAPI.logSyncTransport({
        sync_direction: 'upload',
        table_name: 'tension_records',
        record_id: localRecord.id,
        action: 'create',
        status: 'failed',
        error_message: error.message
      });
    }
  }
};
```

**HTTP Request Example (to Laravel API):**

```
POST /api/tension-records/sync
Content-Type: application/json

{
  "local_id": 1,
  "data": {
    "id": 1,
    "record_type": "twisting",
    "machine_number": "M-001",
    "operator": "John",
    "form_data": "{...}",
    "status": "draft",
    "created_at": "2026-01-16T10:30:00Z",
    "local_modified": 1,
    "synced_at": null,
    "remote_id": null
  }
}
```

**HTTP Response (Success):**

```json
{
  "success": true,
  "remote_id": 42,
  "message": "Record created successfully"
}
```

**HTTP Response (Conflict):**

```json
{
  "success": false,
  "conflict": true,
  "remote_id": 42,
  "message": "Record already exists with different data",
  "server_version": {
    "id": 42,
    "record_type": "twisting",
    "machine_number": "M-002",
    "operator": "Jane",
    "status": "completed",
    "updated_at": "2026-01-16T09:00:00Z"
  },
  "differing_fields": ["machine_number", "operator", "status"]
}
```

---

### Phase 3: Download (Server → Local)

**Triggered by**: After upload completes, or during continuous sync

```tsx
const downloadUpdates = async () => {
  console.log('📥 Downloading updates from server...');
  
  // Get all records from server to sync
  const response = await fetch('/api/tension-records/sync-all');
  const serverRecords = await response.json();
  
  // Prepare batch update queries
  const queries = serverRecords.map(serverRecord => ({
    sql: `INSERT OR REPLACE INTO tension_records 
          (id, record_type, machine_number, operator, status, 
           form_data, synced_at, local_modified, remote_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 0, ?, ?, ?)`,
    params: [
      serverRecord.local_id || serverRecord.id, // Use local_id if available
      serverRecord.record_type,
      serverRecord.machine_number,
      serverRecord.operator,
      serverRecord.status,
      JSON.stringify(serverRecord),
      serverRecord.id, // remote_id
      serverRecord.created_at,
      serverRecord.updated_at
    ]
  }));
  
  // Execute batch update
  const result = await window.electronAPI.dbBatchExecute(queries);
  
  if (result.success) {
    console.log(`✅ Downloaded and synced ${result.results.length} records`);
  }
};
```

---

### Phase 4: Conflict Resolution

**Conflict Record Structure:**

```sql
data_conflicts table:
┌────┬──────────┬────────────────┬──────────────────┬──────────────┐
│ id │ table... │ local_record.. │ remote_record... │ resolution.. │
├────┼──────────┼────────────────┼──────────────────┼──────────────┤
│ 5  │ tension..│ 1              │ 42               │ pending      │
└────┴──────────┴────────────────┴──────────────────┴──────────────┘

local_data column (JSON):
{
  "id": 1,
  "machine_number": "M-001",
  "operator": "John",
  "status": "draft",
  "updated_at": "2026-01-16T10:30:00Z"
}

remote_data column (JSON):
{
  "id": 42,
  "machine_number": "M-002",
  "operator": "Jane",
  "status": "completed",
  "updated_at": "2026-01-16T09:00:00Z"
}

conflict_fields column (JSON):
["machine_number", "operator", "status"]
```

**Admin Resolution UI:**

```tsx
// Admin page: Admin → Data Sync → View Conflicts

const ConflictResolver = () => {
  const [conflicts, setConflicts] = useState([]);
  
  useEffect(() => {
    const loadConflicts = async () => {
      const result = await window.electronAPI.getPendingConflicts();
      setConflicts(result.data);
    };
    loadConflicts();
  }, []);
  
  const resolveConflict = async (conflictId, choice) => {
    let merged_data = null;
    
    if (choice === 'keep-remote') {
      merged_data = conflict.remote_data;
    } else if (choice === 'keep-local') {
      merged_data = conflict.local_data;
    } else if (choice === 'merge') {
      merged_data = mergeManually(conflict);
    }
    
    const result = await window.electronAPI.resolveConflict(conflictId, {
      status: 'resolved',
      user_id: currentUser.id,
      notes: `Resolved by admin: chose ${choice}`,
      merged_data: merged_data
    });
    
    if (result.success) {
      setConflicts(conflicts.filter(c => c.id !== conflictId));
    }
  };
  
  return (
    <div>
      <h2>Pending Conflicts ({conflicts.length})</h2>
      {conflicts.map(conflict => (
        <div key={conflict.id} className="conflict-card">
          <h3>{conflict.table_name}</h3>
          <div className="two-column">
            <div className="local">
              <h4>Local Version</h4>
              <pre>{JSON.stringify(conflict.local_data, null, 2)}</pre>
            </div>
            <div className="remote">
              <h4>Remote Version</h4>
              <pre>{JSON.stringify(conflict.remote_data, null, 2)}</pre>
            </div>
          </div>
          <div className="actions">
            <button onClick={() => resolveConflict(conflict.id, 'keep-local')}>
              Keep Local
            </button>
            <button onClick={() => resolveConflict(conflict.id, 'keep-remote')}>
              Keep Remote
            </button>
            <button onClick={() => resolveConflict(conflict.id, 'merge')}>
              Merge
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
```

---

## Sync Tables

**All these tables support offline-first sync:**

| Table | Purpose | Key Sync Columns |
|-------|---------|-----------------|
| `users` | Offline user data | `local_modified`, `synced_at`, `remote_id` |
| `tension_records` | Tension measurements | `local_modified`, `synced_at`, `remote_id` |
| `twisting_measurements` | Spindle measurements | `local_modified`, `synced_at`, `remote_id` |
| `weaving_measurements` | Weaving grid data | `local_modified`, `synced_at`, `remote_id` |
| `tension_problems` | Issues found | `local_modified`, `synced_at`, `remote_id` |
| `stock_taking_records` | Stock session data | `local_modified`, `synced_at`, `remote_id` |
| `finish_earlier_records` | Early finish records | `local_modified`, `synced_at`, `remote_id` |

---

## Sync Logging

**Every sync operation is logged for audit trail:**

```sql
sync_transport_logs table:
┌────┬────────────┬──────────┬──────────────┬────────┬────────┐
│ id │ sync_dir.. │ table... │ record_id... │ action │ status │
├────┼────────────┼──────────┼──────────────┼────────┼────────┤
│ 1  │ upload     │ tension..│ 1            │ create │ success│
│ 2  │ upload     │ tension..│ 2            │ update │ failed │
│ 3  │ download   │ tension..│ 3            │ update │ success│
└────┴────────────┴──────────┴──────────────┴────────┴────────┘
```

**View Sync Log in Electron Menu:**

```
File → Data Sync → View Sync Log
```

Shows:
- Direction (upload/download)
- Table affected
- Record ID
- Action (create/update/delete)
- Status (success/failed/conflict)
- Timestamp
- Error message (if failed)

---

## Soft Deletes

When a user deletes a record locally:

```tsx
const deleteRecord = async (recordId) => {
  // Soft delete: Mark with deleted_at
  const result = await window.electronAPI.dbExecute(
    `UPDATE tension_records 
     SET deleted_at = datetime('now'), 
         local_modified = 1
     WHERE id = ?`,
    [recordId]
  );
  
  // On next sync, send delete to server
  // Server also soft deletes, maintaining referential integrity
};
```

---

## Best Practices

### 1. **Always Check for Electron**

```tsx
const isElectron = await window.electronAPI?.isElectron?.();

if (isElectron) {
  // Use local DB
  const result = await window.electronAPI.dbExecute(...);
} else {
  // Use API only (web version)
  const response = await fetch('/api/...');
}
```

### 2. **Handle Network State**

```tsx
window.addEventListener('online', () => {
  console.log('Online! Starting sync...');
  performSync();
});

window.addEventListener('offline', () => {
  console.log('Offline. Using local DB.');
  setMode('offline');
});
```

### 3. **Use Batch Operations**

Instead of:
```tsx
// ❌ Bad: N separate IPC calls
for (let record of records) {
  await window.electronAPI.dbExecute(
    'INSERT INTO ...', 
    [...]
  );
}
```

Do:
```tsx
// ✅ Good: 1 batch IPC call
const queries = records.map(r => ({
  sql: 'INSERT INTO ...',
  params: [...]
}));
await window.electronAPI.dbBatchExecute(queries);
```

### 4. **Always Log Sync Operations**

```tsx
await window.electronAPI.logSyncTransport({
  sync_direction: 'upload',
  table_name: 'tension_records',
  record_id: localRecord.id,
  remote_record_id: result.remote_id,
  action: 'create',
  status: result.success ? 'success' : 'failed',
  payload: localRecord,
  error_message: error?.message
});
```

---

## Troubleshooting Sync

### Sync Stuck on "Pending"

1. Check network connectivity
2. Check Laravel server is running: `php artisan serve`
3. Check IPC logs in DevTools console
4. Force reload: Ctrl+Shift+R

### Data Not Syncing

Check sync logs:
```tsx
const logs = await window.electronAPI.getSyncLogs(100);
console.table(logs.data);
```

Look for:
- Status: 'failed' → check error_message
- Status: 'conflict' → resolve in admin panel
- Status: 'pending' → trigger sync again

### Duplicate Records After Sync

**Cause**: Local ID and remote ID not mapped correctly.

**Solution**: Always map local_id → remote_id in markAsSynced:
```tsx
await window.electronAPI.markAsSynced(
  'tension_records',
  localId,      // ← Local ID (PK in local DB)
  remoteId      // ← Remote ID (PK on server)
);
```

---

## Summary

| Phase | Action | Storage | Status |
|-------|--------|---------|--------|
| **Create** | User creates record offline | Local SQLite | `local_modified=1` |
| **Upload** | Send to server API | Server DB | `synced_at=NOW` OR conflict |
| **Download** | Fetch server updates | Local SQLite | `synced_at=NOW` |
| **Resolve** | Admin resolves conflicts | Both DBs | `resolution_status=resolved` |

✅ User works offline  
✅ Data syncs automatically  
✅ Conflicts tracked and resolved  
✅ Full audit trail
