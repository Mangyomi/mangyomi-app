import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { useSettingsStore } from '../stores/settingsStore';
import MangaCard from '../components/MangaCard';
import './Gallery.css';

function Gallery() {
    const { library, loadingLibrary, tags, extensions } = useAppStore();
    const { hideNsfwInLibrary, hideNsfwInTags, hideNsfwCompletely } = useSettingsStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<'title' | 'updated' | 'added'>('updated');

    const [filteredMangaIds, setFilteredMangaIds] = useState<Set<string> | null>(null);
    const [isFiltering, setIsFiltering] = useState(false);

    useEffect(() => {
        const fetchTaggedManga = async () => {
            if (selectedTagId === null) {
                setFilteredMangaIds(null);
                return;
            }

            setIsFiltering(true);
            try {
                const results = await window.electronAPI.db.getMangaByTag(selectedTagId);
                setFilteredMangaIds(new Set(results.map((m: any) => m.id)));
            } catch (error) {
                console.error('Failed to filter by tag:', error);
            } finally {
                setIsFiltering(false);
            }
        };

        fetchTaggedManga();
    }, [selectedTagId]);

    const filteredLibrary = useMemo(() => {
        // Build set of NSFW extension IDs
        const nsfwExtensions = new Set(
            extensions.filter(ext => ext.nsfw).map(ext => ext.id)
        );

        let filtered = [...library];

        // Apply NSFW filtering
        if (hideNsfwCompletely) {
            filtered = filtered.filter(m => !nsfwExtensions.has(m.source_id));
        } else if (selectedTagId === null && hideNsfwInLibrary) {
            filtered = filtered.filter(m => !nsfwExtensions.has(m.source_id));
        } else if (selectedTagId !== null && hideNsfwInTags) {
            filtered = filtered.filter(m => !nsfwExtensions.has(m.source_id));
        }

        if (selectedTagId !== null && filteredMangaIds) {
            filtered = filtered.filter(m => filteredMangaIds.has(m.id));
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(m =>
                m.title.toLowerCase().includes(query) ||
                m.author?.toLowerCase().includes(query)
            );
        }

        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'updated':
                    return (b.updated_at || 0) - (a.updated_at || 0);
                case 'added':
                    return (b.added_at || 0) - (a.added_at || 0);
                default:
                    return 0;
            }
        });

        return filtered;
    }, [library, searchQuery, selectedTagId, filteredMangaIds, sortBy, extensions, hideNsfwInLibrary, hideNsfwInTags, hideNsfwCompletely]);

    if (loadingLibrary) {
        return (
            <div className="loading-state">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="gallery-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Library</h1>
                    <p className="page-subtitle">{library.length} manga in your collection</p>
                </div>
            </div>

            <div className="gallery-controls">
                <div className="search-bar">
                    <input
                        type="text"
                        className="input"
                        placeholder="Search your library..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="filter-bar">
                    <div className="sort-group">
                        <span className="sort-label">Sort by:</span>
                        <select
                            className="input sort-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                        >
                            <option value="updated">Last Updated</option>
                            <option value="added">Recently Added</option>
                            <option value="title">Title A-Z</option>
                        </select>
                    </div>

                    {tags.length > 0 && (
                        <div className="tag-filters">
                            <button
                                className={`tag-filter ${selectedTagId === null ? 'active' : ''}`}
                                onClick={() => setSelectedTagId(null)}
                            >
                                All
                            </button>
                            {tags.map(tag => (
                                <button
                                    key={tag.id}
                                    className={`tag-filter ${selectedTagId === tag.id ? 'active' : ''}`}
                                    style={{ '--tag-color': tag.color } as React.CSSProperties}
                                    onClick={() => setSelectedTagId(tag.id)}
                                >
                                    {tag.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {filteredLibrary.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📚</div>
                    <h2 className="empty-state-title">
                        {searchQuery ? 'No results found' : 'Your library is empty'}
                    </h2>
                    <p className="empty-state-description">
                        {searchQuery
                            ? 'Try a different search term'
                            : 'Browse manga sources to add titles to your library'}
                    </p>
                </div>
            ) : (
                <div className="manga-grid">
                    {filteredLibrary.map((manga, index) => (
                        <MangaCard
                            key={manga.id}
                            id={manga.source_manga_id}
                            title={manga.title}
                            coverUrl={manga.cover_url}
                            extensionId={manga.source_id}
                            index={index}
                            inLibrary
                            totalChapters={manga.total_chapters}
                            readChapters={manga.read_chapters}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Gallery;
