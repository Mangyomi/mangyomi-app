import { create } from 'zustand';

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

export interface Extension {
    id: string;
    name: string;
    version: string;
    baseUrl: string;
    icon?: string;
    language: string;
    nsfw: boolean;
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
    library: Manga[];
    loadingLibrary: boolean;

    extensions: Extension[];
    selectedExtension: Extension | null;

    browseManga: any[];
    browseLoading: boolean;
    browseHasMore: boolean;
    browsePage: number;
    browseMode: 'popular' | 'latest' | 'search';
    searchQuery: string;

    currentManga: any | null;
    currentChapters: Chapter[];
    currentPages: string[];
    currentPageIndex: number;

    history: HistoryEntry[];

    tags: Tag[];
    selectedTag: Tag | null;

    captchaUrl: string | null;
    captchaCallback: (() => void) | null;

    prefetchedChapters: Map<string, string[]>;
    prefetchInProgress: Set<string>;

    loadLibrary: () => Promise<void>;
    loadExtensions: () => Promise<void>;
    selectExtension: (ext: Extension) => void;
    browseMangaList: (mode: 'popular' | 'latest', page?: number) => Promise<void>;
    searchMangaList: (query: string, page?: number) => Promise<void>;
    loadMoreBrowse: () => Promise<void>;
    loadMangaDetails: (extensionId: string, mangaId: string) => Promise<void>;
    loadChapters: (extensionId: string, mangaId: string) => Promise<void>;
    getMangaByTag: (tagId: number) => Promise<any[]>;
    loadChapterPages: (extensionId: string, chapterId: string) => Promise<void>;
    addToLibrary: (manga: any, extensionId: string) => Promise<void>;
    removeFromLibrary: (mangaId: string) => Promise<void>;
    loadHistory: () => Promise<void>;
    removeFromHistory: (mangaId: string) => Promise<void>;
    loadTags: () => Promise<void>;
    createTag: (name: string, color: string) => Promise<void>;
    updateTag: (id: number, name: string, color: string) => Promise<void>;
    deleteTag: (tagId: number) => Promise<void>;
    addTagToManga: (mangaId: string, tagId: number) => Promise<void>;
    removeTagFromManga: (mangaId: string, tagId: number) => Promise<void>;
    setCurrentPageIndex: (index: number) => void;
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
}

