import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, getDatabase } from './database';
import { loadExtensions, getExtension, getAllExtensions, reloadExtensions } from './extensions/loader';
import { listAvailableExtensions, installExtension, uninstallExtension, isExtensionInstalled, installLocalExtension } from './extensions/installer';
import { anilistAPI, setClientId, openAuthWindow, logout, isAuthenticated, serializeTokenData, deserializeTokenData } from './anilist';
import { connect as connectDiscord, updateActivity, clearActivity } from './discord';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Main process log capture
interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
}

const MAX_MAIN_LOGS = 500;
const mainProcessLogs: LogEntry[] = [];

const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
};

function captureLog(level: string, args: any[]) {
    const message = args
        .map(arg => {
            if (arg instanceof Error) {
                return `${arg.message}\n${arg.stack}`;
            }
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2).substring(0, 500);
                } catch {
                    return String(arg);
                }
            }
            return String(arg);
        })
        .join(' ')
        .substring(0, 1000);

    mainProcessLogs.push({
        timestamp: new Date().toISOString(),
        level,
        message,
    });

    if (mainProcessLogs.length > MAX_MAIN_LOGS) {
        mainProcessLogs.shift();
    }
}

console.log = (...args) => { captureLog('LOG', args); originalConsole.log(...args); };
console.info = (...args) => { captureLog('INFO', args); originalConsole.info(...args); };
console.warn = (...args) => { captureLog('WARN', args); originalConsole.warn(...args); };
console.error = (...args) => { captureLog('ERROR', args); originalConsole.error(...args); };

import { imageCache } from './cache/imageCache';

// Test log to verify capture is working


function getFormattedMainLogs(): string {
    if (mainProcessLogs.length === 0) return 'No main process logs captured.';
    return mainProcessLogs
        .map(log => `[${log.timestamp}] [${log.level}] ${log.message}`)
        .join('\n');
}

// Main process network activity capture
interface NetworkEntry {
    timestamp: string;
    method: string;
    url: string;
    status?: number;
    duration?: number;
    error?: string;
}

const MAX_NETWORK_ENTRIES = 300;
const mainNetworkActivity: NetworkEntry[] = [];

function captureNetworkRequest(entry: NetworkEntry) {
    mainNetworkActivity.push(entry);
    if (mainNetworkActivity.length > MAX_NETWORK_ENTRIES) {
        mainNetworkActivity.shift();
    }
}

function getFormattedMainNetwork(): string {
    if (mainNetworkActivity.length === 0) return 'No main process network activity captured.';
    return mainNetworkActivity
        .map(net => {
            const status = net.status ? `${net.status}` : 'FAILED';
            const duration = net.duration ? `${net.duration}ms` : '?';
            const error = net.error ? ` - Error: ${net.error}` : '';
            return `[${net.timestamp}] ${net.method} ${net.url.substring(0, 100)} → ${status} (${duration})${error}`;
        })
        .join('\n');
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
            webviewTag: true,
        },
        titleBarStyle: 'hidden',
        frame: false,
        backgroundColor: '#0f0f0f',
        show: false,
    });

    ipcMain.handle('window:minimize', () => {
        mainWindow?.minimize();
    });

    ipcMain.handle('window:maximize', () => {
        if (mainWindow?.isMaximized()) {
            mainWindow?.unmaximize();
        } else {
            mainWindow?.maximize();
        }
    });

    ipcMain.handle('window:close', () => {
        mainWindow?.close();
    });

    ipcMain.handle('app:openExternal', async (_, url: string) => {
        const { shell } = require('electron');
        await shell.openExternal(url);
    });

    ipcMain.handle('app:openInAppBrowser', async (_, url: string) => {
        const win = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                session: mainWindow?.webContents.session // Share session/cookies
            },
            autoHideMenuBar: true,
            title: 'Manga Browser'
        });
        win.loadURL(url);
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
        const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;

        // Block DevTools shortcuts in production
        if (!isDev) {
            if (input.key === 'F12' ||
                (input.control && input.shift && input.key === 'I') ||
                (input.control && input.shift && input.key === 'J') ||
                (input.control && input.shift && input.key === 'C')) {
                event.preventDefault();
                return;
            }
        }

        if (input.control && input.type === 'keyDown') {
            if (input.key === '=' || input.key === '+') {
                const currentZoom = mainWindow?.webContents.getZoomFactor() || 1;
                mainWindow?.webContents.setZoomFactor(currentZoom + 0.1);
                event.preventDefault();
            } else if (input.key === '-') {
                const currentZoom = mainWindow?.webContents.getZoomFactor() || 1;
                mainWindow?.webContents.setZoomFactor(Math.max(0.1, currentZoom - 0.1));
                event.preventDefault();
            } else if (input.key === '0') {
                mainWindow?.webContents.setZoomFactor(1);
                event.preventDefault();
            }
        }
    });
}

