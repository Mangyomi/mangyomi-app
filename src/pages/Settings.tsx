import { useState, useEffect } from 'react';
import { useSettingsStore, Theme, ReaderMode } from '../stores/settingsStore';
import { useAniListStore } from '../stores/anilistStore';
import { useDialog } from '../components/ConfirmModal/DialogContext';
import './Settings.css';

function Settings() {
    const [cacheSize, setCacheSize] = useState<number>(0);
    const dialog = useDialog();

    useEffect(() => {
        window.electronAPI.cache.getSize().then(setCacheSize);
    }, []);

    // AniList store
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
        theme,
        defaultReaderMode,
        prefetchChapters,
        maxCacheSize,
        hideNsfwInLibrary,
        hideNsfwInHistory,
        hideNsfwInTags,
        hideNsfwCompletely,
        setTheme,
        setDefaultReaderMode,
        setPrefetchChapters,
        setMaxCacheSize,
        setHideNsfwInLibrary,
        setHideNsfwInHistory,
        setHideNsfwInTags,
        setHideNsfwCompletely,
    } = useSettingsStore();

    const formatSize = (bytes: number) => {
        if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
        return `${Math.round(bytes / 1024 / 1024)} MB`;
    };

    const themes: { value: Theme; label: string; icon: string }[] = [
        { value: 'light', label: 'Light', icon: '☀️' },
        { value: 'dark', label: 'Dark', icon: '🌙' },
        { value: 'system', label: 'System', icon: '💻' },
    ];

    const readerModes: { value: ReaderMode; label: string; icon: string }[] = [
        { value: 'vertical', label: 'Vertical Scroll', icon: '↕️' },
        { value: 'horizontal', label: 'Horizontal Pages', icon: '↔️' },
    ];

    return (
        <div className="settings-page">
            <div className="page-header">
                <h1>Settings</h1>
            </div>

            <div className="settings-content">
                {/* Appearance Section */}
                <section className="settings-section">
                    <h2 className="section-title">Appearance</h2>

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
                                        <span className="toggle-icon">{t.icon}</span>
                                        <span className="toggle-label">{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Reader Section */}
                <section className="settings-section">
                    <h2 className="section-title">Reader</h2>

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
                                        <span className="toggle-icon">{mode.icon}</span>
                                        <span className="toggle-label">{mode.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Content Filter Section */}
                <section className="settings-section">
                    <h2 className="section-title">Content Filter</h2>

                    {/* Main Toggle */}
                    <div className="setting-item">
                        <div className="setting-info">
                            <label className="setting-label">Hide All NSFW Content</label>
                            <span className="setting-description">
                                Completely hide manga from NSFW sources everywhere
                            </span>
                        </div>
                        <div className="setting-control">
                            <label className="checkbox-switch">
                                <input
                                    type="checkbox"
                                    checked={hideNsfwCompletely}
                                    onChange={(e) => setHideNsfwCompletely(e.target.checked)}
                                />
                                <span className="checkbox-slider"></span>
                            </label>
                        </div>
                    </div>

                    {/* Sub-options */}
                    <div className={`sub-settings ${hideNsfwCompletely ? 'disabled' : ''}`}>
                        <div className="setting-item sub-item">
                            <div className="setting-info">
                                <label className="setting-label">Hide in Library</label>
                                <span className="setting-description">
                                    Hide NSFW manga in the Library "All" view
                                </span>
                            </div>
                            <div className="setting-control">
                                <label className="checkbox-switch">
                                    <input
                                        type="checkbox"
                                        checked={hideNsfwCompletely || hideNsfwInLibrary}
                                        disabled={hideNsfwCompletely}
                                        onChange={(e) => setHideNsfwInLibrary(e.target.checked)}
                                    />
                                    <span className="checkbox-slider"></span>
                                </label>
                            </div>
                        </div>

                        <div className="setting-item sub-item">
                            <div className="setting-info">
                                <label className="setting-label">Hide in History</label>
                                <span className="setting-description">
                                    Hide NSFW manga in your reading history
                                </span>
                            </div>
                            <div className="setting-control">
                                <label className="checkbox-switch">
                                    <input
                                        type="checkbox"
                                        checked={hideNsfwCompletely || hideNsfwInHistory}
                                        disabled={hideNsfwCompletely}
                                        onChange={(e) => setHideNsfwInHistory(e.target.checked)}
                                    />
                                    <span className="checkbox-slider"></span>
                                </label>
                            </div>
                        </div>

                        <div className="setting-item sub-item">
                            <div className="setting-info">
                                <label className="setting-label">Hide in Tags</label>
                                <span className="setting-description">
                                    Hide NSFW manga in tag views and Tags page
                                </span>
                            </div>
                            <div className="setting-control">
                                <label className="checkbox-switch">
                                    <input
                                        type="checkbox"
                                        checked={hideNsfwCompletely || hideNsfwInTags}
                                        disabled={hideNsfwCompletely}
                                        onChange={(e) => setHideNsfwInTags(e.target.checked)}
                                    />
                                    <span className="checkbox-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Tracking Section */}
                <section className="settings-section">
                    <h2 className="section-title">Tracking</h2>

                    <div className="setting-item">
                        <div className="setting-info">
                            <label className="setting-label">AniList</label>
                            <span className="setting-description">
                                {isAniListAuthenticated && anilistUser
                                    ? `Connected as ${anilistUser.name}`
                                    : 'Sync your reading progress with AniList'}
                            </span>
                        </div>
                        <div className="setting-control">
                            {isAniListAuthenticated ? (
                                <div className="anilist-user-info">
                                    {anilistUser?.avatar?.medium && (
                                        <img
                                            src={anilistUser.avatar.medium}
                                            alt={anilistUser.name}
                                            className="anilist-avatar"
                                        />
                                    )}
                                    <button
                                        className="action-btn logout-btn"
                                        onClick={async () => {
                                            const confirmed = await dialog.confirm({
                                                title: 'Disconnect AniList?',
                                                message: 'Your tracking links will be preserved but progress will no longer sync.'
                                            });
                                            if (confirmed) {
                                                await anilistLogout();
                                            }
                                        }}
                                    >
                                        Disconnect
                                    </button>
                                </div>
                            ) : (
                                <button
                                    className="action-btn"
                                    onClick={anilistLogin}
                                    disabled={anilistLoading}
                                >
                                    {anilistLoading ? 'Connecting...' : 'Connect'}
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                {/* Performance Section */}
                <section className="settings-section">
                    <h2 className="section-title">Performance</h2>

                    <div className="setting-item">
                        <div className="setting-info">
                            <label className="setting-label">Chapter Prefetch</label>
                            <span className="setting-description">
                                Preload adjacent chapters for faster navigation.
                                {prefetchChapters === 0
                                    ? ' Currently disabled.'
                                    : ` Currently preloading ${prefetchChapters} chapter(s) ahead and behind.`}
                            </span>
                        </div>
                        <div className="setting-control">
                            <div className="slider-control">
                                <input
                                    type="range"
                                    min="0"
                                    max="4"
                                    value={prefetchChapters}
                                    onChange={(e) => setPrefetchChapters(parseInt(e.target.value, 10))}
                                    className="slider"
                                />
                                <div className="slider-labels">
                                    <span className={prefetchChapters === 0 ? 'active' : ''}>Off</span>
                                    <span className={prefetchChapters === 1 ? 'active' : ''}>1</span>
                                    <span className={prefetchChapters === 2 ? 'active' : ''}>2</span>
                                    <span className={prefetchChapters === 3 ? 'active' : ''}>3</span>
                                    <span className={prefetchChapters === 4 ? 'active' : ''}>4</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <label className="setting-label">Max Cache Size</label>
                            <span className="setting-description">
                                Limit the disk space used for offline images.
                                Currently set to <strong>{formatSize(maxCacheSize || 1024 * 1024 * 1024)}</strong>.
                            </span>
                        </div>
                        <div className="setting-control">
                            <div className="slider-control">
                                <input
                                    type="range"
                                    min={256 * 1024 * 1024}
                                    max={8 * 1024 * 1024 * 1024}
                                    step={256 * 1024 * 1024}
                                    value={maxCacheSize || 1024 * 1024 * 1024}
                                    onChange={(e) => setMaxCacheSize(parseInt(e.target.value, 10))}
                                    className="slider"
                                />
                                <div className="slider-labels">
                                    <span>256MB</span>
                                    <span>4GB</span>
                                    <span>8GB</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="setting-item align-end">
                        <div className="setting-info">
                            <label className="setting-label">Clear Cache</label>
                            <span className="setting-description">
                                Current cache size: <strong>{formatSize(cacheSize)}</strong>.
                                Clears all cached images and browser data.
                            </span>
                        </div>
                        <div className="setting-control">
                            <button
                                className="action-btn"
                                style={{ backgroundColor: '#dc2626', color: 'white' }}
                                onClick={async () => {
                                    const confirmed = await dialog.confirm({
                                        title: 'Clear Cache',
                                        message: 'Are you sure you want to delete all cached data?',
                                        confirmLabel: 'Clear',
                                        isDestructive: true,
                                    });
                                    if (confirmed) {
                                        try {
                                            await window.electronAPI.cache.clear();
                                            setCacheSize(0);
                                            await dialog.alert('Cache cleared successfully!', 'Success');
                                        } catch (err) {
                                            await dialog.alert('Failed to clear cache.', 'Error');
                                        }
                                    }
                                }}
                            >
                                🗑️ Clear Cache
                            </button>
                        </div>
                    </div>

                    {prefetchChapters > 0 && (
                        <div className="setting-note">
                            <span className="note-icon">💡</span>
                            <span>Higher values use more memory but provide faster chapter transitions.</span>
                        </div>
                    )}
                </section>

                {/* Debug Section */}
                <section className="settings-section">
                    <h2 className="section-title">Debug</h2>

                    <div className="setting-item">
                        <div className="setting-info">
                            <label className="setting-label">Create Debug Log</label>
                            <span className="setting-description">
                                Generate a log file with system info, console logs, and network activity for troubleshooting
                            </span>
                        </div>
                        <div className="setting-control">
                            <button
                                className="action-btn"
                                onClick={async () => {
                                    try {
                                        const { debugLogger } = await import('../utils/debugLogger');
                                        const consoleLogs = debugLogger.getFormattedLogs();
                                        const networkActivity = debugLogger.getFormattedNetwork();
                                        const result = await window.electronAPI.app.createDumpLog(consoleLogs, networkActivity);
                                        if (result.success) {
                                            await dialog.alert('Debug log created and opened in file explorer!', 'Success');
                                        }
                                    } catch (err) {
                                        await dialog.alert('Failed to create debug log: ' + (err instanceof Error ? err.message : 'Unknown error'), 'Error');
                                    }
                                }}
                            >
                                📋 Generate Log
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default Settings;

