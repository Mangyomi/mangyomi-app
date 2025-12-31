import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Icons } from '../components/Icons';
import './Extensions.css';

const DEFAULT_REPO_URL = 'https://github.com/Mangyomi/mangyomi-ext';

function Extensions() {
    const { extensions, loadExtensions } = useAppStore();
    const { isExtensionEnabled, toggleExtension, developerMode } = useSettingsStore();

    const [repoUrl, setRepoUrl] = useState('');
    const [availableExtensions, setAvailableExtensions] = useState<AvailableExtension[]>([]);
    const [isAvailableCollapsed, setIsAvailableCollapsed] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
    const [uninstallingIds, setUninstallingIds] = useState<Set<string>>(new Set());
    const hasInitiallyLoaded = useRef(false);

    const CACHE_KEY = 'cached_available_extensions';
    const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

    useEffect(() => {
        if (!hasInitiallyLoaded.current) {
            hasInitiallyLoaded.current = true;
            loadDefaultExtensions();
        }
    }, []);

    const loadDefaultExtensions = async (forceRefresh = false) => {
        setError(null);

        // Try to load from cache first if not forcing refresh
        if (!forceRefresh) {
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    const age = Date.now() - timestamp;

                    if (age < CACHE_DURATION) {
                        setAvailableExtensions(data);
                        // If we have cached data, we don't auto-fetch unless it's stale
                        // BUT user asked for "prefetch on first load, only update again when reported"
                        // So if we have cache, we are good.
                        return;
                    }
                }
            } catch (e) {
                console.warn('Failed to load extension cache', e);
            }
        }

        setIsLoading(true);
        try {
            const available = await window.electronAPI.extensions.listAvailable(DEFAULT_REPO_URL);
            setAvailableExtensions(available);

            // Cache the results
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: available,
                timestamp: Date.now()
            }));
        } catch (err) {
            console.error('Failed to load default extensions:', err);
            // If fetch fails but we have stale cache, maybe show that? 
            // For now, standard error handling
            if (forceRefresh) {
                setError('Failed to refresh extensions');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = () => {
        loadDefaultExtensions(true);
    };

    const handleBrowseRepo = async () => {
        if (!repoUrl.trim()) return;

        setIsLoading(true);
        setError(null);
        setAvailableExtensions([]);

        try {
            const available = await window.electronAPI.extensions.listAvailable(repoUrl.trim());
            setAvailableExtensions(available);
            if (available.length === 0) {
                setError('No extensions found in this repository');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch repository');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInstall = async (ext: AvailableExtension) => {
        setInstallingIds(prev => new Set(prev).add(ext.id));
        setError(null);

        try {
            const result = await window.electronAPI.extensions.install(ext.repoUrl, ext.id);
            if (result.success) {
                await loadExtensions();
                setAvailableExtensions(prev =>
                    prev.map(e => e.id === ext.id ? { ...e, installed: true } : e)
                );
            } else {
                setError(result.error || 'Installation failed');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Installation failed');
        } finally {
            setInstallingIds(prev => {
                const next = new Set(prev);
                next.delete(ext.id);
                return next;
            });
        }
    };

    const handleUninstall = async (extensionId: string) => {
        setUninstallingIds(prev => new Set(prev).add(extensionId));
        setError(null);

        try {
            const result = await window.electronAPI.extensions.uninstall(extensionId);
            if (result.success) {
                await loadExtensions();
                setAvailableExtensions(prev =>
                    prev.map(e => e.id === extensionId ? { ...e, installed: false } : e)
                );
            } else {
                setError(result.error || 'Uninstallation failed');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Uninstallation failed');
        } finally {
            setUninstallingIds(prev => {
                const next = new Set(prev);
                next.delete(extensionId);
                return next;
            });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBrowseRepo();
        }
    };

    const getIconUrl = (iconPath?: string) => {
        if (!iconPath) return null;
        if (iconPath.startsWith('http')) return iconPath;
        // Convert Windows path to file URL format for the proxy
        const normalizedPath = iconPath.replace(/\\/g, '/');
        const fileUrl = `file:///${normalizedPath}`;
        return `manga-image://?url=${encodeURIComponent(fileUrl)}&ext=local`;
    };

    return (
        <div className="extensions-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Extensions</h1>
                    <p className="page-subtitle">Manage your manga sources</p>
                </div>
            </div>

            {/* Install from GitHub Section */}
            <div className="install-section">
                <h2 className="section-title">
                    <span className="icon-wrapper"><Icons.Package /></span> Install from GitHub
                </h2>
                <div className="repo-input-group">
                    <input
                        type="text"
                        className="repo-input"
                        placeholder="Enter GitHub repository URL (e.g., github.com/username/extensions)"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button
                        className="browse-btn"
                        onClick={handleBrowseRepo}
                        disabled={isLoading || !repoUrl.trim()}
                    >
                        {isLoading ? (
                            <Icons.Refresh className="animate-spin" />
                        ) : (
                            <>
                                <Icons.Search width={18} height={18} style={{ marginRight: '6px' }} /> Browse
                            </>
                        )}
                    </button>
                    {developerMode && (
                        <button
                            className="browse-btn sideload"
                            onClick={async () => {
                                setIsLoading(true);
                                try {
                                    const result = await window.electronAPI.extensions.sideload();
                                    if (result.success) {
                                        await loadExtensions();
                                    } else if (result.error !== 'Installation cancelled') {
                                        setError(result.error || 'Sideload failed');
                                    }
                                } catch (err) {
                                    setError(err instanceof Error ? err.message : 'Sideload failed');
                                } finally {
                                    setIsLoading(false);
                                }
                            }}
                            title="Sideload a local extension (Developer Mode)"
                            style={{ marginLeft: '8px', background: 'var(--color-warning)', color: '#000' }}
                        >
                            <Icons.Tools width={18} height={18} style={{ marginRight: '6px' }} /> Sideload
                        </button>
                    )}
                </div>

                {error && (
                    <div className="error-message">
                        <Icons.AlertTriangle width={18} height={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> {error}
                    </div>
                )}

                {/* Available Extensions from Repo */}
                {availableExtensions.length > 0 && (
                    <div className="available-extensions">
                        <div
                            className="collapsible-header"
                            onClick={() => setIsAvailableCollapsed(!isAvailableCollapsed)}
                        >
                            <div className="header-content">
                                <span className={`collapse-icon ${isAvailableCollapsed ? 'collapsed' : ''}`}>
                                    <Icons.ChevronDown width={16} height={16} />
                                </span>
                                <h3 className="subsection-title" style={{ margin: 0 }}>
                                    Available Extensions
                                </h3>
                                <span className="section-badge">{availableExtensions.length}</span>
                            </div>
                            <div className="section-actions">
                                <button
                                    className="refresh-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRefresh();
                                    }}
                                    disabled={isLoading}
                                    title="Refresh available extensions"
                                >
                                    <Icons.Refresh
                                        width={14}
                                        height={14}
                                        className={isLoading ? 'animate-spin' : ''}
                                    />
                                    Refresh
                                </button>
                            </div>
                        </div>

                        {!isAvailableCollapsed && (
                            <div className="extensions-grid">
                                {availableExtensions.map(ext => (
                                    <div key={ext.id} className="available-ext-card">
                                        <div className="available-ext-icon">
                                            {ext.icon ? (
                                                <img
                                                    src={getIconUrl(ext.icon) || ''}
                                                    alt={ext.name}
                                                    className="ext-icon-img"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                    }}
                                                />
                                            ) : null}
                                            <Icons.Book
                                                width={24}
                                                height={24}
                                                opacity={0.5}
                                                className="fallback-icon-svg"
                                                style={{ display: ext.icon ? 'block' : 'block' }}
                                            />
                                        </div>
                                        <div className="available-ext-info">
                                            <div className="available-ext-name">
                                                {ext.name}
                                                {ext.nsfw && <span className="extension-nsfw-badge">18+</span>}
                                            </div>
                                            <div className="available-ext-meta">
                                                v{ext.version} • {ext.language.toUpperCase()}
                                            </div>
                                        </div>
                                        <button
                                            className={`install-btn ${ext.installed ? 'installed' : ''}`}
                                            onClick={() => ext.installed ? handleUninstall(ext.id) : handleInstall(ext)}
                                            disabled={installingIds.has(ext.id) || uninstallingIds.has(ext.id)}
                                        >
                                            {installingIds.has(ext.id) ? <Icons.Refresh width={14} height={14} className="animate-spin" /> :
                                                uninstallingIds.has(ext.id) ? <Icons.Refresh width={14} height={14} className="animate-spin" /> :
                                                    ext.installed ? <><Icons.Check width={14} height={14} style={{ marginRight: '4px' }} /> Installed</> : <><Icons.Plus width={14} height={14} style={{ marginRight: '4px' }} /> Install</>}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Installed Extensions Section */}
            <div className="installed-section">
                <h2 className="section-title">
                    <span className="icon-wrapper"><Icons.Library /></span> Installed Extensions
                </h2>

                {extensions.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Icons.Plug width={48} height={48} /></div>
                        <h2 className="empty-state-title">No extensions installed</h2>
                        <p className="empty-state-description">
                            Browse a GitHub repository above to install extensions
                        </p>
                    </div>
                ) : (
                    <div className="extensions-list">
                        {extensions.map(ext => (
                            <div key={ext.id} className={`extension-card ${!isExtensionEnabled(ext.id) ? 'disabled' : ''}`}>
                                <div className="extension-icon-large">
                                    {ext.icon ? (
                                        <img
                                            src={getIconUrl(ext.icon) || ''}
                                            alt={ext.name}
                                            className="ext-icon-img"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    ) : null}
                                    <Icons.Book className="fallback-icon-svg" width={24} height={24} opacity={0.5} />
                                </div>
                                <div className="extension-details">
                                    <h3 className="extension-title">
                                        {ext.name}
                                        {ext.nsfw && <span className="extension-nsfw-badge">18+</span>}
                                    </h3>
                                    <p className="extension-meta">
                                        v{ext.version} • {ext.language.toUpperCase()} • {ext.baseUrl}
                                    </p>
                                </div>
                                <div className="extension-actions">
                                    <button
                                        className="uninstall-btn"
                                        onClick={() => handleUninstall(ext.id)}
                                        disabled={uninstallingIds.has(ext.id)}
                                        title="Uninstall extension"
                                    >
                                        {uninstallingIds.has(ext.id) ? <Icons.Refresh className="animate-spin" /> : <Icons.Trash />}
                                    </button>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={isExtensionEnabled(ext.id)}
                                            onChange={() => toggleExtension(ext.id)}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Extensions;
