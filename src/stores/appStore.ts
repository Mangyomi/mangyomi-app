import { create } from 'zustand';
import { useAniListStore } from './anilistStore';
import { useLibraryStore } from '../features/library/stores/libraryStore';
import { Extension } from '@/features/extensions/stores/extensionStore';

export interface Manga {
    id: string;
    source_id: string;
    source_manga_id: string;
    title: string;
    cover_url: string;
    author?: string;
    artist?: string;
    description?: string;
    status?: string;
    added_at?: number;
    updated_at?: number;
    in_library?: boolean;
    total_chapters?: number;
    read_chapters?: number;
    anilist_id?: number;
    url?: string;
}

export interface Chapter {
    id: string;
    manga_id: string;
    source_chapter_id: string;
    title: string;
    chapter_number: number;
    volume_number?: number;
    url: string;
    read_at?: number;
    page_count?: number;
    last_page_read?: number;
    chapterNumber?: number;
    uploadDate?: number;
}

export interface Tag {
    id: number;
    name: string;
    color: string;
    count?: number;
}

export interface HistoryEntry {
    id: number;
    manga_id: string;
    chapter_id: string;
    read_at: number;
    page_number: number;
    manga_title: string;
    cover_url: string;
    chapter_title: string;
    chapter_number: number;
    source_id: string;
}

interface AppState {


    currentManga: any | null;
    currentChapters: Chapter[];


    captchaUrl: string | null;
    captchaCallback: (() => void) | null;

    prefetchedChapters: Map<string, string[]>;
    prefetchInProgress: Set<string>;

