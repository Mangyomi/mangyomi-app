import { app, net, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getDatabase } from '../database';

class ImageCache {
    private cacheDir: string;
    private coverCacheDir: string;
    private initialized: boolean = false;
    private maxCacheSize: number = 1024 * 1024 * 1024; // Default 1GB
    private isPruning: boolean = false;
    private coverTTL: number = 24 * 60 * 60; // 24 hours in seconds

    constructor() {
        this.cacheDir = path.join(app.getPath('userData'), 'cache', 'images');
        this.coverCacheDir = path.join(app.getPath('userData'), 'cache', 'covers');
    }

    init() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
        if (!fs.existsSync(this.coverCacheDir)) {
            fs.mkdirSync(this.coverCacheDir, { recursive: true });
        }
        this.initialized = true;
    }

    setLimit(bytes: number) {
        this.maxCacheSize = bytes;
        this.prune(); // Prune immediately if new limit is smaller
    }

    getCacheSize(): number {
        const parentCacheDir = path.dirname(this.cacheDir);
        if (!fs.existsSync(parentCacheDir)) return 0;

        let totalSize = 0;
        const walkDir = (dir: string) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walkDir(fullPath);
                } else {
                    try {
                        totalSize += fs.statSync(fullPath).size;
                    } catch (e) {
                        // File might be deleted during walk (race condition), ignore
                    }
                }
            }
        };
        walkDir(parentCacheDir);
        return totalSize;
    }

    getCachedImagePath(url: string): string | null {
        if (!this.initialized) this.init();

        const hash = crypto.createHash('sha256').update(url).digest('hex');
        const filePath = path.join(this.cacheDir, hash);

        if (fs.existsSync(filePath)) {
            // Touch cached_at to mark as recently used
            try {
                const db = getDatabase();
                db.prepare('UPDATE image_cache SET cached_at = strftime(\'%s\', \'now\') WHERE url = ?').run(url);
            } catch (e) { /* ignore db lock errors on read */ }
            return filePath;
        }
        return null;
    }

    // Cover caching with TTL
    getCachedCoverPath(url: string): string | null {
        if (!this.initialized) this.init();

        const hash = crypto.createHash('sha256').update(url).digest('hex');
        const metaPath = path.join(this.coverCacheDir, `${hash}.meta`);

        if (fs.existsSync(metaPath)) {
            try {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                const now = Math.floor(Date.now() / 1000);

                // Check if TTL has expired
                if (meta.cachedAt + this.coverTTL > now) {
                    // Use stored filePath or fallback to .jpg
                    const filePath = meta.filePath || path.join(this.coverCacheDir, `${hash}.jpg`);
                    if (fs.existsSync(filePath)) {
                        return filePath; // Still valid
                    }
                }
                // Expired or file missing - cleanup
                try { fs.unlinkSync(metaPath); } catch (e) { }
                try { fs.unlinkSync(path.join(this.coverCacheDir, `${hash}.jpg`)); } catch (e) { }
                try { fs.unlinkSync(path.join(this.coverCacheDir, hash)); } catch (e) { }
            } catch (e) {
                // Invalid meta
                try { fs.unlinkSync(metaPath); } catch (e) { }
            }
        }
        return null;
    }

    async saveCover(url: string, headers: Record<string, string>): Promise<string> {
        if (!this.initialized) this.init();

        const hash = crypto.createHash('sha256').update(url).digest('hex');
        const metaPath = path.join(this.coverCacheDir, `${hash}.meta`);

        try {
            const response = await net.fetch(url, { headers });
            if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);

            const buffer = await response.arrayBuffer();
            const originalData = Buffer.from(buffer);

            // Try to compress to 75% quality JPEG
            let filePath = path.join(this.coverCacheDir, `${hash}.jpg`);
            let dataToSave: Buffer | Uint8Array = originalData;

            try {
                const image = nativeImage.createFromBuffer(originalData);
                if (!image.isEmpty()) {
                    const compressedData = image.toJPEG(75);
                    if (compressedData.length > 0) {
                        dataToSave = compressedData;
                    }
                }
            } catch (compressError) {
                // Compression failed, use original
                console.log('Cover compression failed, using original:', url);
                // Keep original extension for non-JPEG compatible formats
                filePath = path.join(this.coverCacheDir, hash);
            }

            await fs.promises.writeFile(filePath, dataToSave);
            await fs.promises.writeFile(metaPath, JSON.stringify({
                url,
                filePath, // Store actual path used
                cachedAt: Math.floor(Date.now() / 1000)
            }));

            return filePath;
        } catch (error) {
            console.error('Failed to cache cover:', url, error);
            throw error;
        }
    }

    private pruneTimeout: NodeJS.Timeout | null = null;

    private schedulePrune() {
        if (this.pruneTimeout) {
            clearTimeout(this.pruneTimeout);
        }
        // Debounce pruning to 5 seconds after last write to avoid stalling downloads
        this.pruneTimeout = setTimeout(() => {
            this.prune();
        }, 5000);
    }

    private async prune() {
        if (this.isPruning) return;
        this.isPruning = true;
        this.pruneTimeout = null;

        try {
            const db = getDatabase();

            // Get total size
            const result = db.prepare('SELECT SUM(size) as total FROM image_cache').get() as { total: number };
            let currentSize = result?.total || 0;

            if (currentSize <= this.maxCacheSize) {
                this.isPruning = false;
                return;
            }

            console.log(`[Cache] Pruning: Current ${Math.round(currentSize / 1024 / 1024)}MB > Limit ${Math.round(this.maxCacheSize / 1024 / 1024)}MB`);

            // Find oldest files to delete
            // Delete in chunks
            const rows = db.prepare('SELECT url, hash, size FROM image_cache ORDER BY cached_at ASC LIMIT 50').all() as { url: string, hash: string, size: number }[];

            for (const row of rows) {
                if (currentSize <= this.maxCacheSize) break;

                const filePath = path.join(this.cacheDir, row.hash);
                if (fs.existsSync(filePath)) {
                    try { fs.unlinkSync(filePath); } catch (e) { }
                }

                db.prepare('DELETE FROM image_cache WHERE url = ?').run(row.url);
                currentSize -= row.size;
            }

            // Recurse if still over limit (but yield to event loop)
            if (currentSize > this.maxCacheSize) {
                setImmediate(() => {
                    this.isPruning = false;
                    this.prune();
                });
                return;
            }

        } catch (e) {
            console.error('[Cache] Prune failed:', e);
        } finally {
            this.isPruning = false;
        }
    }

    private pendingRequests: Map<string, Promise<string>> = new Map();

    async saveToCache(url: string, headers: Record<string, string>, mangaId: string, chapterId: string): Promise<string> {
        if (!this.initialized) this.init();

        // Check if there's already a pending request for this URL
        if (this.pendingRequests.has(url)) {
            try {
                return await this.pendingRequests.get(url)!;
            } catch (e) {
                // If the pending request failed, we'll try again below
                this.pendingRequests.delete(url);
            }
        }

        const requestPromise = (async () => {
            const hash = crypto.createHash('sha256').update(url).digest('hex');
            const filePath = path.join(this.cacheDir, hash);
            const db = getDatabase();

            // 1. Check if already cached
            if (fs.existsSync(filePath)) {
                try {
                    // Update registry to link this image to this chapter (if not already)
                    // and update timestamp
                    db.prepare(`
                        INSERT INTO image_cache (url, hash, manga_id, chapter_id, size, cached_at)
                        VALUES (@url, @hash, @manga_id, @chapter_id, @size, strftime('%s', 'now'))
                        ON CONFLICT(url) DO UPDATE SET
                        cached_at = strftime('%s', 'now')
                    `).run({
                        '@url': url,
                        '@hash': hash,
                        '@manga_id': mangaId,
                        '@chapter_id': chapterId,
                        '@size': fs.statSync(filePath).size
                    });
                } catch (e) { console.error('Cache DB update failed', e); }
                return filePath;
            }

            // 2. Download
            try {
                const response = await net.fetch(url, { headers });
                if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);

                const buffer = await response.arrayBuffer();
                const data = new Uint8Array(buffer);

                await fs.promises.writeFile(filePath, data);

                // 3. Register in DB
                db.prepare(`
                    INSERT OR REPLACE INTO image_cache (url, hash, manga_id, chapter_id, size, cached_at)
                    VALUES (@url, @hash, @manga_id, @chapter_id, @size, strftime('%s', 'now'))
                `).run({
                    '@url': url,
                    '@hash': hash,
                    '@manga_id': mangaId,
                    '@chapter_id': chapterId,
                    '@size': data.length
                });

                // 4. Prune Check
                this.schedulePrune();

                return filePath;
            } catch (error) {
                console.error('Failed to cache image:', url, error);
                throw error;
            }
        })();

        this.pendingRequests.set(url, requestPromise);

        try {
            const result = await requestPromise;
            return result;
        } finally {
            this.pendingRequests.delete(url);
        }
    }

    async clearCache(mangaId?: string) {
        const db = getDatabase();

        if (mangaId) {
            // Delete specific manga images
            const rows = db.prepare('SELECT hash FROM image_cache WHERE manga_id = ?').all(mangaId) as { hash: string }[];
            for (const row of rows) {
                const filePath = path.join(this.cacheDir, row.hash);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            db.prepare('DELETE FROM image_cache WHERE manga_id = ?').run(mangaId);
        } else {
            // Only delete our images folder (Chromium caches are locked while app runs)
            if (fs.existsSync(this.cacheDir)) {
                fs.rmSync(this.cacheDir, { recursive: true, force: true });
                fs.mkdirSync(this.cacheDir, { recursive: true });
            }
            db.prepare('DELETE FROM image_cache').run();
        }
    }
}

export const imageCache = new ImageCache();