export const useAppStore = create<AppState>((set, get) => ({
    library: [],
    loadingLibrary: false,
    extensions: [],
    selectedExtension: null,
    browseManga: [],
    browseLoading: false,
    browseHasMore: true,
    browsePage: 1,
    browseMode: 'popular',
    searchQuery: '',
    currentManga: null,
    currentChapters: [],
    currentPages: [],
    currentPageIndex: 0,
    history: [],
    tags: [],
    selectedTag: null,
    captchaUrl: null,
    captchaCallback: null,
    prefetchedChapters: new Map(),
    prefetchInProgress: new Set(),

    loadLibrary: async () => {
        set({ loadingLibrary: true });
        try {
            const library = await window.electronAPI.db.getAllManga();
            set({ library, loadingLibrary: false });
        } catch (error) {
            console.error('Failed to load library:', error);
            set({ loadingLibrary: false });
        }
    },

    loadExtensions: async () => {
        try {
            const extensions = await window.electronAPI.extensions.getAll();
            set({ extensions });
            if (extensions.length > 0 && !get().selectedExtension) {
                set({ selectedExtension: extensions[0] });
            }
        } catch (error) {
            console.error('Failed to load extensions:', error);
        }
    },

    selectExtension: (ext) => {
        set({
            selectedExtension: ext,
            browseManga: [],
            browsePage: 1,
            browseHasMore: true,
        });
    },

    browseMangaList: async (mode, page = 1) => {
        const ext = get().selectedExtension;
        if (!ext) return;

        set({ browseLoading: true, browseMode: mode, searchQuery: '' });

        try {
            const result = mode === 'popular'
                ? await window.electronAPI.extensions.getPopularManga(ext.id, page)
                : await window.electronAPI.extensions.getLatestManga(ext.id, page);

            set({
                browseManga: page === 1 ? result.manga : [...get().browseManga, ...result.manga],
                browseHasMore: result.hasNextPage,
                browsePage: page,
                browseLoading: false,
            });
        } catch (error: any) {
            console.error('Failed to browse manga:', error);
            set({ browseLoading: false });

            const errorMsg = error?.message || '';
            if (errorMsg.includes('fetch failed') || errorMsg.includes('403') || errorMsg.includes('503')) {
                get().showCaptcha(ext.baseUrl, () => {
                    get().browseMangaList(mode, page);
                });
            }
        }
    },

    searchMangaList: async (query, page = 1) => {
        const ext = get().selectedExtension;
        if (!ext || !query.trim()) return;

        set({ browseLoading: true, browseMode: 'search', searchQuery: query });

        try {
            const result = await window.electronAPI.extensions.searchManga(ext.id, query, page);

            set({
                browseManga: page === 1 ? result.manga : [...get().browseManga, ...result.manga],
                browseHasMore: result.hasNextPage,
                browsePage: page,
                browseLoading: false,
            });
        } catch (error: any) {
            console.error('Failed to search manga:', error);
            set({ browseLoading: false });

            const errorMsg = error?.message || '';
            if (errorMsg.includes('fetch failed') || errorMsg.includes('403') || errorMsg.includes('503')) {
                get().showCaptcha(ext.baseUrl, () => {
                    get().searchMangaList(query, page);
                });
            }
        }
    },

    loadMoreBrowse: async () => {
        const { browseMode, browsePage, searchQuery, browseHasMore, browseLoading } = get();

        if (browseLoading || !browseHasMore) return;

        if (browseMode === 'search') {
            await get().searchMangaList(searchQuery, browsePage + 1);
        } else {
            await get().browseMangaList(browseMode, browsePage + 1);
        }
    },

    loadMangaDetails: async (extensionId, mangaId) => {
        try {
            const details = await window.electronAPI.extensions.getMangaDetails(extensionId, mangaId);
            set({ currentManga: { ...details, extensionId } });
        } catch (error) {
            console.error('Failed to load manga details:', error);
        }
    },

    loadChapters: async (extensionId, mangaId) => {
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
                    get().loadLibrary();
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

    getMangaByTag: async (tagId) => {
        try {
            return await window.electronAPI.db.getMangaByTag(tagId);
        } catch (error) {
            console.error('Failed to get manga by tag:', error);
            return [];
        }
    },

    loadChapterPages: async (extensionId, chapterId) => {
        const cached = get().prefetchedChapters.get(chapterId);
        if (cached && cached.length > 0) {
            set({ currentPages: cached, currentPageIndex: 0 });
            return;
        }

        try {
            const pages = await window.electronAPI.extensions.getChapterPages(extensionId, chapterId);
            set({ currentPages: pages, currentPageIndex: 0 });
        } catch (error) {
            console.error('Failed to load chapter pages:', error);
        }
    },

    addToLibrary: async (manga, extensionId) => {
        try {
            const sourceId = extensionId || manga.extensionId || manga.source_id;

            if (!sourceId) {
                console.error('addToLibrary: Missing extensionId/source_id', { manga, extensionId });
                throw new Error('Missing source_id for manga');
            }

            const id = `${sourceId}:${manga.id}`;
            await window.electronAPI.db.addManga({
                id,
                source_id: sourceId,
                source_manga_id: manga.id,
                title: manga.title,
                cover_url: manga.coverUrl,
                author: manga.author || '',
                artist: manga.artist || '',
                description: manga.description || '',
                status: manga.status || 'unknown',
            });
            await get().loadLibrary();
        } catch (error) {
            console.error('Failed to add to library:', error);
        }
    },

    removeFromLibrary: async (mangaId) => {
        try {
            await window.electronAPI.db.deleteManga(mangaId);
            await get().loadLibrary();
        } catch (error) {
            console.error('Failed to remove from library:', error);
        }
    },

    loadHistory: async () => {
        try {
            const history = await window.electronAPI.db.getHistory(50);
            set({ history });
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    },

    removeFromHistory: async (mangaId: string) => {
        try {
            await window.electronAPI.db.deleteHistory(mangaId);
            await get().loadHistory();
        } catch (error) {
            console.error('Failed to remove from history:', error);
        }
    },

    loadTags: async () => {
        try {
            const tags = await window.electronAPI.db.getTags();
            set({ tags });
        } catch (error) {
            console.error('Failed to load tags:', error);
        }
    },

    createTag: async (name, color) => {
        try {
            await window.electronAPI.db.createTag(name, color);
            await get().loadTags();
        } catch (error) {
            console.error('Failed to create tag:', error);
        }
    },

    updateTag: async (id, name, color) => {
        try {
            await window.electronAPI.db.updateTag(id, name, color);
            await get().loadTags();
        } catch (error) {
            console.error('Failed to update tag:', error);
        }
    },

    deleteTag: async (tagId) => {
        try {
            await window.electronAPI.db.deleteTag(tagId);
            await get().loadTags();
        } catch (error) {
            console.error('Failed to delete tag:', error);
        }
    },

    addTagToManga: async (mangaId, tagId) => {
        try {
            await window.electronAPI.db.addTagToManga(mangaId, tagId);
            await get().loadTags();
        } catch (error) {
            console.error('Failed to add tag to manga:', error);
        }
    },

    removeTagFromManga: async (mangaId, tagId) => {
        try {
            await window.electronAPI.db.removeTagFromManga(mangaId, tagId);
            await get().loadTags();
        } catch (error) {
            console.error('Failed to remove tag from manga:', error);
        }
    },

    setCurrentPageIndex: (index) => {
        set({ currentPageIndex: index });
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

            get().loadLibrary();
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

            get().loadLibrary();
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

            get().loadLibrary();
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

            get().loadLibrary();

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
                console.log('Prefetching chapter:', chapterId);
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
                    await Promise.all(batch.map(url =>
                        window.electronAPI.cache.save(url, extensionId, mangaId, chapterId)
                            .catch(e => console.error('Failed to cache page:', url, e))
                    ));
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
}));