function setupImageProxy() {
    protocol.handle('manga-image', async (request) => {
        const url = new URL(request.url);
        const imageUrl = decodeURIComponent(url.searchParams.get('url') || '');
        const extensionId = url.searchParams.get('ext') || '';
        const mangaId = url.searchParams.get('manga');
        const chapterId = url.searchParams.get('chapter');

        if (!imageUrl) {
            return new Response('Missing image URL', { status: 400 });
        }

        const startTime = Date.now();
        const entry: NetworkEntry = {
            timestamp: new Date().toISOString(),
            method: 'GET',
            url: imageUrl,
        };

        try {
            // 0. Bypass cache for local files (icons) to preserve transparency/format
            if (imageUrl.startsWith('file:') || extensionId === 'local') {
                return net.fetch(imageUrl);
            }

            // 1. Check strict cache (for chapter images)
            // If we know it's a chapter image, look there first
            if (mangaId && chapterId) {
                const cachedPath = imageCache.getCachedImagePath(imageUrl);
                if (cachedPath) {
                    return net.fetch(`file://${cachedPath}`);
                }
            }

            // 2. Check cover cache (fallback or if it's a cover)
            const cachedCoverPath = imageCache.getCachedCoverPath(imageUrl);
            if (cachedCoverPath) {
                return net.fetch(`file://${cachedCoverPath}`);
            }

            // 3. If we didn't find it in the "correct" cache, check the other one just in case
            // (Backward compatibility or if we didn't know it was a chapter image before)
            if (!mangaId || !chapterId) {
                const cachedPath = imageCache.getCachedImagePath(imageUrl);
                if (cachedPath) {
                    return net.fetch(`file://${cachedPath}`);
                }
            }

            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            };

            const ext = getExtension(extensionId);
            if (ext) {
                const extHeaders = ext.getImageHeaders();
                Object.assign(headers, extHeaders);
            }

            // 4. Save to appropriate cache associated with the request type
            try {
                let filePath: string | null;
                if (mangaId && chapterId) {
                    // It's a chapter page - save to main cache (original quality)
                    filePath = await imageCache.saveToCache(imageUrl, headers, mangaId, chapterId);
                } else {
                    // It's a cover/browse image - save to cover cache (compressed)
                    // Pass mangaId if available to track in DB
                    filePath = await imageCache.saveCover(imageUrl, headers, mangaId || undefined);
                }

                // If cache returned null (limit reached during prefetch), fall through to direct fetch
                if (filePath === null) {
                    throw new Error('Cache limit reached');
                }

                entry.status = 200;
                entry.duration = Date.now() - startTime;
                captureNetworkRequest(entry);
                return net.fetch(`file://${filePath}`);
            } catch (cacheError) {
                // Fallback to direct fetch if caching fails
                const response = await net.fetch(imageUrl, { headers });
                entry.status = response.status;
                entry.duration = Date.now() - startTime;
                captureNetworkRequest(entry);
                return response;
            }
        } catch (error) {
            entry.error = error instanceof Error ? error.message : 'Unknown error';
            entry.duration = Date.now() - startTime;
            captureNetworkRequest(entry);
            console.error('Image proxy error:', error);
            return new Response('Failed to fetch image', { status: 500 });
        }
    });
}

