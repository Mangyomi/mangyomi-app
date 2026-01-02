import { create } from 'zustand';

interface BrowseState {
    browseManga: any[];
    browseLoading: boolean;
    browseHasMore: boolean;
    browsePage: number;
    browseMode: 'popular' | 'latest' | 'search';
    searchQuery: string;

    setBrowseLoading: (loading: boolean) => void;

    // Actions
    browseMangaList: (extensionId: string, mode: 'popular' | 'latest', page?: number) => Promise<void>;
    searchMangaList: (extensionId: string, query: string, page?: number) => Promise<void>;
    loadMoreBrowse: (extensionId: string) => Promise<void>;
    resetBrowse: () => void;
}

export const useBrowseStore = create<BrowseState>((set, get) => ({
    browseManga: [],
    browseLoading: false,
    browseHasMore: true,
    browsePage: 1,
    browseMode: 'popular',
    searchQuery: '',

    setBrowseLoading: (loading) => set({ browseLoading: loading }),

    resetBrowse: () => set({
        browseManga: [],
        browsePage: 1,
        browseHasMore: true,
        browseMode: 'popular',
        searchQuery: '',
    }),

    browseMangaList: async (extensionId, mode, page = 1) => {
        set({ browseLoading: true, browseMode: mode, searchQuery: '' });

        try {
            // Note: Currently dependent on window.electronAPI
            // In a cleaner architectuer, we would inject this dependency
            const result = mode === 'popular'
                ? await window.electronAPI.extensions.getPopularManga(extensionId, page)
                : await window.electronAPI.extensions.getLatestManga(extensionId, page);

            set({
                browseManga: page === 1 ? result.manga : [...get().browseManga, ...result.manga],
                browseHasMore: result.hasNextPage,
                browsePage: page,
                browseLoading: false,
            });
        } catch (error: any) {
            console.error('Failed to browse manga:', error);
            set({ browseLoading: false });
            // Captcha handling logic from appStore needs to be handled in Component or via a shared UI store
            // For now we just log/stop loading
        }
    },

    searchMangaList: async (extensionId, query, page = 1) => {
        if (!query.trim()) return;
        set({ browseLoading: true, browseMode: 'search', searchQuery: query });

        try {
            const result = await window.electronAPI.extensions.searchManga(extensionId, query, page);

            set({
                browseManga: page === 1 ? result.manga : [...get().browseManga, ...result.manga],
                browseHasMore: result.hasNextPage,
                browsePage: page,
                browseLoading: false,
            });
        } catch (error: any) {
            console.error('Failed to search manga:', error);
            set({ browseLoading: false });
        }
    },

    loadMoreBrowse: async (extensionId) => {
        const { browseMode, browsePage, searchQuery, browseHasMore, browseLoading } = get();

        if (browseLoading || !browseHasMore) return;

        if (browseMode === 'search') {
            await get().searchMangaList(extensionId, searchQuery, browsePage + 1);
        } else {
            await get().browseMangaList(extensionId, browseMode, browsePage + 1);
        }
    },
}));
