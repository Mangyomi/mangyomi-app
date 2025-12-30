// Extension type definitions

export interface MangaListItem {
    id: string;
    title: string;
    coverUrl: string;
    url: string;
}

export interface MangaListResult {
    manga: MangaListItem[];
    hasNextPage: boolean;
}

export interface MangaDetails {
    id: string;
    title: string;
    coverUrl: string;
    author: string;
    artist: string;
    description: string;
    status: 'ongoing' | 'completed' | 'hiatus' | 'unknown';
    genres: string[];
}

export interface Chapter {
    id: string;
    title: string;
    chapterNumber: number;
    volumeNumber?: number;
    url: string;
    uploadDate?: number;
}

export interface MangaExtension {
    // Metadata
    id: string;
    name: string;
    version: string;
    baseUrl: string;
    icon?: string;
    language: string;
    nsfw: boolean;

    // Required headers for image requests
    getImageHeaders(): Record<string, string>;

    // Discovery
    getPopularManga(page: number): Promise<MangaListResult>;
    getLatestManga(page: number): Promise<MangaListResult>;
    searchManga(query: string, page: number): Promise<MangaListResult>;

    // Details
    getMangaDetails(mangaId: string): Promise<MangaDetails>;
    getChapterList(mangaId: string): Promise<Chapter[]>;

    // Reading
    getChapterPages(chapterId: string): Promise<string[]>;
}

export interface ExtensionManifest {
    id: string;
    name: string;
    version: string;
    baseUrl: string;
    icon?: string;
    language: string;
    nsfw: boolean;
}
