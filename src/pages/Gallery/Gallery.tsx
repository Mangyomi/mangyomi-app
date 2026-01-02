import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../components/Icons';
import { useAppStore, Manga } from '../../stores/appStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useDialog } from '../../components/ConfirmModal/DialogContext';
import MangaCard from '../../components/MangaCard';
import CustomDropdown from '../../components/CustomDropdown/CustomDropdown';
import ContextMenu, { ContextMenuItem } from '../../components/ContextMenu/ContextMenu';
import TagSelector from '../../components/TagSelector';
import './Gallery.css';

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    manga: { id: string; title: string; extensionId: string } | null;
}

function Gallery() {
    const { library, loadingLibrary, tags, extensions, removeFromLibrary, loadLibrary } = useAppStore();
    const { hideNsfwInLibrary, hideNsfwInTags, hideNsfwCompletely } = useSettingsStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<'title' | 'updated' | 'added'>('updated');
    const navigate = useNavigate();
    const dialog = useDialog();

    const [filteredMangaIds, setFilteredMangaIds] = useState<Set<string> | null>(null);
    const [isFiltering, setIsFiltering] = useState(false);

    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        visible: false,
        x: 0,
        y: 0,
        manga: null
    });

    const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
    const [tagEditManga, setTagEditManga] = useState<Manga | null>(null);

    const sortOptions = [
        { value: 'updated', label: 'Last Updated' },
        { value: 'added', label: 'Recently Added' },
        { value: 'title', label: 'Title A-Z' }
    ];

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

    const handleContextMenu = (e: React.MouseEvent, manga: { id: string; title: string; extensionId: string }) => {
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            manga
        });
    };

    const closeContextMenu = () => {
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const getContextMenuItems = (): ContextMenuItem[] => {
        if (!contextMenu.manga) return [];
        const { id, title, extensionId } = contextMenu.manga;

        // Find the full manga data
        const fullManga = library.find(m => m.source_manga_id === id && m.source_id === extensionId);

        return [
            {
                label: 'View Details',
                onClick: () => navigate(`/manga/${extensionId}/${encodeURIComponent(id)}`)
            },
            {
                label: 'Continue Reading',
                onClick: async () => {
                    // Load chapters and navigate to first chapter
                    const chapters = await window.electronAPI.extensions.getChapterList(extensionId, id);
                    if (chapters && chapters.length > 0) {
                        const firstChapter = chapters[chapters.length - 1]; // First chapter (oldest)
                        navigate(`/read/${extensionId}/${encodeURIComponent(firstChapter.id)}`, {
                            state: { mangaId: id, mangaTitle: title }
                        });
                    }
                }
            },
            { label: '', onClick: () => { }, divider: true },
            {
                label: 'Manage Tags',
                onClick: () => {
                    if (fullManga) {
                        setTagEditManga(fullManga);
                        setIsTagSelectorOpen(true);
                    }
                }
            },
            { label: '', onClick: () => { }, divider: true },
            {
                label: 'Remove from Library',
                danger: true,
                onClick: async () => {
                    const confirmed = await dialog.confirm({
                        title: 'Remove from Library',
                        message: `Remove "${title}" from your library?`
                    });
                    if (confirmed && fullManga) {
                        await removeFromLibrary(fullManga.id);
                    }
                }
            }
        ];
    };

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
                    <p className="page-subtitle">{filteredLibrary.length} manga in your collection</p>
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
                        <CustomDropdown
                            options={sortOptions}
                            value={sortBy}
                            onChange={(value) => setSortBy(value as any)}
                        />
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
                    <div className="empty-state-icon"><Icons.Library width={64} height={64} opacity={0.5} /></div>
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
                            onContextMenu={handleContextMenu}
                        />
                    ))}
                </div>
            )}

            {contextMenu.visible && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={getContextMenuItems()}
                    onClose={closeContextMenu}
                />
            )}

            {isTagSelectorOpen && tagEditManga && (
                <TagSelector
                    mangaId={tagEditManga.id}
                    onClose={() => {
                        setIsTagSelectorOpen(false);
                        setTagEditManga(null);
                    }}
                />
            )}
        </div>
    );
}

export default Gallery;
