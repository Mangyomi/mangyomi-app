import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useSettingsStore } from '../stores/settingsStore';
import './Extensions.css';

function Extensions() {
    const { extensions, loadExtensions } = useAppStore();
    const { isExtensionEnabled, toggleExtension } = useSettingsStore();

    const [repoUrl, setRepoUrl] = useState('');
    const [availableExtensions, setAvailableExtensions] = useState<AvailableExtension[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
    const [uninstallingIds, setUninstallingIds] = useState<Set<string>>(new Set());

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
                <h2 className="section-title">📦 Install from GitHub</h2>
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
                            <span className="loading-spinner">⏳</span>
                        ) : (
                            '🔍 Browse'
                        )}
                    </button>
                </div>

                {error && (
                    <div className="error-message">
                        ⚠️ {error}
                    </div>
                )}

                {/* Available Extensions from Repo */}
                {availableExtensions.length > 0 && (
                    <div className="available-extensions">
                        <h3 className="subsection-title">
                            Available Extensions ({availableExtensions.length})
                        </h3>
                        <div className="extensions-grid">
                            {availableExtensions.map(ext => (
                                <div key={ext.id} className="available-ext-card">
                                    <div className="available-ext-icon">📖</div>
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
                                        {installingIds.has(ext.id) ? '⏳' :
                                            uninstallingIds.has(ext.id) ? '⏳' :
                                                ext.installed ? '✓ Installed' : '+ Install'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Installed Extensions Section */}
            <div className="installed-section">
                <h2 className="section-title">📚 Installed Extensions</h2>

                {extensions.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🔌</div>
                        <h2 className="empty-state-title">No extensions installed</h2>
                        <p className="empty-state-description">
                            Browse a GitHub repository above to install extensions
                        </p>
                    </div>
                ) : (
                    <div className="extensions-list">
                        {extensions.map(ext => (
                            <div key={ext.id} className={`extension-card ${!isExtensionEnabled(ext.id) ? 'disabled' : ''}`}>
                                <div className="extension-icon-large">📖</div>
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
                                        {uninstallingIds.has(ext.id) ? '⏳' : '🗑️'}
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
