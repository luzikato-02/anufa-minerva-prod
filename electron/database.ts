import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export class LocalDatabase {
    private db: Database.Database | null = null;
    private dbPath: string;

    constructor(userDataPath: string) {
        this.dbPath = path.join(userDataPath, 'local_data.db');
    }

    async initialize(): Promise<void> {
        // Ensure directory exists
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        
        this.createTables();
        console.log('Local database initialized at:', this.dbPath);
    }

    private createTables(): void {
        if (!this.db) throw new Error('Database not initialized');

        // Tension Records table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tension_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_type TEXT NOT NULL CHECK(record_type IN ('twisting', 'weaving')),
                csv_data TEXT NOT NULL,
                form_data TEXT NOT NULL,
                measurement_data TEXT NOT NULL,
                problems TEXT,
                metadata TEXT NOT NULL,
                user_id INTEGER,
                remote_id INTEGER,
                sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('synced', 'pending', 'conflict')),
                last_synced_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                deleted_at TEXT
            );
            
            CREATE INDEX IF NOT EXISTS idx_tension_record_type ON tension_records(record_type);
            CREATE INDEX IF NOT EXISTS idx_tension_sync_status ON tension_records(sync_status);
            CREATE INDEX IF NOT EXISTS idx_tension_remote_id ON tension_records(remote_id);
            CREATE INDEX IF NOT EXISTS idx_tension_created_at ON tension_records(created_at);
        `);

        // Stock Taking Records table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS stock_taking_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE,
                indv_batch_data TEXT NOT NULL,
                recorded_batches TEXT,
                metadata TEXT NOT NULL,
                stock_take_summary TEXT,
                user_id INTEGER,
                remote_id INTEGER,
                sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('synced', 'pending', 'conflict')),
                last_synced_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                deleted_at TEXT
            );
            
            CREATE INDEX IF NOT EXISTS idx_stocktake_session_id ON stock_taking_records(session_id);
            CREATE INDEX IF NOT EXISTS idx_stocktake_sync_status ON stock_taking_records(sync_status);
            CREATE INDEX IF NOT EXISTS idx_stocktake_remote_id ON stock_taking_records(remote_id);
            CREATE INDEX IF NOT EXISTS idx_stocktake_created_at ON stock_taking_records(created_at);
        `);

        // Finish Earlier Records table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS finish_earlier_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                metadata TEXT NOT NULL,
                entries TEXT NOT NULL,
                remote_id INTEGER,
                sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('synced', 'pending', 'conflict')),
                last_synced_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            
            CREATE INDEX IF NOT EXISTS idx_finishearlier_sync_status ON finish_earlier_records(sync_status);
            CREATE INDEX IF NOT EXISTS idx_finishearlier_remote_id ON finish_earlier_records(remote_id);
            CREATE INDEX IF NOT EXISTS idx_finishearlier_created_at ON finish_earlier_records(created_at);
        `);

        // Sync settings table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sync_settings (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                server_url TEXT NOT NULL DEFAULT '',
                auth_token TEXT NOT NULL DEFAULT '',
                auto_sync INTEGER DEFAULT 0,
                sync_interval_minutes INTEGER DEFAULT 30,
                sync_on_startup INTEGER DEFAULT 1,
                sync_tension_records INTEGER DEFAULT 1,
                sync_stock_take_records INTEGER DEFAULT 1,
                sync_finish_earlier_records INTEGER DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            
            INSERT OR IGNORE INTO sync_settings (id) VALUES (1);
        `);

        // Sync history table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sync_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sync_type TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('success', 'partial', 'failed')),
                uploaded INTEGER DEFAULT 0,
                downloaded INTEGER DEFAULT 0,
                conflicts INTEGER DEFAULT 0,
                errors TEXT,
                started_at TEXT NOT NULL,
                completed_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            
            CREATE INDEX IF NOT EXISTS idx_sync_history_completed ON sync_history(completed_at);
        `);

        // Sync conflicts table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sync_conflicts (
                id TEXT PRIMARY KEY,
                table_name TEXT NOT NULL,
                record_id INTEGER NOT NULL,
                local_data TEXT NOT NULL,
                remote_data TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        `);
    }

    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    getDatabaseInfo(): { path: string; size: number; tables: { name: string; count: number }[]; lastModified: string } {
        if (!this.db) throw new Error('Database not initialized');

        const stats = fs.statSync(this.dbPath);
        
        const tables = [
            { name: 'tension_records', count: this.db.prepare('SELECT COUNT(*) as count FROM tension_records WHERE deleted_at IS NULL').get() as { count: number } },
            { name: 'stock_taking_records', count: this.db.prepare('SELECT COUNT(*) as count FROM stock_taking_records WHERE deleted_at IS NULL').get() as { count: number } },
            { name: 'finish_earlier_records', count: this.db.prepare('SELECT COUNT(*) as count FROM finish_earlier_records').get() as { count: number } },
        ];

        return {
            path: this.dbPath,
            size: stats.size,
            tables: tables.map(t => ({ name: t.name, count: t.count.count })),
            lastModified: stats.mtime.toISOString(),
        };
    }

    // ============ TENSION RECORDS ============

    getTensionRecords(options?: { type?: string; page?: number; perPage?: number }): {
        data: any[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    } {
        if (!this.db) throw new Error('Database not initialized');

        const page = options?.page || 1;
        const perPage = options?.perPage || 10;
        const offset = (page - 1) * perPage;

        let whereClause = 'WHERE deleted_at IS NULL';
        const params: any[] = [];

        if (options?.type) {
            whereClause += ' AND record_type = ?';
            params.push(options.type);
        }

        const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM tension_records ${whereClause}`);
        const { total } = countStmt.get(...params) as { total: number };

        const dataStmt = this.db.prepare(`
            SELECT * FROM tension_records 
            ${whereClause}
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `);
        
        const rows = dataStmt.all(...params, perPage, offset) as any[];

        return {
            data: rows.map(row => this.parseTensionRecord(row)),
            current_page: page,
            last_page: Math.ceil(total / perPage),
            per_page: perPage,
            total,
        };
    }

    getTensionRecordById(id: number): any | null {
        if (!this.db) throw new Error('Database not initialized');

        const stmt = this.db.prepare('SELECT * FROM tension_records WHERE id = ? AND deleted_at IS NULL');
        const row = stmt.get(id) as any;
        return row ? this.parseTensionRecord(row) : null;
    }

    getTensionRecordByRemoteId(remoteId: number): any | null {
        if (!this.db) throw new Error('Database not initialized');

        const stmt = this.db.prepare('SELECT * FROM tension_records WHERE remote_id = ? AND deleted_at IS NULL');
        const row = stmt.get(remoteId) as any;
        return row ? this.parseTensionRecord(row) : null;
    }

    createTensionRecord(record: any): { success: boolean; id?: number; error?: string } {
        if (!this.db) return { success: false, error: 'Database not initialized' };

        try {
            const stmt = this.db.prepare(`
                INSERT INTO tension_records (
                    record_type, csv_data, form_data, measurement_data, problems, metadata, 
                    user_id, remote_id, sync_status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `);

            const result = stmt.run(
                record.record_type,
                record.csv_data,
                JSON.stringify(record.form_data),
                JSON.stringify(record.measurement_data),
                JSON.stringify(record.problems || []),
                JSON.stringify(record.metadata),
                record.user_id || null,
                record.remote_id || null,
                record.sync_status || 'pending'
            );

            return { success: true, id: result.lastInsertRowid as number };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    updateTensionRecord(id: number, record: any): { success: boolean; error?: string } {
        if (!this.db) return { success: false, error: 'Database not initialized' };

        try {
            const updates: string[] = [];
            const values: any[] = [];

            if (record.record_type !== undefined) {
                updates.push('record_type = ?');
                values.push(record.record_type);
            }
            if (record.csv_data !== undefined) {
                updates.push('csv_data = ?');
                values.push(record.csv_data);
            }
            if (record.form_data !== undefined) {
                updates.push('form_data = ?');
                values.push(JSON.stringify(record.form_data));
            }
            if (record.measurement_data !== undefined) {
                updates.push('measurement_data = ?');
                values.push(JSON.stringify(record.measurement_data));
            }
            if (record.problems !== undefined) {
                updates.push('problems = ?');
                values.push(JSON.stringify(record.problems));
            }
            if (record.metadata !== undefined) {
                updates.push('metadata = ?');
                values.push(JSON.stringify(record.metadata));
            }
            if (record.remote_id !== undefined) {
                updates.push('remote_id = ?');
                values.push(record.remote_id);
            }
            if (record.sync_status !== undefined) {
                updates.push('sync_status = ?');
                values.push(record.sync_status);
            }
            if (record.last_synced_at !== undefined) {
                updates.push('last_synced_at = ?');
                values.push(record.last_synced_at);
            }

            updates.push('updated_at = datetime("now")');
            values.push(id);

            const stmt = this.db.prepare(`UPDATE tension_records SET ${updates.join(', ')} WHERE id = ?`);
            stmt.run(...values);

            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    deleteTensionRecord(id: number): { success: boolean; error?: string } {
        if (!this.db) return { success: false, error: 'Database not initialized' };

        try {
            const stmt = this.db.prepare(`UPDATE tension_records SET deleted_at = datetime('now'), sync_status = 'pending' WHERE id = ?`);
            stmt.run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    getPendingTensionRecords(): any[] {
        if (!this.db) throw new Error('Database not initialized');

        const stmt = this.db.prepare(`SELECT * FROM tension_records WHERE sync_status = 'pending'`);
        return (stmt.all() as any[]).map(row => this.parseTensionRecord(row));
    }

    private parseTensionRecord(row: any): any {
        return {
            ...row,
            form_data: JSON.parse(row.form_data || '{}'),
            measurement_data: JSON.parse(row.measurement_data || '{}'),
            problems: JSON.parse(row.problems || '[]'),
            metadata: JSON.parse(row.metadata || '{}'),
        };
    }

    // ============ STOCK TAKING RECORDS ============

    getStockTakeRecords(options?: { page?: number; perPage?: number }): {
        data: any[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    } {
        if (!this.db) throw new Error('Database not initialized');

        const page = options?.page || 1;
        const perPage = options?.perPage || 10;
        const offset = (page - 1) * perPage;

        const countStmt = this.db.prepare('SELECT COUNT(*) as total FROM stock_taking_records WHERE deleted_at IS NULL');
        const { total } = countStmt.get() as { total: number };

        const dataStmt = this.db.prepare(`
            SELECT * FROM stock_taking_records 
            WHERE deleted_at IS NULL
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `);
        
        const rows = dataStmt.all(perPage, offset) as any[];

        return {
            data: rows.map(row => this.parseStockTakeRecord(row)),
            current_page: page,
            last_page: Math.ceil(total / perPage),
            per_page: perPage,
            total,
        };
    }

    getStockTakeRecordById(id: number): any | null {
        if (!this.db) throw new Error('Database not initialized');

        const stmt = this.db.prepare('SELECT * FROM stock_taking_records WHERE id = ? AND deleted_at IS NULL');
        const row = stmt.get(id) as any;
        return row ? this.parseStockTakeRecord(row) : null;
    }

    getStockTakeRecordBySessionId(sessionId: string): any | null {
        if (!this.db) throw new Error('Database not initialized');

        const stmt = this.db.prepare('SELECT * FROM stock_taking_records WHERE session_id = ? AND deleted_at IS NULL');
        const row = stmt.get(sessionId) as any;
        return row ? this.parseStockTakeRecord(row) : null;
    }

    getStockTakeRecordByRemoteId(remoteId: number): any | null {
        if (!this.db) throw new Error('Database not initialized');

        const stmt = this.db.prepare('SELECT * FROM stock_taking_records WHERE remote_id = ? AND deleted_at IS NULL');
        const row = stmt.get(remoteId) as any;
        return row ? this.parseStockTakeRecord(row) : null;
    }

    createStockTakeRecord(record: any): { success: boolean; id?: number; error?: string } {
        if (!this.db) return { success: false, error: 'Database not initialized' };

        try {
            const stmt = this.db.prepare(`
                INSERT INTO stock_taking_records (
                    session_id, indv_batch_data, recorded_batches, metadata, stock_take_summary,
                    user_id, remote_id, sync_status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `);

            const result = stmt.run(
                record.session_id || this.generateSessionId(),
                JSON.stringify(record.indv_batch_data || []),
                JSON.stringify(record.recorded_batches || []),
                JSON.stringify(record.metadata || {}),
                JSON.stringify(record.stock_take_summary || []),
                record.user_id || null,
                record.remote_id || null,
                record.sync_status || 'pending'
            );

            return { success: true, id: result.lastInsertRowid as number };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    updateStockTakeRecord(id: number, record: any): { success: boolean; error?: string } {
        if (!this.db) return { success: false, error: 'Database not initialized' };

        try {
            const updates: string[] = [];
            const values: any[] = [];

            if (record.session_id !== undefined) {
                updates.push('session_id = ?');
                values.push(record.session_id);
            }
            if (record.indv_batch_data !== undefined) {
                updates.push('indv_batch_data = ?');
                values.push(JSON.stringify(record.indv_batch_data));
            }
            if (record.recorded_batches !== undefined) {
                updates.push('recorded_batches = ?');
                values.push(JSON.stringify(record.recorded_batches));
            }
            if (record.metadata !== undefined) {
                updates.push('metadata = ?');
                values.push(JSON.stringify(record.metadata));
            }
            if (record.stock_take_summary !== undefined) {
                updates.push('stock_take_summary = ?');
                values.push(JSON.stringify(record.stock_take_summary));
            }
            if (record.remote_id !== undefined) {
                updates.push('remote_id = ?');
                values.push(record.remote_id);
            }
            if (record.sync_status !== undefined) {
                updates.push('sync_status = ?');
                values.push(record.sync_status);
            }
            if (record.last_synced_at !== undefined) {
                updates.push('last_synced_at = ?');
                values.push(record.last_synced_at);
            }

            updates.push('updated_at = datetime("now")');
            values.push(id);

            const stmt = this.db.prepare(`UPDATE stock_taking_records SET ${updates.join(', ')} WHERE id = ?`);
            stmt.run(...values);

            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    deleteStockTakeRecord(id: number): { success: boolean; error?: string } {
        if (!this.db) return { success: false, error: 'Database not initialized' };

        try {
            const stmt = this.db.prepare(`UPDATE stock_taking_records SET deleted_at = datetime('now'), sync_status = 'pending' WHERE id = ?`);
            stmt.run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    getPendingStockTakeRecords(): any[] {
        if (!this.db) throw new Error('Database not initialized');

        const stmt = this.db.prepare(`SELECT * FROM stock_taking_records WHERE sync_status = 'pending'`);
        return (stmt.all() as any[]).map(row => this.parseStockTakeRecord(row));
    }

    private parseStockTakeRecord(row: any): any {
        return {
            ...row,
            indv_batch_data: JSON.parse(row.indv_batch_data || '[]'),
            recorded_batches: JSON.parse(row.recorded_batches || '[]'),
            metadata: JSON.parse(row.metadata || '{}'),
            stock_take_summary: JSON.parse(row.stock_take_summary || '[]'),
        };
    }

    private generateSessionId(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // ============ FINISH EARLIER RECORDS ============

    getFinishEarlierRecords(options?: { page?: number; perPage?: number }): {
        data: any[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    } {
        if (!this.db) throw new Error('Database not initialized');

        const page = options?.page || 1;
        const perPage = options?.perPage || 10;
        const offset = (page - 1) * perPage;

        const countStmt = this.db.prepare('SELECT COUNT(*) as total FROM finish_earlier_records');
        const { total } = countStmt.get() as { total: number };

        const dataStmt = this.db.prepare(`
            SELECT * FROM finish_earlier_records 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `);
        
        const rows = dataStmt.all(perPage, offset) as any[];

        return {
            data: rows.map(row => this.parseFinishEarlierRecord(row)),
            current_page: page,
            last_page: Math.ceil(total / perPage),
            per_page: perPage,
            total,
        };
    }

    getFinishEarlierRecordById(id: number): any | null {
        if (!this.db) throw new Error('Database not initialized');

        const stmt = this.db.prepare('SELECT * FROM finish_earlier_records WHERE id = ?');
        const row = stmt.get(id) as any;
        return row ? this.parseFinishEarlierRecord(row) : null;
    }

    getFinishEarlierRecordByProductionOrder(productionOrder: string): any | null {
        if (!this.db) throw new Error('Database not initialized');

        const stmt = this.db.prepare(`
            SELECT * FROM finish_earlier_records 
            WHERE json_extract(metadata, '$.production_order') = ?
        `);
        const row = stmt.get(productionOrder) as any;
        return row ? this.parseFinishEarlierRecord(row) : null;
    }

    getFinishEarlierRecordByRemoteId(remoteId: number): any | null {
        if (!this.db) throw new Error('Database not initialized');

        const stmt = this.db.prepare('SELECT * FROM finish_earlier_records WHERE remote_id = ?');
        const row = stmt.get(remoteId) as any;
        return row ? this.parseFinishEarlierRecord(row) : null;
    }

    createFinishEarlierRecord(record: any): { success: boolean; id?: number; error?: string } {
        if (!this.db) return { success: false, error: 'Database not initialized' };

        try {
            const stmt = this.db.prepare(`
                INSERT INTO finish_earlier_records (
                    metadata, entries, remote_id, sync_status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
            `);

            const result = stmt.run(
                JSON.stringify(record.metadata || {}),
                JSON.stringify(record.entries || []),
                record.remote_id || null,
                record.sync_status || 'pending'
            );

            return { success: true, id: result.lastInsertRowid as number };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    updateFinishEarlierRecord(id: number, record: any): { success: boolean; error?: string } {
        if (!this.db) return { success: false, error: 'Database not initialized' };

        try {
            const updates: string[] = [];
            const values: any[] = [];

            if (record.metadata !== undefined) {
                updates.push('metadata = ?');
                values.push(JSON.stringify(record.metadata));
            }
            if (record.entries !== undefined) {
                updates.push('entries = ?');
                values.push(JSON.stringify(record.entries));
            }
            if (record.remote_id !== undefined) {
                updates.push('remote_id = ?');
                values.push(record.remote_id);
            }
            if (record.sync_status !== undefined) {
                updates.push('sync_status = ?');
                values.push(record.sync_status);
            }
            if (record.last_synced_at !== undefined) {
                updates.push('last_synced_at = ?');
                values.push(record.last_synced_at);
            }

            updates.push('updated_at = datetime("now")');
            values.push(id);

            const stmt = this.db.prepare(`UPDATE finish_earlier_records SET ${updates.join(', ')} WHERE id = ?`);
            stmt.run(...values);

            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    deleteFinishEarlierRecord(id: number): { success: boolean; error?: string } {
        if (!this.db) return { success: false, error: 'Database not initialized' };

        try {
            const stmt = this.db.prepare('DELETE FROM finish_earlier_records WHERE id = ?');
            stmt.run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    getPendingFinishEarlierRecords(): any[] {
        if (!this.db) throw new Error('Database not initialized');

        const stmt = this.db.prepare(`SELECT * FROM finish_earlier_records WHERE sync_status = 'pending'`);
        return (stmt.all() as any[]).map(row => this.parseFinishEarlierRecord(row));
    }

    private parseFinishEarlierRecord(row: any): any {
        return {
            ...row,
            metadata: JSON.parse(row.metadata || '{}'),
            entries: JSON.parse(row.entries || '[]'),
        };
    }

    // ============ SYNC SETTINGS ============

    getSyncSettings(): any {
        if (!this.db) throw new Error('Database not initialized');

        const stmt = this.db.prepare('SELECT * FROM sync_settings WHERE id = 1');
        const row = stmt.get() as any;
        
        return {
            serverUrl: row?.server_url || '',
            authToken: row?.auth_token || '',
            autoSync: !!row?.auto_sync,
            syncIntervalMinutes: row?.sync_interval_minutes || 30,
            syncOnStartup: !!row?.sync_on_startup,
            syncTensionRecords: !!row?.sync_tension_records,
            syncStockTakeRecords: !!row?.sync_stock_take_records,
            syncFinishEarlierRecords: !!row?.sync_finish_earlier_records,
        };
    }

    updateSyncSettings(settings: any): { success: boolean; error?: string } {
        if (!this.db) return { success: false, error: 'Database not initialized' };

        try {
            const updates: string[] = [];
            const values: any[] = [];

            if (settings.serverUrl !== undefined) {
                updates.push('server_url = ?');
                values.push(settings.serverUrl);
            }
            if (settings.authToken !== undefined) {
                updates.push('auth_token = ?');
                values.push(settings.authToken);
            }
            if (settings.autoSync !== undefined) {
                updates.push('auto_sync = ?');
                values.push(settings.autoSync ? 1 : 0);
            }
            if (settings.syncIntervalMinutes !== undefined) {
                updates.push('sync_interval_minutes = ?');
                values.push(settings.syncIntervalMinutes);
            }
            if (settings.syncOnStartup !== undefined) {
                updates.push('sync_on_startup = ?');
                values.push(settings.syncOnStartup ? 1 : 0);
            }
            if (settings.syncTensionRecords !== undefined) {
                updates.push('sync_tension_records = ?');
                values.push(settings.syncTensionRecords ? 1 : 0);
            }
            if (settings.syncStockTakeRecords !== undefined) {
                updates.push('sync_stock_take_records = ?');
                values.push(settings.syncStockTakeRecords ? 1 : 0);
            }
            if (settings.syncFinishEarlierRecords !== undefined) {
                updates.push('sync_finish_earlier_records = ?');
                values.push(settings.syncFinishEarlierRecords ? 1 : 0);
            }

            if (updates.length > 0) {
                updates.push('updated_at = datetime("now")');
                const stmt = this.db.prepare(`UPDATE sync_settings SET ${updates.join(', ')} WHERE id = 1`);
                stmt.run(...values);
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    // ============ SYNC HISTORY ============

    addSyncHistory(entry: {
        syncType: string;
        status: 'success' | 'partial' | 'failed';
        uploaded: number;
        downloaded: number;
        conflicts: number;
        errors: string[];
        startedAt: string;
    }): { success: boolean; id?: number; error?: string } {
        if (!this.db) return { success: false, error: 'Database not initialized' };

        try {
            const stmt = this.db.prepare(`
                INSERT INTO sync_history (sync_type, status, uploaded, downloaded, conflicts, errors, started_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                entry.syncType,
                entry.status,
                entry.uploaded,
                entry.downloaded,
                entry.conflicts,
                JSON.stringify(entry.errors),
                entry.startedAt
            );

            return { success: true, id: result.lastInsertRowid as number };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    getSyncHistory(limit = 20): any[] {
        if (!this.db) throw new Error('Database not initialized');

        const stmt = this.db.prepare(`
            SELECT * FROM sync_history 
            ORDER BY completed_at DESC 
            LIMIT ?
        `);
        
        const rows = stmt.all(limit) as any[];
        return rows.map(row => ({
            ...row,
            errors: JSON.parse(row.errors || '[]'),
        }));
    }

    // ============ SYNC CONFLICTS ============

    addSyncConflict(conflict: {
        id: string;
        tableName: string;
        recordId: number;
        localData: any;
        remoteData: any;
    }): { success: boolean; error?: string } {
        if (!this.db) return { success: false, error: 'Database not initialized' };

        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO sync_conflicts (id, table_name, record_id, local_data, remote_data)
                VALUES (?, ?, ?, ?, ?)
            `);

            stmt.run(
                conflict.id,
                conflict.tableName,
                conflict.recordId,
                JSON.stringify(conflict.localData),
                JSON.stringify(conflict.remoteData)
            );

            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    getSyncConflicts(): any[] {
        if (!this.db) throw new Error('Database not initialized');

        const stmt = this.db.prepare('SELECT * FROM sync_conflicts ORDER BY created_at DESC');
        const rows = stmt.all() as any[];
        
        return rows.map(row => ({
            id: row.id,
            tableName: row.table_name,
            recordId: row.record_id,
            localData: JSON.parse(row.local_data),
            remoteData: JSON.parse(row.remote_data),
            createdAt: row.created_at,
        }));
    }

    removeSyncConflict(id: string): { success: boolean; error?: string } {
        if (!this.db) return { success: false, error: 'Database not initialized' };

        try {
            const stmt = this.db.prepare('DELETE FROM sync_conflicts WHERE id = ?');
            stmt.run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    getPendingCount(): { tension: number; stocktake: number; finishearlier: number } {
        if (!this.db) throw new Error('Database not initialized');

        const tensionStmt = this.db.prepare(`SELECT COUNT(*) as count FROM tension_records WHERE sync_status = 'pending'`);
        const stocktakeStmt = this.db.prepare(`SELECT COUNT(*) as count FROM stock_taking_records WHERE sync_status = 'pending'`);
        const finishEarlierStmt = this.db.prepare(`SELECT COUNT(*) as count FROM finish_earlier_records WHERE sync_status = 'pending'`);

        return {
            tension: (tensionStmt.get() as { count: number }).count,
            stocktake: (stocktakeStmt.get() as { count: number }).count,
            finishearlier: (finishEarlierStmt.get() as { count: number }).count,
        };
    }
}
