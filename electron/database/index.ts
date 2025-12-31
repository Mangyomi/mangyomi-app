import initSqlJs, { Database, QueryExecResult } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { schema } from './schema';

// Helper types to match better-sqlite3 API
interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
}

// Wrapper to mimic better-sqlite3 Statement
class StatementWrapper {
    private stmt: any;
    private dbWrapper: DatabaseWrapper;

    constructor(stmt: any, dbWrapper: DatabaseWrapper) {
        this.stmt = stmt;
        this.dbWrapper = dbWrapper;
    }

    run(...params: any[]): RunResult {
        // sql.js bind takes array or object.
        // If params is [obj], use obj. If params is variables, use array.
        // better-sqlite3: stmt.run(a, b) or stmt.run({a:1, b:2})

        let bindParams = params;
        if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null) {
            bindParams = params[0];
        }

        this.stmt.run(bindParams);

        // sql.js doesn't give run stats easily for prepared statements in the same way,
        // but we can try to get modified rows if needed. 
        // For now, request a save.
        this.dbWrapper.scheduleSave();

        // Mock result - sql.js limitations
        return {
            changes: 1,
            lastInsertRowid: -1 // TODO: fetch this if critical (e.g. SELECT last_insert_rowid())
        };
    }

    get(...params: any[]): any {
        let bindParams = params;
        if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null) {
            bindParams = params[0];
        }

        // Reset statement is important in sql.js before re-binding if previously used?
        // this.stmt.reset(); // (Automatically handled by bind in many cases, but safe to do implicit reset logic if needed)
        // sql.js 'getAsObject' convenience? 
        // The stmt object has .getAsObject(params)

        this.stmt.bind(bindParams);
        if (this.stmt.step()) {
            return this.stmt.getAsObject();
        }
        return undefined;
    }

    all(...params: any[]): any[] {
        let bindParams = params;
        if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null) {
            bindParams = params[0];
        }

        this.stmt.bind(bindParams);
        const results: any[] = [];
        while (this.stmt.step()) {
            results.push(this.stmt.getAsObject());
        }
        return results;
    }
}

// Wrapper to mimic better-sqlite3 Database
class DatabaseWrapper {
    private db: Database;
    private dbPath: string;
    private saveTimeout: NodeJS.Timeout | null = null;
    private isSaving: boolean = false;
    private pendingSave: boolean = false;

    constructor(db: Database, dbPath: string) {
        this.db = db;
        this.dbPath = dbPath;
    }

    prepare(sql: string): StatementWrapper {
        const stmt = this.db.prepare(sql);
        return new StatementWrapper(stmt, this);
    }

    exec(sql: string): this {
        this.db.exec(sql);
        this.scheduleSave();
        return this;
    }

    pragma(sql: string): any {
        if (sql.toLowerCase().startsWith('foreign_keys')) {
            this.db.exec(`PRAGMA ${sql}`);
        }
        return [];
    }

    transaction(fn: (...args: any[]) => any): (...args: any[]) => any {
        return (...args: any[]) => {
            this.db.exec('BEGIN TRANSACTION');
            try {
                const result = fn(...args);
                this.db.exec('COMMIT');
                this.scheduleSave();
                return result;
            } catch (err) {
                this.db.exec('ROLLBACK');
                throw err;
            }
        };
    }

    close() {
        // Force synchronous save on close
        this.saveSync();
        this.db.close();
    }

    // Schedule a debounced async save
    scheduleSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        // Debounce for 2 seconds
        this.saveTimeout = setTimeout(() => {
            this.saveAsync();
        }, 2000);
    }

    // Async save with atomic write (write to temp then rename)
    async saveAsync() {
        if (this.isSaving) {
            this.pendingSave = true;
            return;
        }

        this.isSaving = true;

        try {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            const tempPath = `${this.dbPath}.tmp`;

            await fs.promises.writeFile(tempPath, buffer);
            await fs.promises.rename(tempPath, this.dbPath);

            // console.log('Database saved asynchronously');
        } catch (err) {
            console.error('Failed to save database async:', err);
        } finally {
            this.isSaving = false;
            if (this.pendingSave) {
                this.pendingSave = false;
                this.scheduleSave();
            }
        }
    }

    // Synchronous save for app exit
    saveSync() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }

        try {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            const tempPath = `${this.dbPath}.tmp`;

            fs.writeFileSync(tempPath, buffer);
            fs.renameSync(tempPath, this.dbPath);
            console.log('Database saved synchronously on close');
        } catch (err) {
            console.error('Failed to save database sync:', err);
        }
    }
}

let dbWrapper: DatabaseWrapper | null = null;

export async function initDatabase(dbPath: string): Promise<DatabaseWrapper> {
    // Determine WASM path (needs to be available in build)
    // In dev: node_modules/sql.js/dist/sql-wasm.wasm
    // In prod: bundled via Vite

    const SQL = await initSqlJs();

    let buffer: Buffer | undefined;

    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Cleanup temp files
    const tempPath = `${dbPath}.tmp`;
    if (fs.existsSync(tempPath)) {
        try {
            fs.unlinkSync(tempPath);
            console.log('Cleaned up leftover temp database file');
        } catch (e) {
            console.error('Failed to clean up temp database file:', e);
        }
    }

    if (fs.existsSync(dbPath)) {
        buffer = fs.readFileSync(dbPath);
    }

    const db = new SQL.Database(buffer);
    dbWrapper = new DatabaseWrapper(db, dbPath);

    // Initial setup if new
    if (!buffer) {
        dbWrapper.exec(schema);
    }

    // Enable foreign keys
    dbWrapper.exec('PRAGMA foreign_keys = ON');

    // Migration: Add in_library column if it doesn't exist
    try {
        const tableInfo = dbWrapper.prepare("PRAGMA table_info(manga)").all();
        const hasInLibrary = tableInfo.some((col: any) => col.name === 'in_library');

        if (!hasInLibrary) {
            console.log('Migrating database: adding in_library column to manga table');
            dbWrapper.exec('ALTER TABLE manga ADD COLUMN in_library INTEGER DEFAULT 0');
            // Set all existing manga to be in library (restore previous behavior)
            dbWrapper.exec('UPDATE manga SET in_library = 1');
        }
    } catch (error) {
        console.error('Migration failed:', error);
    }

    // Migration: Create image_cache table if it doesn't exist
    try {
        const hasImageCache = dbWrapper.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='image_cache'").get();
        if (!hasImageCache) {
            console.log('Migrating database: creating image_cache table');
            dbWrapper.exec(`
                CREATE TABLE IF NOT EXISTS image_cache (
                  url TEXT PRIMARY KEY,
                  hash TEXT NOT NULL,
                  manga_id TEXT NOT NULL,
                  chapter_id TEXT NOT NULL,
                  size INTEGER,
                  cached_at INTEGER DEFAULT (strftime('%s', 'now'))
                );
                CREATE INDEX IF NOT EXISTS idx_cache_chapter ON image_cache(chapter_id);
             `);
        }
    } catch (error) {
        console.error('Image Cache Migration failed:', error);
    }

    console.log('Database initialized at:', dbPath);
    return dbWrapper;
}

export function getDatabase(): DatabaseWrapper {
    if (!dbWrapper) {
        throw new Error('Database not initialized. Call initDatabase first.');
    }
    return dbWrapper;
}

export function closeDatabase(): void {
    if (dbWrapper) {
        dbWrapper.close();
        dbWrapper = null;
    }
}