    loadMangaDetails: (extensionId: string, mangaId: string) => Promise<void>;
    loadChapters: (extensionId: string, mangaId: string) => Promise<void>;
    markChapterRead: (chapterId: string, pageNumber?: number) => Promise<void>;
    markChapterUnread: (chapterId: string) => Promise<void>;
    markChaptersRead: (chapterIds: string[]) => Promise<void>;
    markChaptersUnread: (chapterIds: string[]) => Promise<void>;
    markChapterReadInternal: (chapterId: string, pageNumber?: number) => Promise<void>;
    showCaptcha: (url: string, callback: () => void) => void;
    hideCaptcha: () => void;
    prefetchChapter: (extensionId: string, chapterId: string) => void;
    getPrefetchedPages: (chapterId: string) => string[] | undefined;
    clearPrefetchCache: () => void;
    // Global Prefetch State
    isPrefetching: boolean;
    prefetchMangaId: string | null;
    prefetchProgress: { current: number; total: number; chapter: string; error?: string };
    cancelPrefetch: () => void;
    resumePrefetch: () => void;
    startPrefetch: (chapters: Chapter[], extensionId: string, mangaId: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
    currentManga: null,
    currentChapters: [],
    captchaUrl: null,
    captchaCallback: null,
    prefetchedChapters: new Map(),
    prefetchInProgress: new Set(),

    // Global Prefetch Init
    isPrefetching: false,
    prefetchMangaId: null,
    prefetchProgress: { current: 0, total: 0, chapter: '', error: undefined },
    cancelPrefetch: () => { },
    resumePrefetch: () => { }, // placeholder, replaced in startPrefetch

    loadMangaDetails: async (extensionId: string, mangaId: string) => {
        try {
            const details = await window.electronAPI.extensions.getMangaDetails(extensionId, mangaId);
            set({ currentManga: { ...details, extensionId } });
        } catch (error) {
            console.error('Failed to load manga details:', error);
        }
    },

    loadChapters: async (extensionId: string, mangaId: string) => {
        try {
            const extChapters = await window.electronAPI.extensions.getChapterList(extensionId, mangaId);

            const dbMangaId = `${extensionId}:${mangaId}`;
            const existingManga = await window.electronAPI.db.getManga(dbMangaId);

            if (existingManga) {
                const dbChaptersToSync = extChapters.map(chapter => ({
                    id: `${extensionId}:${chapter.id}`,
                    manga_id: dbMangaId,
                    source_chapter_id: chapter.source_chapter_id || chapter.id.split('/').pop(),
                    title: chapter.title,
                    chapter_number: chapter.chapterNumber || 0,
                    volume_number: chapter.volume_number || 0,
                    url: chapter.url,
                }));

                try {
                    await window.electronAPI.db.addChapters(dbChaptersToSync);
                    await useLibraryStore.getState().loadLibrary();
                } catch (syncError) {
                    console.warn('Failed to sync chapters to DB:', syncError);
                }
            }

            const dbChapters = await window.electronAPI.db.getChapters(dbMangaId);
            const readMap = new Map();
            if (Array.isArray(dbChapters)) {
                dbChapters.forEach((c: any) => {
                    if (c.read_at) {
                        readMap.set(c.id, c.read_at);
                    }
                });
            }

            const mergedChapters = extChapters.map(c => ({
                ...c,
                read_at: readMap.get(`${extensionId}:${c.id}`)
            }));

            set({ currentChapters: mergedChapters });
        } catch (error) {
            console.error('Failed to load chapters:', error);
        }
    },





    markChapterRead: async (chapterId, pageNumber = 0) => {
        const { currentManga, currentChapters } = get();
        if (!currentManga) return;

        const chapter = currentChapters.find(c => c.id === chapterId);
        if (!chapter) return;

        try {
            await get().markChapterReadInternal(chapterId, pageNumber);

            set({
                currentChapters: currentChapters.map(c =>
                    c.id === chapterId ? { ...c, read_at: Date.now() / 1000 } : c
                )
            });

            await useLibraryStore.getState().loadLibrary();

            await useLibraryStore.getState().loadLibrary();

            // Sync with AniList
            const extensionId = currentManga.extensionId || currentManga.source_id;
            const dbMangaId = `${extensionId}:${currentManga.id}`;
            const libraryEntry = useLibraryStore.getState().library.find(m => m.id === dbMangaId);

            if (libraryEntry?.anilist_id) {
                await useAniListStore.getState().syncProgress(dbMangaId);
            }
        } catch (error) {
            console.error('Failed to mark chapter read:', error);
        }
    },

    markChapterReadInternal: async (chapterId: string, pageNumber: number = 0) => {
        const { currentManga, currentChapters } = get();
        if (!currentManga) return;
        const chapter = currentChapters.find(c => c.id === chapterId);
        if (!chapter) return;

        const extensionId = currentManga.extensionId || currentManga.source_id;
        const dbManga = {
            id: `${extensionId}:${currentManga.id}`,
            source_id: extensionId,
            source_manga_id: currentManga.id,
            title: currentManga.title,
            cover_url: currentManga.coverUrl || currentManga.cover_url,
            author: currentManga.author || '',
            artist: currentManga.artist || '',
            description: currentManga.description || '',
            status: currentManga.status || 'unknown',
        };
        const dbChapter = {
            id: `${extensionId}:${chapterId}`,
            manga_id: dbManga.id,
            source_chapter_id: chapter.source_chapter_id || chapterId.split('/').pop(),
            title: chapter.title,
            chapter_number: chapter.chapterNumber || 0,
            volume_number: chapter.volume_number || 0,
            url: chapter.url,
        };
        await window.electronAPI.db.saveReadingProgress(dbManga, dbChapter, pageNumber);
    },

    markChapterUnread: async (chapterId: string) => {
        const { currentManga, currentChapters } = get();
        if (!currentManga) return;
        const extensionId = currentManga.extensionId || currentManga.source_id;
        const dbChapterId = `${extensionId}:${chapterId}`;

        try {
            await window.electronAPI.db.markChapterUnread(dbChapterId);
            set({
                currentChapters: currentChapters.map(c =>
                    c.id === chapterId ? { ...c, read_at: undefined } : c
                )
            });

            await useLibraryStore.getState().loadLibrary();

            // Sync with AniList
            if (currentManga && (currentManga.anilist_id || currentManga.anilistId)) {
                await useAniListStore.getState().syncProgress(currentManga.id);
            }
        } catch (e) {
            console.error('Failed to mark unread:', e);
        }
    },

    markChaptersRead: async (chapterIds: string[]) => {
        const { currentManga, currentChapters } = get();
        if (!currentManga) return;
        const extensionId = currentManga.extensionId || currentManga.source_id;

        const dbChapterIds = chapterIds.map(id => `${extensionId}:${id}`);

        try {
            const chaptersToMark = currentChapters.filter(c => chapterIds.includes(c.id));
            const dbChapters = chaptersToMark.map(chapter => ({
                id: `${extensionId}:${chapter.id}`,
                manga_id: `${extensionId}:${currentManga.id}`,
                source_chapter_id: chapter.source_chapter_id || chapter.id.split('/').pop(),
                title: chapter.title,
                chapter_number: chapter.chapterNumber || 0,
                volume_number: chapter.volume_number || 0,
                url: chapter.url,
            }));

            const dbManga = {
                id: `${extensionId}:${currentManga.id}`,
                source_id: extensionId,
                source_manga_id: currentManga.id,
                title: currentManga.title,
                cover_url: currentManga.coverUrl || currentManga.cover_url,
                author: currentManga.author || '',
                artist: currentManga.artist || '',
                description: currentManga.description || '',
                status: currentManga.status || 'unknown',
            };

            await window.electronAPI.db.ensureManga(dbManga);
            await window.electronAPI.db.addChapters(dbChapters);
            await window.electronAPI.db.markChaptersRead(dbChapterIds);

            set({
                currentChapters: currentChapters.map(c =>
                    chapterIds.includes(c.id) ? { ...c, read_at: Date.now() / 1000 } : c
                )
            });

            await useLibraryStore.getState().loadLibrary();

            // Sync with AniList
            if (currentManga && (currentManga.anilist_id || currentManga.anilistId)) {
                await useAniListStore.getState().syncProgress(currentManga.id);
            }
        } catch (e) {
            console.error('Failed to bulk mark read:', e);
        }
    },

    markChaptersUnread: async (chapterIds: string[]) => {
        const { currentManga, currentChapters } = get();
        if (!currentManga) return;
        const extensionId = currentManga.extensionId || currentManga.source_id;

        const dbChapterIds = chapterIds.map(id => `${extensionId}:${id}`);

        try {
            await window.electronAPI.db.markChaptersUnread(dbChapterIds);

            set({
                currentChapters: currentChapters.map(c =>
                    chapterIds.includes(c.id) ? { ...c, read_at: undefined } : c
                )
            });

            await useLibraryStore.getState().loadLibrary();

        } catch (e) {
            console.error('Failed to bulk mark unread:', e);
        }
    },

    showCaptcha: (url, callback) => {
        set({ captchaUrl: url, captchaCallback: callback });
    },

    hideCaptcha: () => {
        set({ captchaUrl: null, captchaCallback: null });
    },

    prefetchChapter: (extensionId, chapterId) => {
        // Already cached or in progress - skip
        if (get().prefetchedChapters.has(chapterId) || get().prefetchInProgress.has(chapterId)) {
            return;
        }

        // Mark as in progress immediately (synchronous)
        set((state) => ({
            prefetchInProgress: new Set(state.prefetchInProgress).add(chapterId)
        }));

        // Fire-and-forget async operation
        (async () => {
            try {

                const pages = await window.electronAPI.extensions.getChapterPages(extensionId, chapterId);

                // Store pages immediately
                set((state) => {
                    const newCache = new Map(state.prefetchedChapters);
                    newCache.set(chapterId, pages);
                    const newInProgress = new Set(state.prefetchInProgress);
                    newInProgress.delete(chapterId);
                    return { prefetchedChapters: newCache, prefetchInProgress: newInProgress };
                });

                // Background caching (fully async, no blocking)
                const { currentManga } = get();
                const mangaId = currentManga?.id || 'unknown';

                const CONCURRENCY = 2;
                for (let i = 0; i < pages.length; i += CONCURRENCY) {
                    const batch = pages.slice(i, i + CONCURRENCY);
                    const results = await Promise.all(batch.map(url =>
                        window.electronAPI.cache.save(url, extensionId, mangaId, chapterId, true)
                            .catch(e => { console.error('Failed to cache page:', url, e); return null; })
                    ));
                    // If any save returned null (cache limit reached), stop prefetching
                    if (results.some(r => r === null)) {
                        console.log('Cache limit reached, stopping prefetch for chapter', chapterId);
                        break;
                    }
                    // Longer delay between batches to reduce CPU load
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.error('Failed to prefetch chapter:', chapterId, error);
                // Remove from in-progress on error
                set((state) => {
                    const newInProgress = new Set(state.prefetchInProgress);
                    newInProgress.delete(chapterId);
                    return { prefetchInProgress: newInProgress };
                });
            }
        })();
    },

    getPrefetchedPages: (chapterId) => {
        return get().prefetchedChapters.get(chapterId);
    },

    clearPrefetchCache: () => {
        set({ prefetchedChapters: new Map() });
    },

    startPrefetch: async (chapters: Chapter[], extensionId: string, mangaId: string) => {
        const { isPrefetching } = get();
        if (isPrefetching) {
            console.log('Prefetch already in progress, skipping');
            return;
        }

        console.log('Starting prefetch for', chapters.length, 'chapters');
        // Initialize state FIRST
        set({
            isPrefetching: true,
            prefetchMangaId: mangaId,
            prefetchProgress: { current: 0, total: chapters.length, chapter: 'Starting...' }
        });

        let cancelled = false;
        set({
            cancelPrefetch: () => {
                console.log('Prefetch cancelled by user');
                cancelled = true;
            }
        });

        try {
            // Import settings store
            const { useSettingsStore } = await import('../features/settings/stores/settingsStore');
            const maxCacheSize = useSettingsStore.getState().maxCacheSize; // Access state directly
            // const dialog = require('@electron/remote').dialog; // Use alert for simplicity in store for now

            let completed = 0;
            for (const chapter of chapters) {
                if (cancelled) break;

                set({ prefetchProgress: { current: completed + 1, total: chapters.length, chapter: `Ch. ${chapter.chapterNumber} - ${chapter.title}` } });

                try {

                    // 2. Fetch Pages
                    let pages: string[] = [];
                    let pageFetchAttempts = 0;
                    const maxPageFetchRetries = 3;
                    let pagesFetched = false;

                    while (pageFetchAttempts < maxPageFetchRetries && !pagesFetched && !cancelled) {
                        pageFetchAttempts++;
                        try {
                            if (pageFetchAttempts > 1) console.log(`Retry fetching pages for chapter ${chapter.chapterNumber} (Attempt ${pageFetchAttempts}/${maxPageFetchRetries})`);

                            pages = await Promise.race([
                                window.electronAPI.extensions.getChapterPages(extensionId, chapter.id),
                                new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error('Timeout fetching pages')), 30000))
                            ]);
                            pagesFetched = true;
                        } catch (err: any) {
                            console.warn(`Failed to fetch pages for chapter ${chapter.chapterNumber} (Attempt ${pageFetchAttempts}):`, err.message || err);
                            if (pageFetchAttempts === maxPageFetchRetries) {
                                console.error(`Permanently failed to fetch pages for chapter ${chapter.id}`);
                            } else {
                                // Backoff: 2s, 4s, 6s...
                                await new Promise(r => setTimeout(r, 2000 * pageFetchAttempts));
                            }
                        }
                    }

                    if (!pagesFetched) {
                        console.error(`Skipping chapter ${chapter.id} (Ch. ${chapter.chapterNumber}) - failed to fetch page list after retries`);
                        completed++;
                        continue; // Skip this chapter if we couldn't get the page list
                    }

                    // Check for empty page list
                    if (pages.length === 0) {
                        console.warn(`Chapter ${chapter.id} (Ch. ${chapter.chapterNumber}) has 0 pages!`);
                        completed++;
                        continue;
                    }

                    // 3. Cache Each Page (Parallel with Concurrency)
                    const CONCURRENCY = 4;
                    let cacheLimitReached = false;

                    const downloadPage = async (page: string): Promise<'success' | 'failed' | 'limit'> => {
                        let attempts = 0;
                        const maxRetries = 3;

                        while (attempts < maxRetries && !cancelled) {
                            attempts++;
                            try {
                                if (attempts > 1) console.log(`Retry attempt ${attempts}/${maxRetries} for page: ${page}`);

                                // 20s timeout per attempt
                                const result = await Promise.race([
                                    window.electronAPI.cache.save(page, extensionId, mangaId, chapter.id, true),
                                    new Promise<string | null>((_, reject) => setTimeout(() => reject(new Error('Save timeout')), 20000))
                                ]);

                                // null means cache limit reached
                                if (result === null) {
                                    return 'limit';
                                }
                                return 'success';
                            } catch (e: any) {
                                console.warn(`Failed to cache page (Attempt ${attempts}/${maxRetries}): ${page}`, e.message || e);
                                if (attempts === maxRetries) {
                                    console.error(`Permanently failed to cache page after ${maxRetries} attempts: ${page}`);
                                } else {
                                    // Exponential backoff
                                    await new Promise(r => setTimeout(r, 1000 * attempts));
                                }
                            }
                        }
                        return 'failed';
                    };

                    let lastProgressUpdate = 0;
                    const updateProgress = (error?: string) => {
                        const now = Date.now();
                        // Throttle updates to once every 250ms to avoid UI stutter and freezing
                        if (now - lastProgressUpdate > 250 || error) {
                            set({
                                prefetchProgress: {
                                    current: completed + 1,
                                    total: chapters.length,
                                    chapter: `Ch. ${chapter.chapterNumber}`,
                                    error
                                }
                            });
                            lastProgressUpdate = now;
                        }
                    };
                    let successfulPages = 0;
                    const totalPages = pages.length;

                    for (let i = 0; i < pages.length; i += CONCURRENCY) {
                        if (cancelled || cacheLimitReached) break;
                        const batch = pages.slice(i, i + CONCURRENCY);
                        const results = await Promise.all(batch.map(async page => {
                            const result = await downloadPage(page);
                            if (result === 'success') successfulPages++;
                            if (result === 'limit') cacheLimitReached = true;
                            return result;
                        }));

                        // If cache limit reached, pause and wait for limit increase
                        if (cacheLimitReached) {
                            console.log('Cache limit reached - pausing prefetch');

                            // Set error state
                            updateProgress('Cache limit reached. Increase limit to continue.');

                            // Poll for cache limit changes every 2 seconds
                            const { useSettingsStore } = await import('../features/settings/stores/settingsStore');
                            let resumed = false;

                            while (!cancelled && !resumed) {
                                await new Promise(r => setTimeout(r, 2000));

                                // Check if user cancelled
                                if (cancelled) break;

                                // Check if cache size is now below limit
                                const currentCacheSize = await window.electronAPI.cache.getSize();
                                const currentLimit = useSettingsStore.getState().maxCacheSize;

                                if (currentCacheSize < currentLimit) {
                                    console.log('Cache limit increased, resuming prefetch');
                                    cacheLimitReached = false;
                                    resumed = true;
                                    set({ prefetchProgress: { ...get().prefetchProgress, error: undefined } });
                                }
                            }

                            // If cancelled during wait, break out
                            if (cancelled) break;

                            // Retry the current batch
                            i -= CONCURRENCY;
                            continue;
                        }

                        updateProgress();
                    }

                    if (successfulPages < totalPages) {
                        console.warn(`Chapter ${chapter.id} (Ch. ${chapter.chapterNumber}): Only ${successfulPages}/${totalPages} pages cached successfully`);
                    }
                } catch (e) {
                    console.error(`Unexpected error processing chapter ${chapter.id}`, e);
                }
                completed++;
            }
        } catch (err) {
            console.error('Error during prefetch initialization:', err);
        } finally {
            console.log('Prefetch finished or cancelled');
            set({
                isPrefetching: false,
                prefetchMangaId: null,
                prefetchProgress: { current: 0, total: 0, chapter: '' }
            });
        }
    },
}));