function setupIpcHandlers(extensionsPath: string) {
    const db = getDatabase();

    ipcMain.handle('db:getManga', async (_, id: string) => {
        return db.prepare('SELECT * FROM manga WHERE id = ?').get(id);
    });

    ipcMain.handle('db:getAllManga', async () => {
        return db.prepare(`
            SELECT 
                m.*,
                (SELECT COUNT(*) FROM chapter c WHERE c.manga_id = m.id) as total_chapters,
                (SELECT COUNT(*) FROM chapter c WHERE c.manga_id = m.id AND c.read_at IS NOT NULL) as read_chapters
            FROM manga m 
            WHERE m.in_library = 1 
            ORDER BY m.updated_at DESC
        `).all();
    });

    ipcMain.handle('db:addManga', async (_, manga: any) => {
        const stmt = db.prepare(`
      INSERT INTO manga (id, source_id, source_manga_id, title, cover_url, author, artist, description, status, in_library)
      VALUES (@id, @source_id, @source_manga_id, @title, @cover_url, @author, @artist, @description, @status, 1)
      ON CONFLICT(source_id, source_manga_id) DO UPDATE SET
      in_library = 1,
      title = excluded.title,
      cover_url = excluded.cover_url,
      updated_at = strftime('%s', 'now')
    `);
        const params = {
            '@id': manga.id,
            '@source_id': manga.source_id,
            '@source_manga_id': manga.source_manga_id,
            '@title': manga.title,
            '@cover_url': manga.cover_url,
            '@author': manga.author,
            '@artist': manga.artist,
            '@description': manga.description,
            '@status': manga.status
        };
        stmt.run(params);
    });

    ipcMain.handle('db:updateManga', async (_, id: string, data: any) => {
        const sets = Object.keys(data).map(key => `${key} = @${key}`).join(', ');
        const stmt = db.prepare(`UPDATE manga SET ${sets}, updated_at = strftime('%s', 'now') WHERE id = @id`);
        stmt.run({ ...data, id });
    });

    ipcMain.handle('db:deleteManga', async (_, id: string) => {
        db.prepare('UPDATE manga SET in_library = 0 WHERE id = ?').run(id);
    });

    ipcMain.handle('db:ensureManga', async (_, manga: any) => {
        const stmt = db.prepare(`
      INSERT OR IGNORE INTO manga (id, source_id, source_manga_id, title, cover_url, author, artist, description, status)
      VALUES (@id, @source_id, @source_manga_id, @title, @cover_url, @author, @artist, @description, @status)
    `);
        const params = {
            '@id': manga.id,
            '@source_id': manga.source_id,
            '@source_manga_id': manga.source_manga_id,
            '@title': manga.title,
            '@cover_url': manga.cover_url,
            '@author': manga.author,
            '@artist': manga.artist,
            '@description': manga.description,
            '@status': manga.status
        };
        stmt.run(params);
    });

    ipcMain.handle('db:getChapters', async (_, mangaId: string) => {
        return db.prepare('SELECT * FROM chapter WHERE manga_id = ? ORDER BY chapter_number DESC').all(mangaId);
    });

    ipcMain.handle('db:addChapters', async (_, chapters: any[]) => {
        const stmt = db.prepare(`
      INSERT INTO chapter (id, manga_id, source_chapter_id, title, chapter_number, volume_number, url)
      VALUES (@id, @manga_id, @source_chapter_id, @title, @chapter_number, @volume_number, @url)
      ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      chapter_number = excluded.chapter_number,
      volume_number = excluded.volume_number,
      url = excluded.url
    `);
        const transaction = db.transaction((chapters: any[]) => {
            for (const chapter of chapters) {
                stmt.run({
                    '@id': chapter.id,
                    '@manga_id': chapter.manga_id,
                    '@source_chapter_id': chapter.source_chapter_id,
                    '@title': chapter.title,
                    '@chapter_number': chapter.chapter_number,
                    '@volume_number': chapter.volume_number,
                    '@url': chapter.url
                });
            }
        });
        transaction(chapters);
    });

    ipcMain.handle('db:markChapterRead', async (_, chapterId: string, pageNumber?: number) => {
        const chapter = db.prepare('SELECT * FROM chapter WHERE id = ?').get(chapterId) as any;
        if (chapter) {
            db.prepare(`UPDATE chapter SET read_at = strftime('%s', 'now'), last_page_read = ? WHERE id = ?`)
                .run(pageNumber || 0, chapterId);
            db.prepare(`INSERT INTO history (manga_id, chapter_id, page_number) VALUES (?, ?, ?)`)
                .run(chapter.manga_id, chapterId, pageNumber || 0);
        }
    });

    ipcMain.handle('db:markChapterUnread', async (_, chapterId: string) => {
        db.prepare('UPDATE chapter SET read_at = NULL, last_page_read = 0 WHERE id = ?').run(chapterId);
        db.prepare('DELETE FROM history WHERE chapter_id = ?').run(chapterId);
    });

    ipcMain.handle('db:markChaptersRead', async (_, chapterIds: string[]) => {
        const transaction = db.transaction((ids: string[]) => {
            const updateStmt = db.prepare(`UPDATE chapter SET read_at = strftime('%s', 'now') WHERE id = ?`);
            const getChapterStmt = db.prepare('SELECT id, manga_id FROM chapter WHERE id = ?');
            const insertHistoryStmt = db.prepare(`INSERT INTO history (manga_id, chapter_id, page_number) VALUES (?, ?, 0)`);

            for (const id of ids) {
                updateStmt.run(id);
                const chapter = getChapterStmt.get(id) as any;
                if (chapter) {
                    insertHistoryStmt.run(chapter.manga_id, chapter.id);
                }
            }
        });
        transaction(chapterIds);
    });

    ipcMain.handle('db:markChaptersUnread', async (_, chapterIds: string[]) => {
        const transaction = db.transaction((ids: string[]) => {
            const updateStmt = db.prepare('UPDATE chapter SET read_at = NULL, last_page_read = 0 WHERE id = ?');
            const deleteHistoryStmt = db.prepare('DELETE FROM history WHERE chapter_id = ?');

            for (const id of ids) {
                updateStmt.run(id);
                deleteHistoryStmt.run(id);
            }
        });
        transaction(chapterIds);
    });

    ipcMain.handle('db:saveReadingProgress', async (_, manga: any, chapter: any, pageNumber: number) => {
        const transaction = db.transaction(() => {
            const mangaStmt = db.prepare(`
                INSERT OR IGNORE INTO manga (id, source_id, source_manga_id, title, cover_url, author, artist, description, status)
                VALUES (@id, @source_id, @source_manga_id, @title, @cover_url, @author, @artist, @description, @status)
            `);
            mangaStmt.run({
                '@id': manga.id,
                '@source_id': manga.source_id,
                '@source_manga_id': manga.source_manga_id,
                '@title': manga.title,
                '@cover_url': manga.cover_url,
                '@author': manga.author,
                '@artist': manga.artist,
                '@description': manga.description,
                '@status': manga.status
            });

            const chapterStmt = db.prepare(`
                INSERT OR IGNORE INTO chapter (id, manga_id, source_chapter_id, title, chapter_number, volume_number, url)
                VALUES (@id, @manga_id, @source_chapter_id, @title, @chapter_number, @volume_number, @url)
            `);
            chapterStmt.run({
                '@id': chapter.id,
                '@manga_id': manga.id,
                '@source_chapter_id': chapter.source_chapter_id,
                '@title': chapter.title,
                '@chapter_number': chapter.chapter_number,
                '@volume_number': chapter.volume_number,
                '@url': chapter.url
            });

            db.prepare(`UPDATE chapter SET read_at = strftime('%s', 'now'), last_page_read = ? WHERE id = ?`)
                .run(pageNumber, chapter.id);

            const lastEntry = db.prepare('SELECT id, chapter_id FROM history ORDER BY read_at DESC LIMIT 1').get() as any;

            if (lastEntry && lastEntry.chapter_id === chapter.id) {
                // Same chapter (page turn), just update timestamp and page
                db.prepare('UPDATE history SET read_at = strftime(\'%s\', \'now\'), page_number = ? WHERE id = ?')
                    .run(pageNumber, lastEntry.id);
            } else {
                // Different chapter - delete ALL history entries for this manga to ensure one entry per manga
                db.prepare('DELETE FROM history WHERE manga_id = ?').run(manga.id);

                db.prepare(`INSERT INTO history (manga_id, chapter_id, page_number) VALUES (?, ?, ?)`)
                    .run(manga.id, chapter.id, pageNumber);
            }
        });

        transaction();
    });

    ipcMain.handle('db:getHistory', async (_, limit: number = 50) => {
        // Use subquery to get only the most recent chapter per manga
        return db.prepare(`
            SELECT h.*, m.title as manga_title, m.cover_url, m.source_id,
                   c.title as chapter_title, c.chapter_number
            FROM history h
            JOIN manga m ON h.manga_id = m.id
            JOIN chapter c ON h.chapter_id = c.id
            WHERE h.id IN (
                SELECT h2.id FROM history h2
                INNER JOIN (
                    SELECT manga_id, MAX(read_at) as max_read_at
                    FROM history
                    GROUP BY manga_id
                ) latest ON h2.manga_id = latest.manga_id AND h2.read_at = latest.max_read_at
                GROUP BY h2.manga_id
            )
            ORDER BY h.read_at DESC
            LIMIT ?
        `).all(limit);
    });

    ipcMain.handle('db:deleteHistory', async (_, mangaId: string) => {
        db.prepare('DELETE FROM history WHERE manga_id = ?').run(mangaId);
    });

    ipcMain.handle('db:getTags', async () => {
        return db.prepare(`
            SELECT t.*, COUNT(mt.manga_id) as count 
            FROM tag t 
            LEFT JOIN manga_tag mt ON t.id = mt.tag_id 
            GROUP BY t.id 
            ORDER BY t.name
        `).all();
    });

    ipcMain.handle('db:createTag', async (_, name: string, color: string) => {
        const result = db.prepare('INSERT INTO tag (name, color) VALUES (?, ?)').run(name, color);
        return { id: result.lastInsertRowid, name, color };
    });

    ipcMain.handle('db:updateTag', async (_, id: number, name: string, color: string) => {
        db.prepare('UPDATE tag SET name = ?, color = ? WHERE id = ?').run(name, color, id);
    });

    ipcMain.handle('db:deleteTag', async (_, id: number) => {
        db.prepare('DELETE FROM tag WHERE id = ?').run(id);
    });

    ipcMain.handle('db:addTagToManga', async (_, mangaId: string, tagId: number) => {
        db.prepare('INSERT OR IGNORE INTO manga_tag (manga_id, tag_id) VALUES (?, ?)').run(mangaId, tagId);
    });

    ipcMain.handle('db:removeTagFromManga', async (_, mangaId: string, tagId: number) => {
        db.prepare('DELETE FROM manga_tag WHERE manga_id = ? AND tag_id = ?').run(mangaId, tagId);
    });

    ipcMain.handle('db:getMangaByTag', async (_, tagId: number) => {
        return db.prepare(`
      SELECT m.* FROM manga m
      JOIN manga_tag mt ON m.id = mt.manga_id
      WHERE mt.tag_id = ?
      ORDER BY m.title
    `).all(tagId);
    });

    ipcMain.handle('db:getTagsForManga', async (_, mangaId: string) => {
        return db.prepare(`
      SELECT t.* FROM tag t
      JOIN manga_tag mt ON t.id = mt.tag_id
      WHERE mt.manga_id = ?
      ORDER BY t.name
    `).all(mangaId);
    });

    ipcMain.handle('ext:getAll', async () => {
        return getAllExtensions().map(ext => ({
            id: ext.id,
            name: ext.name,
            version: ext.version,
            baseUrl: ext.baseUrl,
            icon: ext.icon,
            language: ext.language,
            nsfw: ext.nsfw,
        }));
    });

    ipcMain.handle('ext:getFilters', async (_, extensionId: string) => {
        const ext = getExtension(extensionId);
        if (!ext) return [];
        return ext.getFilters ? ext.getFilters() : [];
    });

    ipcMain.handle('ext:getPopularManga', async (_, extensionId: string, page: number, filters?: Record<string, string | string[]>) => {
        const ext = getExtension(extensionId);
        if (!ext) throw new Error(`Extension ${extensionId} not found`);
        return ext.getPopularManga(page, filters);
    });

    ipcMain.handle('ext:getLatestManga', async (_, extensionId: string, page: number, filters?: Record<string, string | string[]>) => {
        const ext = getExtension(extensionId);
        if (!ext) throw new Error(`Extension ${extensionId} not found`);
        return ext.getLatestManga(page, filters);
    });

    ipcMain.handle('ext:searchManga', async (_, extensionId: string, query: string, page: number) => {
        const ext = getExtension(extensionId);
        if (!ext) throw new Error(`Extension ${extensionId} not found`);
        return ext.searchManga(query, page);
    });

    ipcMain.handle('ext:getMangaDetails', async (_, extensionId: string, mangaId: string) => {
        const ext = getExtension(extensionId);
        if (!ext) throw new Error(`Extension ${extensionId} not found`);
        return ext.getMangaDetails(mangaId);
    });

    ipcMain.handle('ext:getChapterList', async (_, extensionId: string, mangaId: string) => {
        const ext = getExtension(extensionId);
        if (!ext) throw new Error(`Extension ${extensionId} not found`);
        return ext.getChapterList(mangaId);
    });

    ipcMain.handle('ext:getChapterPages', async (_, extensionId: string, chapterId: string) => {
        const ext = getExtension(extensionId);
        if (!ext) throw new Error(`Extension ${extensionId} not found`);
        return ext.getChapterPages(chapterId);
    });

    ipcMain.handle('ext:listAvailable', async (_, repoUrl: string) => {
        try {
            const available = await listAvailableExtensions(repoUrl);
            return available.map(ext => ({
                ...ext,
                installed: isExtensionInstalled(ext.id, extensionsPath),
            }));
        } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to fetch repository');
        }
    });

    ipcMain.handle('ext:install', async (_, repoUrl: string, extensionId: string) => {
        const result = await installExtension(repoUrl, extensionId, extensionsPath);
        if (result.success) {
            await reloadExtensions(extensionsPath);
        }
        return result;
    });

    ipcMain.handle('ext:sideload', async () => {
        const { dialog } = await import('electron');
        const result = await dialog.showOpenDialog(mainWindow as any, {
            properties: ['openDirectory'],
            title: 'Select Extension Directory',
            buttonLabel: 'Install Extension'
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, error: 'Installation cancelled' };
        }

        const sourcePath = result.filePaths[0];
        const installResult = installLocalExtension(sourcePath, extensionsPath);

        if (installResult.success) {
            await reloadExtensions(extensionsPath);
        }

        return installResult;
    });

    ipcMain.handle('ext:uninstall', async (_, extensionId: string) => {
        const result = uninstallExtension(extensionId, extensionsPath);
        if (result.success) {
            await reloadExtensions(extensionsPath);
        }
        return result;
    });

    ipcMain.handle('cache:save', async (_, url: string, extensionId: string, mangaId: string, chapterId: string, isPrefetch: boolean = false) => {
        const ext = getExtension(extensionId);
        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };
        if (ext) {
            Object.assign(headers, ext.getImageHeaders());
        }

        try {
            return await imageCache.saveToCache(url, headers, mangaId, chapterId, isPrefetch);
        } catch (e) {
            console.error(`Cache save failed for ${url}:`, e);
            throw e;
        }
    });

    ipcMain.handle('cache:clear', async (_, mangaId?: string) => {
        await imageCache.clearCache(mangaId);
    });

    ipcMain.handle('cache:setLimit', async (_, bytes: number) => {
        imageCache.setLimit(bytes);
    });

    ipcMain.handle('cache:getSize', async () => {
        return imageCache.getCacheSize();
    });

    ipcMain.handle('cache:checkManga', async (_, mangaId: string) => {
        const db = getDatabase();
        const result = db.prepare('SELECT COUNT(DISTINCT chapter_id) as count FROM image_cache WHERE manga_id = ?').get(mangaId) as { count: number };
        return result?.count || 0;
    });

    ipcMain.handle('app:createDumpLog', async (_, consoleLogs: string, networkActivity: string) => {
        const os = await import('os');
        const fs = await import('fs');
        const { app, shell } = await import('electron');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logPath = path.join(app.getPath('desktop'), `mangyomi-debug-${timestamp}.log`);

        const extensions = getAllExtensions();
        const libraryCount = db.prepare('SELECT COUNT(*) as count FROM manga WHERE in_library = 1').get() as any;
        const chapterCount = db.prepare('SELECT COUNT(*) as count FROM chapter').get() as any;
        const historyCount = db.prepare('SELECT COUNT(*) as count FROM history').get() as any;

        const logContent = `
================================================================================
                         MANGYOMI DEBUG DUMP LOG
================================================================================
Generated: ${new Date().toISOString()}
App Version: ${app.getVersion()}
Electron: ${process.versions.electron}
Chrome: ${process.versions.chrome}
Node: ${process.versions.node}

================================================================================
                              SYSTEM INFO
================================================================================
Platform: ${os.platform()} (${os.arch()})
OS Version: ${os.release()}
Total Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB
Free Memory: ${Math.round(os.freemem() / 1024 / 1024 / 1024)} GB
CPU Cores: ${os.cpus().length}
Home Directory: ${os.homedir()}
User Data Path: ${app.getPath('userData')}

================================================================================
                            INSTALLED EXTENSIONS
================================================================================
${extensions.length === 0 ? 'No extensions installed.' : extensions.map(ext => `- ${ext.name} (${ext.id}) v${ext.version}`).join('\n')}

================================================================================
                              DATABASE STATS
================================================================================
Library Manga: ${libraryCount?.count || 0}
Total Chapters: ${chapterCount?.count || 0}
History Entries: ${historyCount?.count || 0}

================================================================================
                            EXTENSIONS PATH
================================================================================
${extensionsPath}
Extensions Found: ${fs.existsSync(extensionsPath) ? fs.readdirSync(extensionsPath).filter(d => !d.startsWith('.')).join(', ') || 'None' : 'Directory not found'}

================================================================================
                      MAIN PROCESS LOGS (Extensions, DB, etc.)
================================================================================
${getFormattedMainLogs()}

================================================================================
                      MAIN PROCESS NETWORK (Image Proxy)
================================================================================
${getFormattedMainNetwork()}

================================================================================
                      RENDERER CONSOLE LOGS (UI)
================================================================================
${consoleLogs || 'No renderer console logs captured.'}

================================================================================
                      RENDERER NETWORK (UI fetch)
================================================================================
${networkActivity || 'No renderer network activity captured.'}

================================================================================
                          END OF DEBUG LOG
================================================================================
`;

        fs.writeFileSync(logPath, logContent.trim(), 'utf-8');
        shell.showItemInFolder(logPath);

        return { success: true, path: logPath };
    });

    // AniList IPC Handlers
    ipcMain.handle('anilist:setClientId', async (_, clientId: string) => {
        setClientId(clientId);
    });

    ipcMain.handle('anilist:login', async () => {
        if (!mainWindow) throw new Error('Main window not available');
        try {
            const token = await openAuthWindow(mainWindow);
            return { success: true, token };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    ipcMain.handle('anilist:logout', async () => {
        logout();
        return { success: true };
    });

    ipcMain.handle('anilist:isAuthenticated', async () => {
        return isAuthenticated();
    });

    ipcMain.handle('anilist:getUser', async () => {
        return await anilistAPI.getViewer();
    });

    ipcMain.handle('anilist:searchManga', async (_, query: string) => {
        return await anilistAPI.searchManga(query);
    });

    ipcMain.handle('anilist:getMangaById', async (_, anilistId: number) => {
        return await anilistAPI.getMangaById(anilistId);
    });

    ipcMain.handle('anilist:linkManga', async (_, mangaId: string, anilistId: number) => {
        db.prepare('UPDATE manga SET anilist_id = ? WHERE id = ?').run(anilistId, mangaId);
        return { success: true };
    });

    ipcMain.handle('anilist:unlinkManga', async (_, mangaId: string) => {
        db.prepare('UPDATE manga SET anilist_id = NULL WHERE id = ?').run(mangaId);
        return { success: true };
    });

    ipcMain.handle('anilist:updateProgress', async (_, anilistId: number, progress: number) => {
        try {
            const result = await anilistAPI.updateProgress(anilistId, progress);
            return { success: true, data: result };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    ipcMain.handle('anilist:syncProgress', async (_, mangaId: string) => {
        // Get manga with anilist_id
        const manga = db.prepare('SELECT * FROM manga WHERE id = ?').get(mangaId) as any;
        if (!manga?.anilist_id) {
            return { success: false, error: 'Manga not linked to AniList' };
        }

        // Get highest read chapter number for this manga
        const highestRead = db.prepare(`
            SELECT MAX(chapter_number) as max_chapter 
            FROM chapter 
            WHERE manga_id = ? AND read_at IS NOT NULL
        `).get(mangaId) as any;

        if (!highestRead?.max_chapter) {
            return { success: false, error: 'No chapters read' };
        }

        try {
            const result = await anilistAPI.updateProgress(
                manga.anilist_id,
                Math.floor(highestRead.max_chapter)
            );
            return { success: true, data: result };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    ipcMain.handle('anilist:getTokenData', async () => {
        return serializeTokenData();
    });

    ipcMain.handle('anilist:setTokenData', async (_, data: string) => {
        deserializeTokenData(data);
    });

    // Discord RPC IPC Handlers
    ipcMain.handle('discord:updateActivity', async (_, details: string, state: string, largeImageKey?: string, largeImageText?: string, smallImageKey?: string, smallImageText?: string, buttons?: { label: string; url: string }[]) => {
        return await updateActivity(details, state, largeImageKey, largeImageText, smallImageKey, smallImageText, buttons);
    });

    ipcMain.handle('discord:clearActivity', async () => {
        return await clearActivity();
    });
}

app.whenReady().then(async () => {
    // Initialize Discord RPC
    connectDiscord().catch(console.error);

    const dbPath = path.join(app.getPath('userData'), 'mangyomi.db');
    await initDatabase(dbPath);

    const extensionsPath = path.join(app.getPath('userData'), 'extensions');

    await loadExtensions(extensionsPath);

    setupImageProxy();

    setupIpcHandlers(extensionsPath);

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
