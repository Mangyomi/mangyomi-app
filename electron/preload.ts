import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    db: {
        getManga: (id: string) => ipcRenderer.invoke('db:getManga', id),
        getAllManga: () => ipcRenderer.invoke('db:getAllManga'),
        addManga: (manga: any) => ipcRenderer.invoke('db:addManga', manga),
        updateManga: (id: string, data: any) => ipcRenderer.invoke('db:updateManga', id, data),
        deleteManga: (id: string) => ipcRenderer.invoke('db:deleteManga', id),
        ensureManga: (manga: any) => ipcRenderer.invoke('db:ensureManga', manga),
        getChapters: (mangaId: string) => ipcRenderer.invoke('db:getChapters', mangaId),
        addChapters: (chapters: any[]) => ipcRenderer.invoke('db:addChapters', chapters),
        markChapterRead: (chapterId: string, pageNumber?: number) =>
            ipcRenderer.invoke('db:markChapterRead', chapterId, pageNumber),
        markChapterUnread: (chapterId: string) => ipcRenderer.invoke('db:markChapterUnread', chapterId),
        markChaptersRead: (chapterIds: string[]) => ipcRenderer.invoke('db:markChaptersRead', chapterIds),
        markChaptersUnread: (chapterIds: string[]) => ipcRenderer.invoke('db:markChaptersUnread', chapterIds),
        saveReadingProgress: (manga: any, chapter: any, pageNumber: number) =>
            ipcRenderer.invoke('db:saveReadingProgress', manga, chapter, pageNumber),
        getHistory: (limit?: number) => ipcRenderer.invoke('db:getHistory', limit),
        deleteHistory: (mangaId: string) => ipcRenderer.invoke('db:deleteHistory', mangaId),
        getTags: () => ipcRenderer.invoke('db:getTags'),
        createTag: (name: string, color: string) => ipcRenderer.invoke('db:createTag', name, color),
        updateTag: (id: number, name: string, color: string) => ipcRenderer.invoke('db:updateTag', id, name, color),
        deleteTag: (id: number) => ipcRenderer.invoke('db:deleteTag', id),
        addTagToManga: (mangaId: string, tagId: number) =>
            ipcRenderer.invoke('db:addTagToManga', mangaId, tagId),
        removeTagFromManga: (mangaId: string, tagId: number) =>
            ipcRenderer.invoke('db:removeTagFromManga', mangaId, tagId),
        getMangaByTag: (tagId: number) => ipcRenderer.invoke('db:getMangaByTag', tagId),
        getTagsForManga: (mangaId: string) => ipcRenderer.invoke('db:getTagsForManga', mangaId),
    },

    extensions: {
        getAll: () => ipcRenderer.invoke('ext:getAll'),
        enable: (id: string) => ipcRenderer.invoke('ext:enable', id),
        disable: (id: string) => ipcRenderer.invoke('ext:disable', id),
        listAvailable: (repoUrl: string) => ipcRenderer.invoke('ext:listAvailable', repoUrl),
        install: (repoUrl: string, extensionId: string) =>
            ipcRenderer.invoke('ext:install', repoUrl, extensionId),
        sideload: () => ipcRenderer.invoke('ext:sideload'),
        uninstall: (extensionId: string) => ipcRenderer.invoke('ext:uninstall', extensionId),
        getPopularManga: (extensionId: string, page: number) =>
            ipcRenderer.invoke('ext:getPopularManga', extensionId, page),
        getLatestManga: (extensionId: string, page: number) =>
            ipcRenderer.invoke('ext:getLatestManga', extensionId, page),
        searchManga: (extensionId: string, query: string, page: number) =>
            ipcRenderer.invoke('ext:searchManga', extensionId, query, page),
        getMangaDetails: (extensionId: string, mangaId: string) =>
            ipcRenderer.invoke('ext:getMangaDetails', extensionId, mangaId),
        getChapterList: (extensionId: string, mangaId: string) =>
            ipcRenderer.invoke('ext:getChapterList', extensionId, mangaId),
        getChapterPages: (extensionId: string, chapterId: string) =>
            ipcRenderer.invoke('ext:getChapterPages', extensionId, chapterId),
    },

    getProxiedImageUrl: (url: string, extensionId: string, mangaId?: string, chapterId?: string) => {
        let proxyUrl = `manga-image://proxy?url=${encodeURIComponent(url)}&ext=${extensionId}`;
        if (mangaId) proxyUrl += `&manga=${encodeURIComponent(mangaId)}`;
        if (chapterId) proxyUrl += `&chapter=${encodeURIComponent(chapterId)}`;
        return proxyUrl;
    },

    window: {
        minimize: () => ipcRenderer.invoke('window:minimize'),
        maximize: () => ipcRenderer.invoke('window:maximize'),
        close: () => ipcRenderer.invoke('window:close'),
    },

    app: {
        createDumpLog: (consoleLogs: string, networkActivity: string) =>
            ipcRenderer.invoke('app:createDumpLog', consoleLogs, networkActivity),
        openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
        openInAppBrowser: (url: string) => ipcRenderer.invoke('app:openInAppBrowser', url),
    },

    cache: {
        save: (url: string, extensionId: string, mangaId: string, chapterId: string) =>
            ipcRenderer.invoke('cache:save', url, extensionId, mangaId, chapterId),
        clear: (mangaId?: string) => ipcRenderer.invoke('cache:clear', mangaId),
        setLimit: (bytes: number) => ipcRenderer.invoke('cache:setLimit', bytes),
        getSize: () => ipcRenderer.invoke('cache:getSize') as Promise<number>,
        checkManga: (mangaId: string) => ipcRenderer.invoke('cache:checkManga', mangaId) as Promise<number>
    },

    anilist: {
        login: () => ipcRenderer.invoke('anilist:login'),
        logout: () => ipcRenderer.invoke('anilist:logout'),
        isAuthenticated: () => ipcRenderer.invoke('anilist:isAuthenticated') as Promise<boolean>,
        getUser: () => ipcRenderer.invoke('anilist:getUser'),
        setClientId: (clientId: string) => ipcRenderer.invoke('anilist:setClientId', clientId),
        searchManga: (query: string) => ipcRenderer.invoke('anilist:searchManga', query),
        getMangaById: (anilistId: number) => ipcRenderer.invoke('anilist:getMangaById', anilistId),
        linkManga: (mangaId: string, anilistId: number) =>
            ipcRenderer.invoke('anilist:linkManga', mangaId, anilistId),
        unlinkManga: (mangaId: string) => ipcRenderer.invoke('anilist:unlinkManga', mangaId),
        updateProgress: (anilistId: number, progress: number) =>
            ipcRenderer.invoke('anilist:updateProgress', anilistId, progress),
        syncProgress: (mangaId: string) => ipcRenderer.invoke('anilist:syncProgress', mangaId),
        getTokenData: () => ipcRenderer.invoke('anilist:getTokenData'),
        setTokenData: (data: string) => ipcRenderer.invoke('anilist:setTokenData', data),
    },

    discord: {
        updateActivity: (details: string, state: string, largeImageKey?: string, largeImageText?: string, smallImageKey?: string, smallImageText?: string, buttons?: { label: string; url: string }[]) =>
            ipcRenderer.invoke('discord:updateActivity', details, state, largeImageKey, largeImageText, smallImageKey, smallImageText, buttons),
        clearActivity: () => ipcRenderer.invoke('discord:clearActivity'),
    },
});
