import { useState, useEffect, useMemo } from 'react';
import { useSettingsStore, Theme, ReaderMode } from '../../stores/settingsStore';
import { useAniListStore } from '../../stores/anilistStore';
import { useDialog } from '../../components/ConfirmModal/DialogContext';
import RangeSlider from '../../components/RangeSlider/RangeSlider';
import './Settings.css';

// Icons
const Icons = {
    General: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="currentColor" />
            <path fillRule="evenodd" clipRule="evenodd" d="M20.605 15.0001L22.84 16.2901C23.238 16.5211 23.376 17.0281 23.149 17.4321L21.149 20.8961C20.923 21.2991 20.413 21.4421 20.012 21.2161L17.777 19.9261C17.151 20.4071 16.459 20.8061 15.719 21.1111L15.38 23.6641C15.319 24.1201 14.927 24.4561 14.467 24.4561H10.467C10.007 24.4561 9.615 24.1201 9.554 23.6641L9.215 21.1111C8.475 20.8061 7.783 20.4071 7.157 19.9261L4.922 21.2161C4.522 21.4421 4.012 21.2991 3.785 20.8961L1.785 17.4321C1.558 17.0281 1.697 16.5211 2.094 16.2901L4.329 15.0001C4.24 14.2868 4.19532 13.5673 4.19532 12.8471C4.19532 11.2721 4.24032 10.5521 4.32932 9.83906L2.09432 8.54906C1.69632 8.31806 1.55832 7.81106 1.78532 7.40706L3.78532 3.94306C4.01132 3.54006 4.52132 3.39706 4.92232 3.62306L7.15732 4.91306C7.78332 4.43206 8.47532 4.03306 9.21532 3.72806L9.55432 1.17506C9.61532 0.719063 10.0073 0.383063 10.4673 0.383063H14.4673C14.9273 0.383063 15.3193 0.719063 15.3803 1.17506L15.7193 3.72806C16.4593 4.03306 17.1513 4.43206 17.7773 4.91306L20.0123 3.62306C20.4123 3.39706 20.9233 3.54006 21.1493 3.94306L23.1493 7.40706C23.3763 7.81106 23.2383 8.31806 22.8403 8.54906L20.6053 9.83906C20.6943 10.5521 20.7393 11.2721 20.7393 11.9921C20.7393 12.7121 20.6943 13.4321 20.6053 14.1521V15.0001ZM12 17.0001C14.761 17.0001 17 14.7611 17 12.0001C17 9.23906 14.761 7.00006 12 7.00006C9.239 7.00006 7 9.23906 7 12.0001C7 14.7611 9.239 17.0001 12 17.0001Z" fill="currentColor" />
        </svg>
    ),
    Library: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M3 20H21V22H3V20ZM5 4H9V18H5V4ZM11 4H19V18H11V4Z" fill="currentColor" />
        </svg>
    ),
    Reader: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5.56417C10.5298 3.65545 7.84651 2.37056 4.79373 2.11216C4.38539 2.0776 4.013 2.38712 4.013 2.79815V16.3276C4.013 16.7118 4.34149 17.0142 4.72314 17.051C7.81745 17.3491 10.4287 18.7303 11.7828 20.606C11.9168 20.7915 12.2155 20.7852 12.3421 20.5937C13.6875 18.558 16.2905 17.0984 19.4674 16.9634C19.7573 16.9511 20 16.7126 20 16.4226V2.79367C20 2.39294 19.6456 2.08388 19.2464 2.1643C16.8904 2.63914 13.9113 4.09322 12 5.56417Z" fill="currentColor" />
        </svg>
    ),
    Storage: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M6.99999 2C4.23857 2 1.99999 4.23858 1.99999 7C1.99999 9.76142 4.23857 12 6.99999 12H17C19.7614 12 22 9.76142 22 7C22 4.23858 19.7614 2 17 2H6.99999ZM6.99999 4C5.34313 4 3.99999 5.34315 3.99999 7C3.99999 8.65685 5.34313 10 6.99999 10H17C18.6568 10 20 8.65685 20 7C20 5.34315 18.6568 4 17 4H6.99999ZM6.99846 14C4.23704 14 1.99846 16.2386 1.99846 19C1.99846 21.7614 4.23704 24 6.99846 24H16.9985C19.7599 24 21.9985 21.7614 21.9985 19C21.9985 16.2386 19.7599 14 16.9985 14H6.99846ZM6.99846 16C5.34161 16 3.99846 17.3431 3.99846 19C3.99846 20.6569 5.34161 22 6.99846 22H16.9985C18.6553 22 19.9985 20.6569 19.9985 19C19.9985 17.3431 18.6553 16 16.9985 16H6.99846Z" fill="currentColor" />
            <path d="M6 7C6 6.44772 6.44772 6 7 6H9C9.55228 6 10 6.44772 10 7C10 7.55228 9.55228 8 9 8H7C6.44772 8 6 7.55228 6 7Z" fill="currentColor" />
            <path d="M6.00153 19C6.00153 18.4477 6.44924 18 7.00153 18H9.00153C9.55381 18 10.0015 18.4477 10.0015 19C10.0015 19.5523 9.55381 20 9.00153 20H7.00153C6.44924 20 6.00153 19.5523 6.00153 19Z" fill="currentColor" />
        </svg>
    ),
    Tracking: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3ZM1 12C1 5.92487 5.92487 1 12 1C18.0751 1 23 5.92487 23 12C23 18.0751 18.0751 23 12 23C5.92487 23 1 18.0751 1 12Z" fill="currentColor" />
            <path d="M13 7C13 6.44772 12.5523 6 12 6C11.4477 6 11 6.44772 11 7V12.1649L13.8837 14.881C14.2868 15.2607 14.9229 15.2433 15.3026 14.8402C15.6823 14.4371 15.6649 13.801 15.2618 13.4214L13 11.2917V7Z" fill="currentColor" />
        </svg>
    ),
    Advanced: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M14.6493 2.16075C13.2033 1.56475 11.5853 1.54275 10.1213 2.06275L9.62332 3.46875C9.46732 3.90875 9.06632 4.22075 8.60432 4.26475L7.13532 4.40475C5.72332 4.54075 4.39932 5.17675 3.39532 6.19575L2.34832 7.25375C1.34732 8.26775 0.730321 9.59975 0.605321 11.0188L0.475321 12.4938C0.434321 12.9578 0.125321 13.3618 -0.312679 13.5218L-1.70968 14.0328C-3.16068 14.5638 -4.16868 15.9398 -4.20568 17.5058C-4.22968 18.5298 -3.85868 19.5088 -3.15968 20.2458L3.75432 13.3328C4.53532 12.5518 5.79932 12.5518 6.58032 13.3328C7.36132 14.1138 7.36132 15.3778 6.58032 16.1588L-0.332679 23.0718C0.395321 23.7848 1.36632 24.1708 2.39032 24.1618C3.95532 24.1488 5.34132 23.1508 5.88932 21.7058L6.41732 20.3148C6.58332 19.8778 6.99732 19.5708 7.46632 19.5358L8.95532 19.4248C10.3873 19.3178 11.7313 18.6678 12.7503 17.6338L13.8113 16.5598C14.8283 15.5298 15.4543 14.1758 15.5803 12.7308L15.7113 11.2368C15.7533 10.7678 16.0663 10.3588 16.5103 10.1988L17.9253 9.68775C19.3893 9.15775 20.4073 7.77075 20.4433 6.19575C20.4803 4.54275 19.4703 3.03075 17.9653 2.40975L14.6493 2.16075ZM22.2473 11.7768C22.6863 11.9568 23.0803 11.5628 22.9003 11.1238L19.4973 2.80975C19.3363 2.41675 18.7893 2.39375 18.5953 2.76075C17.6533 4.53875 15.7553 5.76475 13.5653 5.80175C11.3753 5.83975 9.38632 4.71775 8.32432 3.00375C8.07732 2.60575 7.49832 2.57775 7.29132 2.96975L3.38532 10.3478C3.17832 10.7388 3.52032 11.1898 3.94732 11.0858C5.50832 10.7048 7.15932 10.8758 8.60832 11.5948C9.52932 12.0518 10.3413 12.6988 11.0153 13.4888L11.0963 13.5688C11.7963 14.2498 12.4283 15.0688 12.8683 15.9988C13.5603 17.4618 13.7103 19.1248 13.3073 20.6978C13.2003 21.1168 13.6263 21.4888 14.0223 21.3068L22.2473 11.7768Z" fill="currentColor" />
        </svg>
    ),
    Discord: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.1c.31.61.67 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.85 2.12-1.89 2.12z" fill="currentColor" />
        </svg>
    ),
};

