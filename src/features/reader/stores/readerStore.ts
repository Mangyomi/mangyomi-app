import { create } from 'zustand';

interface ReaderState {
    pages: string[];
    currentPageIndex: number;
    zoomLevel: number;
    readerMode: 'vertical' | 'horizontal';
    loading: boolean;
    error: string | null;

    setPages: (pages: string[]) => void;
    setCurrentPageIndex: (index: number) => void;
    setZoomLevel: (zoom: number) => void;
    setReaderMode: (mode: 'vertical' | 'horizontal') => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;

    // Actions
    loadChapterPages: (extensionId: string, chapterId: string) => Promise<void>;
}

export const useReaderStore = create<ReaderState>((set) => ({
    pages: [],
    currentPageIndex: 0,
    zoomLevel: 1,
    readerMode: 'vertical', // Default, should ideally sync with settings but start simple
    loading: false,
    error: null,

    setPages: (pages) => set({ pages }),
    setCurrentPageIndex: (index) => set({ currentPageIndex: index }),
    setZoomLevel: (zoom) => set({ zoomLevel: zoom }),
    setReaderMode: (mode) => set({ readerMode: mode }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),

    loadChapterPages: async (extensionId, chapterId) => {
        set({ loading: true, error: null, pages: [], currentPageIndex: 0 });
        try {
            // We use the electronAPI directly here
            const pages = await window.electronAPI.extensions.getChapterPages(extensionId, chapterId);
            set({ pages, loading: false });
        } catch (error: any) {
            console.error('Failed to load chapter pages:', error);
            set({ error: error.message || 'Failed to load pages', loading: false });
        }
    }
}));
