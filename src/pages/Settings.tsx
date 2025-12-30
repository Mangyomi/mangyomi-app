import { useSettingsStore, Theme, ReaderMode } from '../stores/settingsStore';
import './Settings.css';

function Settings() {
    const {
        theme,
        defaultReaderMode,
        prefetchChapters,
        setTheme,
        setDefaultReaderMode,
        setPrefetchChapters,
    } = useSettingsStore();

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
                                            alert('Debug log created and opened in file explorer!');
                                        }
                                    } catch (err) {
                                        alert('Failed to create debug log: ' + (err instanceof Error ? err.message : 'Unknown error'));
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
