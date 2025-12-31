/// <reference types="vite/client" />

declare const APP_VERSION: string;

interface AvailableExtension {
    id: string;
    name: string;
    version: string;
    baseUrl: string;
    icon?: string;
    language: string;
    nsfw: boolean;
    repoUrl: string;
    folderName: string;
    installed: boolean;
}

interface InstallResult {
    success: boolean;
    error?: string;
}

interface Window {
    electronAPI: {
        db: {
            getManga: (id: string) => Promise<any>;
            getAllManga: () => Promise<any[]>;
            addManga: (manga: any) => Promise<void>;
            updateManga: (id: string, data: any) => Promise<void>;
            deleteManga: (id: string) => Promise<void>;
            ensureManga: (manga: any) => Promise<void>;
            getChapters: (mangaId: string) => Promise<any[]>;
            addChapters: (chapters: any[]) => Promise<void>;
            markChapterRead: (chapterId: string, pageNumber?: number) => Promise<void>;
            markChapterUnread: (chapterId: string) => Promise<void>;
            markChaptersRead: (chapterIds: string[]) => Promise<void>;
            markChaptersUnread: (chapterIds: string[]) => Promise<void>;
            saveReadingProgress: (manga: any, chapter: any, pageNumber: number) => Promise<void>;
            getHistory: (limit?: number) => Promise<any[]>;
            deleteHistory: (mangaId: string) => Promise<void>;
            getTags: () => Promise<any[]>;
            createTag: (name: string, color: string) => Promise<any>;
            updateTag: (id: number, name: string, color: string) => Promise<void>;
            deleteTag: (id: number) => Promise<void>;
            addTagToManga: (mangaId: string, tagId: number) => Promise<void>;
            removeTagFromManga: (mangaId: string, tagId: number) => Promise<void>;
            getMangaByTag: (tagId: number) => Promise<any[]>;
            getTagsForManga: (mangaId: string) => Promise<Tag[]>;
        };
        window: {
            minimize: () => Promise<void>;
            maximize: () => Promise<void>;
            close: () => Promise<void>;
        };
        extensions: {
            getAll: () => Promise<Extension[]>;
            enable: (id: string) => Promise<void>;
            disable: (id: string) => Promise<void>;
            listAvailable: (repoUrl: string) => Promise<AvailableExtension[]>;
            install: (repoUrl: string, extensionId: string) => Promise<InstallResult>;
            uninstall: (extensionId: string) => Promise<InstallResult>;
            getPopularManga: (extensionId: string, page: number) => Promise<any>;
            getLatestManga: (extensionId: string, page: number) => Promise<any>;
            searchManga: (extensionId: string, query: string, page: number) => Promise<any>;
            getMangaDetails: (extensionId: string, mangaId: string) => Promise<any>;
            getChapterList: (extensionId: string, mangaId: string) => Promise<any[]>;
            getChapterPages: (extensionId: string, chapterId: string) => Promise<string[]>;
        };
        app: {
            createDumpLog: (consoleLogs: string, networkActivity: string) => Promise<{ success: boolean; path: string }>;
        };
        getProxiedImageUrl: (url: string, extensionId: string) => string;
    };
}
