import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { useSettingsStore } from '../../settings/stores/settingsStore';
import { useBrowseStore } from '../stores/browseStore';
import { useExtensionStore } from '../../extensions/stores/extensionStore';
import { useLibraryStore } from '../../library/stores/libraryStore';
import MangaCard from '../../../components/MangaCard';
import { Icons } from '../../../components/Icons';
import './Browse.css';

function Browse() {
    const { library } = useLibraryStore();
    const { extensions, selectedExtension, selectExtension } = useExtensionStore();

    const {
        browseManga,
        browseLoading,
        browseHasMore,
        browseMode,
        searchQuery: storeSearchQuery,
        browseMangaList,
        searchMangaList,
        loadMoreBrowse,
    } = useBrowseStore();

    const { isExtensionEnabled, extensionOrder, setExtensionOrder } = useSettingsStore();

    const [searchQuery, setSearchQuery] = useState(storeSearchQuery);
    const [activeTab, setActiveTab] = useState<'popular' | 'latest'>(browseMode === 'latest' ? 'latest' : 'popular');
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const [draggedId, setDraggedId] = useState<string | null>(null);

    const enabledExtensions = extensions.filter(ext => isExtensionEnabled(ext.id));
    const libraryIds = new Set(library.map(m => `${m.source_id}:${m.source_manga_id}`));

    // Sort extensions by saved order, putting unsorted ones at the end
    const orderedExtensions = [...enabledExtensions].sort((a, b) => {
        const aIndex = extensionOrder.indexOf(a.id);
        const bIndex = extensionOrder.indexOf(b.id);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, extId: string) => {
        setDraggedId(extId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', extId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedId || draggedId === targetId) {
            setDraggedId(null);
            return;
        }

        const currentOrder = orderedExtensions.map(ext => ext.id);
        const draggedIndex = currentOrder.indexOf(draggedId);
        const targetIndex = currentOrder.indexOf(targetId);

        if (draggedIndex === -1 || targetIndex === -1) {
            setDraggedId(null);
            return;
        }

        // Reorder: remove dragged item and insert at target position
        currentOrder.splice(draggedIndex, 1);
        currentOrder.splice(targetIndex, 0, draggedId);

        setExtensionOrder(currentOrder);
        setDraggedId(null);
    };

    const handleDragEnd = () => {
        setDraggedId(null);
    };

    // Sync local search query with store (mostly for returning from other pages)
    useEffect(() => {
        if (storeSearchQuery && searchQuery !== storeSearchQuery) {
            setSearchQuery(storeSearchQuery);
        }
    }, [storeSearchQuery]);

    useEffect(() => {
        if (enabledExtensions.length > 0) {
            if (!selectedExtension || !isExtensionEnabled(selectedExtension.id)) {
                selectExtension(enabledExtensions[0]);
            }
        }
    }, [enabledExtensions, selectedExtension, isExtensionEnabled, selectExtension]);

    useEffect(() => {
        if (selectedExtension && isExtensionEnabled(selectedExtension.id)) {
            // If we have data and match the mode, don't re-fetch (preserves state on back nav)
            // But if we switched extension, we SHOULD fetch. 
            // The store doesn't know about "selected extension" change unless we tell it.
            // Since `selectedExtension` is in `appStore` and `browseStore` is dumb, we need to trigger here.

            // NOTE: Ideally, we should check if the store's data belongs to the current extension.
            // For now, we rely on the fact that `browseMangaList` clears data or we check if store is empty?
            // Actually, `browseStore` handles `browseManga` replacement.

            // Simple check: if we have 0 items, fetch. Or if mode changed. 
            // For now, let's keep the logic similar to original but ensure we pass extensionId

            if (browseManga.length > 0 && ((browseMode === 'search') || (browseMode === activeTab))) {
                return;
            }
            browseMangaList(selectedExtension.id, activeTab, 1);
        }
    }, [selectedExtension]); // Run when extension changes

    // Re-attach observer when loading state changes
    useEffect(() => {
        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && browseHasMore && !browseLoading && selectedExtension) {
                    loadMoreBrowse(selectedExtension.id);
                }
            },
            { threshold: 0.1 }
        );

        if (loadMoreRef.current) {
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [browseHasMore, browseLoading, loadMoreBrowse, selectedExtension]);

    const getIconUrl = (iconPath?: string) => {
        if (!iconPath) return null;
        if (iconPath.startsWith('http')) return iconPath;
        const normalizedPath = iconPath.replace(/\\/g, '/');
        const fileUrl = `file:///${normalizedPath}`;
        return `manga-image://?url=${encodeURIComponent(fileUrl)}&ext=local`;
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim() && selectedExtension) {
            searchMangaList(selectedExtension.id, searchQuery, 1);
        }
    };

    const handleTabChange = (tab: 'popular' | 'latest') => {
        setActiveTab(tab);
        setSearchQuery('');
        if (selectedExtension) {
            browseMangaList(selectedExtension.id, tab, 1);
        }
    };

    if (enabledExtensions.length === 0) {
        return (
            <div className="browse-page">
                <div className="empty-state">
                    <div className="empty-state-icon"><Icons.Plug width={48} height={48} /></div>
                    <h2 className="empty-state-title">No extensions enabled</h2>
                    <p className="empty-state-description">
                        Enable extensions in the Extensions page to browse manga sources
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="browse-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Browse</h1>
                    <p className="page-subtitle">Discover new manga from your sources</p>
                </div>
            </div>

            {/* Extension Selector */}
            <div className="extension-selector">
                {orderedExtensions.map(ext => (
                    <button
                        key={ext.id}
                        className={`extension-btn ${selectedExtension?.id === ext.id ? 'active' : ''} ${draggedId === ext.id ? 'dragging' : ''}`}
                        onClick={() => {
                            if (selectedExtension?.id !== ext.id) {
                                // Clear browse store when switching extensions to avoid showing old data
                                useBrowseStore.getState().resetBrowse();
                                selectExtension(ext);
                            }
                        }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, ext.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, ext.id)}
                        onDragEnd={handleDragEnd}
                    >
                        <span className="extension-icon">
                            {ext.icon ? (
                                <img src={getIconUrl(ext.icon) || ''} alt="" className="ext-icon-img-small" />
                            ) : <Icons.Book width={18} height={18} opacity={0.7} />}
                        </span>
                        <span className="extension-name">{ext.name}</span>
                    </button>
                ))}
            </div>

            {/* Search Bar */}
            <form className="search-bar" onSubmit={handleSearch}>
                <input
                    type="text"
                    className="input"
                    placeholder={`Search on ${selectedExtension?.name || 'source'}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" className="btn btn-primary">
                    Search
                </button>
            </form>

            {/* Tabs */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'popular' && browseMode !== 'search' ? 'active' : ''}`}
                    onClick={() => handleTabChange('popular')}
                >
                    <Icons.Popular /> Popular
                </button>
                <button
                    className={`tab ${activeTab === 'latest' && browseMode !== 'search' ? 'active' : ''}`}
                    onClick={() => handleTabChange('latest')}
                >
                    <Icons.Latest /> Latest
                </button>
                {browseMode === 'search' && (
                    <button className="tab active">
                        <Icons.Search /> Search Results
                    </button>
                )}
            </div>

            {/* Manga Grid */}
            {browseManga.length === 0 && !browseLoading ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><Icons.Inbox width={48} height={48} /></div>
                    <h2 className="empty-state-title">No manga found</h2>
                    <p className="empty-state-description">
                        {browseMode === 'search'
                            ? 'Try a different search term'
                            : 'Check back later for updates'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="manga-grid">
                        {browseManga.map((manga, index) => (
                            <MangaCard
                                key={`${manga.id}-${index}`}
                                id={manga.id}
                                title={manga.title}
                                coverUrl={manga.coverUrl}
                                extensionId={selectedExtension!.id}
                                index={index}
                                inLibrary={libraryIds.has(`${selectedExtension!.id}:${manga.id}`)}
                            />
                        ))}
                    </div>

                    {/* Load More Trigger */}
                    <div ref={loadMoreRef} className="load-more">
                        {browseLoading && (
                            <div className="loading-state">
                                <div className="spinner"></div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default Browse;
