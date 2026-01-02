import initSqlJs, { Database, QueryExecResult } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { schema } from './schema';

interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
}

class StatementWrapper {
    private stmt: any;
    private dbWrapper: DatabaseWrapper;

    constructor(stmt: any, dbWrapper: DatabaseWrapper) {
        this.stmt = stmt;
        this.dbWrapper = dbWrapper;
    }

    run(...params: any[]): RunResult {
        let bindParams = params;
        if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null) {
            bindParams = params[0];
        }

        this.stmt.run(bindParams);
        this.dbWrapper.scheduleSave();

        return {
            changes: 1,
            lastInsertRowid: -1
        };
    }

    get(...params: any[]): any {
        let bindParams = params;
        if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null) {
            bindParams = params[0];
        }

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
        this.saveSync();
        this.db.close();
    }

    // Schedule a debounced async save - reduced delay for safety
    scheduleSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        // Reduced debounce to 500ms for faster saves
        this.saveTimeout = setTimeout(() => {
            this.saveAsync();
        }, 500);
    }

    // Async save with atomic write and validation
    async saveAsync() {
        if (this.isSaving) {
            this.pendingSave = true;
            return;
        }

        this.isSaving = true;

        try {
            const data = this.db.export();
            const buffer = Buffer.from(data);

            // Validate the data looks like a valid SQLite database before saving
            const header = buffer.slice(0, 16).toString('utf8');
            if (!header.startsWith('SQLite format 3')) {
                console.error('Database export validation failed - refusing to save corrupt data');
                return;
            }

            const tempPath = `${this.dbPath}.tmp`;

            await fs.promises.writeFile(tempPath, buffer);

            // Verify temp file was written correctly before replacing
            const writtenBuffer = await fs.promises.readFile(tempPath);
            if (writtenBuffer.length !== buffer.length) {
                console.error('Database save verification failed - file size mismatch');
                return;
            }

            await fs.promises.rename(tempPath, this.dbPath);

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

            // Validate the data looks like a valid SQLite database before saving
            const header = buffer.slice(0, 16).toString('utf8');
            if (!header.startsWith('SQLite format 3')) {
                console.error('Database export validation failed - refusing to save corrupt data');
                return;
            }

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

        // Validate the loaded database
        const header = buffer.slice(0, 16).toString('utf8');
        if (!header.startsWith('SQLite format 3')) {
            console.error('Database file is corrupted (invalid header). Creating new database.');
            // Create backup of corrupted file for investigation
            const corruptBackup = `${dbPath}.corrupt.${Date.now()}`;
            try {
                fs.copyFileSync(dbPath, corruptBackup);
                console.log('Corrupted database backed up to:', corruptBackup);
            } catch (e) {
                console.error('Failed to backup corrupted database:', e);
            }
            buffer = undefined; // Will create fresh database
        } else {
            // Create a backup of the working database
            const backupPath = `${dbPath}.backup`;
            try {
                fs.copyFileSync(dbPath, backupPath);
            } catch (e) {
                console.error('Failed to create database backup:', e);
            }
        }
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

    // Migration: Add anilist_id column if it doesn't exist
    try {
        const tableInfo = dbWrapper.prepare("PRAGMA table_info(manga)").all();
        const hasAnilistId = tableInfo.some((col: any) => col.name === 'anilist_id');

        if (!hasAnilistId) {
            console.log('Migrating database: adding anilist_id column to manga table');
            dbWrapper.exec('ALTER TABLE manga ADD COLUMN anilist_id INTEGER');
        }
    } catch (error) {
        console.error('AniList migration failed:', error);
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
