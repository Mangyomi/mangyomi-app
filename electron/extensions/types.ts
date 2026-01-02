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
    url?: string;
}

export interface Chapter {
    id: string;
    title: string;
    chapterNumber: number;
    volumeNumber?: number;
    url: string;
    uploadDate?: number;
}

export interface FilterOption {
    value: string;
    label: string;
}

export interface ExtensionFilter {
    id: string;
    label: string;
    type: 'select' | 'tri-state';
    options: FilterOption[];
    default?: string | string[];
}

export interface TriStateFilterValue {
    include: string[];
    exclude: string[];
}

export type FilterValues = Record<string, string | string[] | TriStateFilterValue>;

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

    // Filters (optional - extensions without filters return empty array)
    getFilters?(): ExtensionFilter[];

    // Discovery
    getPopularManga(page: number, filters?: FilterValues): Promise<MangaListResult>;
    getLatestManga(page: number, filters?: FilterValues): Promise<MangaListResult>;
    searchManga(query: string, page: number): Promise<MangaListResult>;

    // Details
    getMangaDetails(mangaId: string): Promise<MangaDetails>;
    getChapterList(mangaId: string): Promise<Chapter[]>;

    // Reading
    getChapterPages(chapterId: string): Promise<string[]>;
}

export interface ExtensionIcon {
    svg?: string;
    png?: string;
}

export interface ExtensionManifest {
    id: string;
    name: string;
    version: string;
    baseUrl: string;
    icon?: ExtensionIcon | string; // Support both new object format and legacy string
    language: string;
    nsfw: boolean;
}
