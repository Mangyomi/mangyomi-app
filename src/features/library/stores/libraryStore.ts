import { create } from 'zustand';

// Assuming Manga interface is needed, we should probably export it from a shared type file or here.
// For now, let's redefine or import if possible. 
// appStore has Manga interface. I should duplicate it here or move it to a shared types file.
// Ideally shared types. But for now I'll include it here to make it self-contained.

export interface Manga {
    id: string; // Database ID
    source_id: string;
    source_manga_id: string;
    title: string;
    cover_url: string;
    anilist_id?: number;
    // ... other fields as needed
}

interface LibraryState {
    library: Manga[];
    loadingLibrary: boolean;

    loadLibrary: () => Promise<void>;
    addToLibrary: (manga: any, extensionId: string) => Promise<void>;
    removeFromLibrary: (mangaId: string) => Promise<void>;
    getMangaByTag: (tagId: number) => Promise<any[]>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
    library: [],
    loadingLibrary: false,

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
                cover_url: manga.coverUrl || manga.cover_url,
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

    getMangaByTag: async (tagId) => {
        try {
            return await window.electronAPI.db.getMangaByTag(tagId);
        } catch (error) {
            console.error('Failed to load manga by tag:', error);
            return [];
        }
    }
}));
