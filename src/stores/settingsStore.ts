import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';
export type ReaderMode = 'vertical' | 'horizontal';

interface SettingsState {
    theme: Theme;
    defaultReaderMode: ReaderMode;
    prefetchChapters: number; // 0 = disabled, 1-4 = chapters to prefetch ahead/behind
    maxCacheSize: number; // in bytes
    disabledExtensions: Set<string>;
    hideNsfwInLibrary: boolean;
    hideNsfwInHistory: boolean;
    hideNsfwInTags: boolean;
    hideNsfwCompletely: boolean;
    setTheme: (theme: Theme) => void;
    setDefaultReaderMode: (mode: ReaderMode) => void;
    setPrefetchChapters: (count: number) => void;
    setMaxCacheSize: (size: number) => void;
    toggleExtension: (extensionId: string) => void;
    isExtensionEnabled: (extensionId: string) => boolean;
    setHideNsfwInLibrary: (value: boolean) => void;
    setHideNsfwInHistory: (value: boolean) => void;
    setHideNsfwInTags: (value: boolean) => void;
    setHideNsfwCompletely: (value: boolean) => void;
    loadSettings: () => void;
}

const STORAGE_KEY = 'mangyomi-settings';

const loadFromStorage = (): Partial<SettingsState> => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
    return {};
};


const saveToStorage = (settings: Partial<SettingsState>) => {
    try {
        const current = loadFromStorage();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...settings }));
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
};


const applyTheme = (theme: Theme) => {
    const root = document.documentElement;

    if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        root.setAttribute('data-theme', theme);
    }
};

export const useSettingsStore = create<SettingsState>((set, get) => ({

    theme: 'dark',
    defaultReaderMode: 'vertical',
    prefetchChapters: 0,
    maxCacheSize: 1024 * 1024 * 1024, // 1GB
    disabledExtensions: new Set<string>(),
    hideNsfwInLibrary: false,
    hideNsfwInHistory: false,
    hideNsfwInTags: false,
    hideNsfwCompletely: false,

    setTheme: (theme) => {
        set({ theme });
        saveToStorage({ theme });
        applyTheme(theme);
    },

    setDefaultReaderMode: (mode) => {
        set({ defaultReaderMode: mode });
        saveToStorage({ defaultReaderMode: mode });
    },

    setPrefetchChapters: (count) => {
        const validCount = Math.max(0, Math.min(4, count));
        set({ prefetchChapters: validCount });
        saveToStorage({ prefetchChapters: validCount });
    },

    setMaxCacheSize: (size) => {
        set({ maxCacheSize: size });
        saveToStorage({ maxCacheSize: size });
        window.electronAPI.cache.setLimit(size);
    },

    toggleExtension: (extensionId) => {
        const { disabledExtensions } = get();
        const newDisabled = new Set(disabledExtensions);
        if (newDisabled.has(extensionId)) {
            newDisabled.delete(extensionId);
        } else {
            newDisabled.add(extensionId);
        }
        set({ disabledExtensions: newDisabled });
        saveToStorage({ disabledExtensions: Array.from(newDisabled) } as any);
    },

    isExtensionEnabled: (extensionId) => {
        return !get().disabledExtensions.has(extensionId);
    },

    setHideNsfwInLibrary: (value) => {
        set({ hideNsfwInLibrary: value });
        saveToStorage({ hideNsfwInLibrary: value } as any);
    },

    setHideNsfwInHistory: (value) => {
        set({ hideNsfwInHistory: value });
        saveToStorage({ hideNsfwInHistory: value } as any);
    },

    setHideNsfwInTags: (value) => {
        set({ hideNsfwInTags: value });
        saveToStorage({ hideNsfwInTags: value } as any);
    },

    setHideNsfwCompletely: (value) => {
        set({ hideNsfwCompletely: value });
        saveToStorage({ hideNsfwCompletely: value } as any);
    },

    loadSettings: () => {
        const stored = loadFromStorage();
        if (stored.theme) {
            set({ theme: stored.theme as Theme });
            applyTheme(stored.theme as Theme);
        } else {
            applyTheme(get().theme);
        }
        if (stored.defaultReaderMode) {
            set({ defaultReaderMode: stored.defaultReaderMode as ReaderMode });
        }
        if (stored.prefetchChapters !== undefined) {
            set({ prefetchChapters: stored.prefetchChapters as number });
        }
        if (stored.maxCacheSize !== undefined) {
            set({ maxCacheSize: stored.maxCacheSize as number });
            // Sync initial limit to backend
            setTimeout(() => {
                window.electronAPI.cache.setLimit(stored.maxCacheSize as number);
            }, 1000); // Small delay to ensure backend is ready
        }
        if ((stored as any).disabledExtensions) {
            set({ disabledExtensions: new Set((stored as any).disabledExtensions as string[]) });
        }
        if ((stored as any).hideNsfwInLibrary !== undefined) {
            set({ hideNsfwInLibrary: (stored as any).hideNsfwInLibrary });
        }
        if ((stored as any).hideNsfwInHistory !== undefined) {
            set({ hideNsfwInHistory: (stored as any).hideNsfwInHistory });
        }
        if ((stored as any).hideNsfwInTags !== undefined) {
            set({ hideNsfwInTags: (stored as any).hideNsfwInTags });
        }
        if ((stored as any).hideNsfwCompletely !== undefined) {
            set({ hideNsfwCompletely: (stored as any).hideNsfwCompletely });
        }
    },
}));


if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const { theme } = useSettingsStore.getState();
        if (theme === 'system') {
            applyTheme('system');
        }
    });
}