// Category definitions
const CATEGORIES = [
    { id: 'general', label: 'General', icon: <Icons.General /> },
    { id: 'library', label: 'Library', icon: <Icons.Library /> },
    { id: 'reader', label: 'Reader', icon: <Icons.Reader /> },
    { id: 'cache', label: 'Storage', icon: <Icons.Storage /> },
    { id: 'tracking', label: 'Tracking', icon: <Icons.Tracking /> },
    { id: 'discord', label: 'Discord', icon: <Icons.Discord /> },
    { id: 'advanced', label: 'Advanced', icon: <Icons.Advanced /> },
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

// Setting item definition for search
interface SettingDef {
    id: string;
    category: CategoryId;
    label: string;
    description: string;
    keywords: string[];
}

const SETTING_DEFINITIONS: SettingDef[] = [
    { id: 'theme', category: 'general', label: 'Theme', description: 'Choose your preferred color theme', keywords: ['dark', 'light', 'system', 'appearance', 'color'] },
    { id: 'nsfw-all', category: 'library', label: 'Hide All NSFW Content', description: 'Completely hide manga from NSFW sources', keywords: ['nsfw', 'adult', 'filter', 'hide', 'content'] },
    { id: 'nsfw-library', category: 'library', label: 'Hide in Library', description: 'Hide NSFW manga in the Library view', keywords: ['nsfw', 'library', 'filter'] },
    { id: 'nsfw-history', category: 'library', label: 'Hide in History', description: 'Hide NSFW manga in reading history', keywords: ['nsfw', 'history', 'filter'] },
    { id: 'nsfw-tags', category: 'library', label: 'Hide in Tags', description: 'Hide NSFW manga in tag views', keywords: ['nsfw', 'tags', 'filter'] },
    { id: 'reader-mode', category: 'reader', label: 'Default Reader Mode', description: 'Set the default reading mode for chapters', keywords: ['vertical', 'horizontal', 'scroll', 'reading'] },
    { id: 'prefetch', category: 'reader', label: 'Chapter Prefetch', description: 'Preload adjacent chapters for faster navigation', keywords: ['preload', 'performance', 'speed'] },
    { id: 'cache-size', category: 'cache', label: 'Max Cache Size', description: 'Limit disk space for offline images', keywords: ['storage', 'disk', 'space', 'limit'] },
    { id: 'clear-cache', category: 'cache', label: 'Clear Cache', description: 'Delete all cached images and browser data', keywords: ['clear', 'delete', 'clean'] },
    { id: 'anilist', category: 'tracking', label: 'AniList', description: 'Sync reading progress with AniList', keywords: ['anilist', 'sync', 'tracking', 'progress'] },
    { id: 'discord', category: 'discord', label: 'Discord Rich Presence', description: 'Show what you are reading on Discord', keywords: ['discord', 'rpc', 'presence', 'status', 'tracking'] },
    { id: 'discord-nsfw', category: 'discord', label: 'Hide NSFW from Discord', description: 'Do not show NSFW titles on Discord status', keywords: ['discord', 'nsfw', 'hide', 'privacy'] },
    { id: 'discord-strict', category: 'discord', label: 'Strict NSFW Detection', description: 'Treat all content from NSFW extensions as NSFW', keywords: ['discord', 'nsfw', 'strict', 'extension'] },
    { id: 'debug-log', category: 'advanced', label: 'Create Debug Log', description: 'Generate log file for troubleshooting', keywords: ['debug', 'log', 'error', 'support'] },
    { id: 'developer-mode', category: 'advanced', label: 'Developer Mode', description: 'Enable advanced features like extension sideloading', keywords: ['developer', 'dev', 'sideload', 'extension'] },
];

function Settings() {
    const [cacheSize, setCacheSize] = useState<number>(0);
    const [activeCategory, setActiveCategory] = useState<CategoryId>('general');
    const [searchQuery, setSearchQuery] = useState('');
    const dialog = useDialog();

    useEffect(() => {
        window.electronAPI.cache.getSize().then(setCacheSize);
    }, []);

    const {
        isAuthenticated: isAniListAuthenticated,
        user: anilistUser,
        isLoading: anilistLoading,
        login: anilistLogin,
        logout: anilistLogout,
        loadFromStorage: loadAnilistFromStorage,
    } = useAniListStore();

    useEffect(() => {
        loadAnilistFromStorage();
    }, []);

    const {
        theme, defaultReaderMode, prefetchChapters, maxCacheSize,
        hideNsfwInLibrary, hideNsfwInHistory, hideNsfwInTags, hideNsfwCompletely, developerMode,
        discordRpcEnabled, discordRpcHideNsfw, discordRpcStrictNsfw,
        setTheme, setDefaultReaderMode, setPrefetchChapters, setMaxCacheSize,
        setHideNsfwInLibrary, setHideNsfwInHistory, setHideNsfwInTags, setHideNsfwCompletely, setDeveloperMode,
        setDiscordRpcEnabled, setDiscordRpcHideNsfw, setDiscordRpcStrictNsfw,
    } = useSettingsStore();

    // Fuzzy search filter
    const filteredSettings = useMemo(() => {
        if (!searchQuery.trim()) return null;
        const query = searchQuery.toLowerCase();
        return SETTING_DEFINITIONS.filter(setting =>
            setting.label.toLowerCase().includes(query) ||
            setting.description.toLowerCase().includes(query) ||
            setting.keywords.some(k => k.includes(query))
        );
    }, [searchQuery]);

    const isSearching = searchQuery.trim().length > 0;
    const visibleCategories = isSearching
        ? [...new Set(filteredSettings?.map(s => s.category) || [])]
        : [activeCategory];

    const formatSize = (bytes: number) => {
        if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
        return `${Math.round(bytes / 1024 / 1024)} MB`;
    };

    const themes: { value: Theme; label: string }[] = [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
        { value: 'system', label: 'System' },
    ];

    const readerModes: { value: ReaderMode; label: string }[] = [
        { value: 'vertical', label: 'Vertical Scroll' },
        { value: 'horizontal', label: 'Horizontal Pages' },
    ];

    const shouldShow = (settingId: string) => {
        if (!isSearching) return true;
        return filteredSettings?.some(s => s.id === settingId);
    };

    const renderGeneralSettings = () => (
        <section className="settings-section" data-category="general">
            <h2 className="section-title">General</h2>
            {shouldShow('theme') && (
                <div className="setting-item">
                    <div className="setting-info">
                        <label className="setting-label">Theme</label>
                        <span className="setting-description">Choose your preferred color theme</span>
                    </div>
                    <div className="setting-control">
                        <div className="toggle-group">
                            {themes.map((t) => (
                                <button
                                    key={t.value}
                                    className={`toggle-btn ${theme === t.value ? 'active' : ''}`}
                                    onClick={() => setTheme(t.value)}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );

    const renderLibrarySettings = () => (
        <section className="settings-section" data-category="library">
            <h2 className="section-title">Library</h2>
            {shouldShow('nsfw-all') && (
                <div className="setting-item">
                    <div className="setting-info">
                        <label className="setting-label">Hide All NSFW Content</label>
                        <span className="setting-description">Completely hide manga from NSFW sources everywhere</span>
                    </div>
                    <div className="setting-control">
                        <label className="checkbox-switch">
                            <input type="checkbox" checked={hideNsfwCompletely} onChange={(e) => setHideNsfwCompletely(e.target.checked)} />
                            <span className="checkbox-slider"></span>
                        </label>
                    </div>
                </div>
            )}
            <div className={`sub-settings ${hideNsfwCompletely ? 'disabled' : ''}`}>
                {shouldShow('nsfw-library') && (
                    <div className="setting-item sub-item">
                        <div className="setting-info">
                            <label className="setting-label">Hide in Library</label>
                            <span className="setting-description">Hide NSFW manga in the Library "All" view</span>
                        </div>
                        <div className="setting-control">
                            <label className="checkbox-switch">
                                <input type="checkbox" checked={hideNsfwCompletely || hideNsfwInLibrary} disabled={hideNsfwCompletely} onChange={(e) => setHideNsfwInLibrary(e.target.checked)} />
                                <span className="checkbox-slider"></span>
                            </label>
                        </div>
                    </div>
                )}
                {shouldShow('nsfw-history') && (
                    <div className="setting-item sub-item">
                        <div className="setting-info">
                            <label className="setting-label">Hide in History</label>
                            <span className="setting-description">Hide NSFW manga in your reading history</span>
                        </div>
                        <div className="setting-control">
                            <label className="checkbox-switch">
                                <input type="checkbox" checked={hideNsfwCompletely || hideNsfwInHistory} disabled={hideNsfwCompletely} onChange={(e) => setHideNsfwInHistory(e.target.checked)} />
                                <span className="checkbox-slider"></span>
                            </label>
                        </div>
                    </div>
                )}
                {shouldShow('nsfw-tags') && (
                    <div className="setting-item sub-item">
                        <div className="setting-info">
                            <label className="setting-label">Hide in Tags</label>
                            <span className="setting-description">Hide NSFW manga in tag views and Tags page</span>
                        </div>
                        <div className="setting-control">
                            <label className="checkbox-switch">
                                <input type="checkbox" checked={hideNsfwCompletely || hideNsfwInTags} disabled={hideNsfwCompletely} onChange={(e) => setHideNsfwInTags(e.target.checked)} />
                                <span className="checkbox-slider"></span>
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );

    const renderReaderSettings = () => (
        <section className="settings-section" data-category="reader">
            <h2 className="section-title">Reader</h2>
            {shouldShow('reader-mode') && (
                <div className="setting-item">
                    <div className="setting-info">
                        <label className="setting-label">Default Reader Mode</label>
                        <span className="setting-description">Set the default reading mode for chapters</span>
                    </div>
                    <div className="setting-control">
                        <div className="toggle-group">
                            {readerModes.map((mode) => (
                                <button
                                    key={mode.value}
                                    className={`toggle-btn ${defaultReaderMode === mode.value ? 'active' : ''}`}
                                    onClick={() => setDefaultReaderMode(mode.value)}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {shouldShow('prefetch') && (
                <div className="setting-item">
                    <div className="setting-info">
                        <label className="setting-label">Chapter Prefetch</label>
                        <span className="setting-description">
                            Preload adjacent chapters for faster navigation.
                            {prefetchChapters === 0 ? ' Currently disabled.' : ` Currently preloading ${prefetchChapters} chapter(s).`}
                        </span>
                    </div>
                    <div className="setting-control">
                        <RangeSlider
                            min={0}
                            max={4}
                            step={1}
                            value={prefetchChapters}
                            onChange={setPrefetchChapters}
                            ticks={[
                                { value: 0, label: 'Off' },
                                { value: 1, label: '1' },
                                { value: 2, label: '2' },
                                { value: 3, label: '3' },
                                { value: 4, label: '4' },
                            ]}
                        />
                    </div>
                </div>
            )}
        </section>
    );

    const renderCacheSettings = () => (
        <section className="settings-section" data-category="cache">
            <h2 className="section-title">Storage</h2>
            {shouldShow('cache-size') && (
                <div className="setting-item">
                    <div className="setting-info">
                        <label className="setting-label">Max Cache Size</label>
                        <span className="setting-description">
                            Limit the disk space used for offline images. Currently set to <strong>{formatSize(maxCacheSize || 1024 * 1024 * 1024)}</strong>.
                        </span>
                    </div>
                    <div className="setting-control">
                        <RangeSlider
                            min={256 * 1024 * 1024}
                            max={8 * 1024 * 1024 * 1024}
                            step={256 * 1024 * 1024}
                            value={maxCacheSize || 1024 * 1024 * 1024}
                            onChange={setMaxCacheSize}
                            ticks={[
                                { value: 256 * 1024 * 1024, label: '256MB' },
                                { value: 4 * 1024 * 1024 * 1024, label: '4GB' },
                                { value: 8 * 1024 * 1024 * 1024, label: '8GB' },
                            ]}
                        />
                    </div>
                </div>
            )}
            {shouldShow('clear-cache') && (
                <div className="setting-item align-end">
                    <div className="setting-info">
                        <label className="setting-label">Clear Cache</label>
                        <span className="setting-description">Current cache size: <strong>{formatSize(cacheSize)}</strong>. Clears all cached images.</span>
                    </div>
                    <div className="setting-control">
                        <button className="action-btn danger" onClick={async () => {
                            const confirmed = await dialog.confirm({ title: 'Clear Cache', message: 'Delete all cached data?' });
                            if (confirmed) {
                                await window.electronAPI.cache.clear();
                                setCacheSize(0);
                            }
                        }}>Clear Cache</button>
                    </div>
                </div>
            )}
        </section>
    );

    const renderTrackingSettings = () => (
        <section className="settings-section" data-category="tracking">
            <h2 className="section-title">Tracking</h2>
            {shouldShow('anilist') && (
                <div className="setting-item">
                    <div className="setting-info">
                        <label className="setting-label">AniList</label>
                        <span className="setting-description">
                            {isAniListAuthenticated && anilistUser ? `Connected as ${anilistUser.name}` : 'Sync your reading progress with AniList'}
                        </span>
                    </div>
                    <div className="setting-control">
                        {isAniListAuthenticated ? (
                            <div className="anilist-user-info">
                                {anilistUser?.avatar?.medium && <img src={anilistUser.avatar.medium} alt={anilistUser.name} className="anilist-avatar" />}
                                <button className="action-btn logout-btn" onClick={async () => {
                                    const confirmed = await dialog.confirm({ title: 'Disconnect AniList?', message: 'Your tracking links will be preserved but progress will no longer sync.' });
                                    if (confirmed) await anilistLogout();
                                }}>Disconnect</button>
                            </div>
                        ) : (
                            <button className="action-btn" onClick={anilistLogin} disabled={anilistLoading}>
                                {anilistLoading ? 'Connecting...' : 'Connect'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </section>
    );

    const renderDiscordSettings = () => (
        <section className="settings-section" data-category="discord">
            <h2 className="section-title">Discord</h2>
            {shouldShow('discord') && (
                <div className="setting-item">
                    <div className="setting-info">
                        <label className="setting-label">Discord Rich Presence</label>
                        <span className="setting-description">Show your current reading activity on your Discord profile</span>
                    </div>
                    <div className="setting-control">
                        <label className="checkbox-switch">
                            <input
                                type="checkbox"
                                checked={discordRpcEnabled}
                                onChange={(e) => setDiscordRpcEnabled(e.target.checked)}
                            />
                            <span className="checkbox-slider"></span>
                        </label>
                    </div>
                </div>
            )}
            <div className={`sub-settings ${!discordRpcEnabled ? 'disabled' : ''}`}>
                {shouldShow('discord-nsfw') && (
                    <div className="setting-item sub-item">
                        <div className="setting-info">
                            <label className="setting-label">Hide NSFW from Discord</label>
                            <span className="setting-description">If enabled, NSFW manga will not be shown on your status (privacy mode)</span>
                        </div>
                        <div className="setting-control">
                            <label className="checkbox-switch">
                                <input
                                    type="checkbox"
                                    checked={discordRpcHideNsfw}
                                    disabled={!discordRpcEnabled}
                                    onChange={(e) => setDiscordRpcHideNsfw(e.target.checked)}
                                />
                                <span className="checkbox-slider"></span>
                            </label>
                        </div>
                    </div>
                )}
                {shouldShow('discord-strict') && (
                    <div className="setting-item sub-item">
                        <div className="setting-info">
                            <label className="setting-label">Strict NSFW Detection</label>
                            <span className="setting-description">Treat all content from NSFW extensions (e.g. HentaiForce) as NSFW, even if not explicitly tagged</span>
                        </div>
                        <div className="setting-control">
                            <label className="checkbox-switch">
                                <input
                                    type="checkbox"
                                    checked={discordRpcStrictNsfw}
                                    disabled={!discordRpcEnabled || !discordRpcHideNsfw}
                                    onChange={(e) => setDiscordRpcStrictNsfw(e.target.checked)}
                                />
                                <span className="checkbox-slider"></span>
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );

    const renderAdvancedSettings = () => (
        <section className="settings-section" data-category="advanced">
            <h2 className="section-title">Advanced</h2>
            {shouldShow('developer-mode') && (
                <div className="setting-item">
                    <div className="setting-info">
                        <label className="setting-label">Developer Mode</label>
                        <span className="setting-description">Enable advanced features like extension sideloading</span>
                    </div>
                    <div className="setting-control">
                        <label className="checkbox-switch">
                            <input
                                type="checkbox"
                                checked={developerMode}
                                onChange={(e) => setDeveloperMode(e.target.checked)}
                            />
                            <span className="checkbox-slider"></span>
                        </label>
                    </div>
                </div>
            )}
            {shouldShow('debug-log') && (
                <div className="setting-item">
                    <div className="setting-info">
                        <label className="setting-label">Create Debug Log</label>
                        <span className="setting-description">Generate a log file with system info for troubleshooting</span>
                    </div>
                    <div className="setting-control">
                        <button className="action-btn" onClick={async () => {
                            const { debugLogger } = await import('../../utils/debugLogger');
                            const consoleLogs = debugLogger.getFormattedLogs();
                            const networkActivity = debugLogger.getFormattedNetwork();
                            const result = await window.electronAPI.app.createDumpLog(consoleLogs, networkActivity);
                            if (result.success) await dialog.alert('Debug log created!', 'Success');
                        }}>Generate Log</button>
                    </div>
                </div>
            )}
        </section>
    );

    const categoryRenderers: Record<CategoryId, () => JSX.Element> = {
        general: renderGeneralSettings,
        library: renderLibrarySettings,
        reader: renderReaderSettings,
        cache: renderCacheSettings,
        tracking: renderTrackingSettings,
        discord: renderDiscordSettings,
        advanced: renderAdvancedSettings,
    };

    return (
        <div className="settings-page">
            <div className="settings-header">
                <h1>Settings</h1>
                <div className="settings-search">
                    <input
                        type="text"
                        placeholder="Search settings..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                    {searchQuery && (
                        <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
                    )}
                </div>
            </div>

            <div className="settings-layout">
                {!isSearching && (
                    <nav className="settings-sidebar">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                className={`sidebar-item ${activeCategory === cat.id ? 'active' : ''}`}
                                onClick={() => setActiveCategory(cat.id)}
                            >
                                <span className="sidebar-icon">{cat.icon}</span>
                                <span className="sidebar-label">{cat.label}</span>
                            </button>
                        ))}
                    </nav>
                )}

                <div className="settings-content">
                    {isSearching ? (
                        filteredSettings?.length === 0 ? (
                            <div className="no-results">No settings found for "{searchQuery}"</div>
                        ) : (
                            visibleCategories.map(catId => categoryRenderers[catId]())
                        )
                    ) : (
                        categoryRenderers[activeCategory]()
                    )}
                </div>
            </div>
        </div>
    );
}

export default Settings;
