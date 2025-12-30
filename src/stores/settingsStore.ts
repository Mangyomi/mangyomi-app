import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';
export type ReaderMode = 'vertical' | 'horizontal';

interface SettingsState {
    theme: Theme;
    defaultReaderMode: ReaderMode;
    prefetchChapters: number; // 0 = disabled, 1-4 = chapters to prefetch ahead/behind
    disabledExtensions: Set<string>;
    setTheme: (theme: Theme) => void;
    setDefaultReaderMode: (mode: ReaderMode) => void;
    setPrefetchChapters: (count: number) => void;
    toggleExtension: (extensionId: string) => void;
    isExtensionEnabled: (extensionId: string) => boolean;
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
    disabledExtensions: new Set<string>(),

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
        if ((stored as any).disabledExtensions) {
            set({ disabledExtensions: new Set((stored as any).disabledExtensions as string[]) });
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
