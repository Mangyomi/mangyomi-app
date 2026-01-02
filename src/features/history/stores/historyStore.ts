import { create } from 'zustand';

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

interface HistoryState {
    history: HistoryEntry[];
    loadingHistory: boolean;

    // Actions
    loadHistory: () => Promise<void>;
    removeFromHistory: (mangaId: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
    history: [],
    loadingHistory: false,

    loadHistory: async () => {
        set({ loadingHistory: true });
        try {
            const history = await window.electronAPI.db.getHistory(50);
            set({ history, loadingHistory: false });
        } catch (error) {
            console.error('Failed to load history:', error);
            set({ loadingHistory: false });
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
}));
