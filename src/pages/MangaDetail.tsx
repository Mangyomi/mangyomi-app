import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { useAniListStore } from '../stores/anilistStore';
import { useDialog } from '../components/ConfirmModal/DialogContext';
import './MangaDetail.css';

import TagSelector from '../components/TagSelector';
import AniListLinkModal from '../components/AniListLinkModal/AniListLinkModal';
import { Icons } from '../components/Icons';

function MangaDetail() {
    const { extensionId, mangaId } = useParams<{ extensionId: string; mangaId: string }>();
    const navigate = useNavigate();
    const {
        currentManga,
        currentChapters,
        loadMangaDetails,
        loadChapters,
        addToLibrary,
        removeFromLibrary,
        library,
    } = useAppStore();
    const dialog = useDialog();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
    const [mangaTags, setMangaTags] = useState<any[]>([]);
    const [isAniListModalOpen, setIsAniListModalOpen] = useState(false);
    const [anilistId, setAnilistId] = useState<number | null>(null);

    const { isAuthenticated: isAniListAuthenticated, syncProgress } = useAniListStore();

    const decodedMangaId = decodeURIComponent(mangaId || '');
    const libraryEntry = library.find(
        m => m.source_id === extensionId && m.source_manga_id === decodedMangaId
    );
    const isInLibrary = !!libraryEntry;

    const fetchTags = async () => {
        if (!libraryEntry) {
            setMangaTags([]);
            return;
        }
        try {
            const tags = await window.electronAPI.db.getTagsForManga(libraryEntry.id);
            setMangaTags(tags);
        } catch (e) {
            console.error('Failed to load tags for manga', e);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                navigate(-1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate]);

    useEffect(() => {
        fetchTags();
    }, [libraryEntry, isTagSelectorOpen]);

    // Load anilist_id from library entry
    useEffect(() => {
        if (libraryEntry?.anilist_id) {
            setAnilistId(libraryEntry.anilist_id);
        } else {
            setAnilistId(null);
        }
    }, [libraryEntry]);

    const handleRefresh = async () => {
        if (!extensionId || !mangaId) return;
        setLoading(true);
        setError(null);
        try {
            await Promise.all([
                loadMangaDetails(extensionId, decodedMangaId),
                loadChapters(extensionId, decodedMangaId),
            ]);
        } catch (e) {
            setError('Failed to refresh data');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleRead = async (e: React.MouseEvent, chapter: any) => {
        e.stopPropagation();
        if (chapter.read_at) {
            await useAppStore.getState().markChapterUnread(chapter.id);
        } else {
            await useAppStore.getState().markChapterRead(chapter.id);
        }
    };

    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    const sortedChapters = [...currentChapters].sort((a, b) => {
        const numA = a.chapterNumber || 0;
        const numB = b.chapterNumber || 0;
        return sortOrder === 'desc' ? numB - numA : numA - numB;
    });

    const handleMarkAllUnread = async () => {
        if (!currentChapters.length) return;
        const confirmed = await dialog.confirm({
            title: 'Mark All Unread',
            message: 'Mark all chapters as unread?',
            confirmLabel: 'Mark Unread',
        });
        if (confirmed) {
            const ids = currentChapters.map(c => c.id);
            await useAppStore.getState().markChaptersUnread(ids);
        }
    };

    const handleMarkPreviousRead = async (e: React.MouseEvent, chapterId: string) => {
        e.stopPropagation();

        const index = sortedChapters.findIndex(c => c.id === chapterId);
        if (index === -1) return;

        let idsToMark: string[] = [];

        if (sortOrder === 'desc') {
            const olderChapters = sortedChapters.slice(index + 1);
            idsToMark = [chapterId, ...olderChapters.map(c => c.id)];
        } else {
            const olderChapters = sortedChapters.slice(0, index);
            idsToMark = [...olderChapters.map(c => c.id), chapterId];
        }

        if (idsToMark.length > 0) {
            const confirmed = await dialog.confirm({
                title: 'Mark Chapters Read',
                message: `Mark ${idsToMark.length} chapters as read?`,
                confirmLabel: 'Mark Read',
            });
            if (confirmed) {
                await useAppStore.getState().markChaptersRead(idsToMark);
            }
        }
    };

    useEffect(() => {
        const loadData = async () => {
            if (!extensionId || !mangaId) return;

            setLoading(true);
            setError(null);

            try {
                await Promise.all([
                    loadMangaDetails(extensionId, decodedMangaId),
                    loadChapters(extensionId, decodedMangaId),
                ]);
            } catch (e) {
                setError('Failed to load manga details');
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [extensionId, mangaId]);

    const handleAddToLibrary = async () => {
        if (!currentManga || !extensionId) return;
        await addToLibrary(currentManga, extensionId);
    };

    const handleRemoveFromLibrary = async () => {
        if (!libraryEntry) return;
        await removeFromLibrary(libraryEntry.id);
    };

    const handleReadChapter = (chapterId: string) => {
        navigate(`/read/${extensionId}/${encodeURIComponent(chapterId)}`);
    };

    if (loading) {
        return (
            <div className="loading-state">
                <div className="spinner"></div>
            </div>
        );
    }

    if (error || !currentManga) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon"><Icons.AlertTriangle width={48} height={48} color="var(--color-error)" /></div>
                <h2 className="empty-state-title">{error || 'Manga not found'}</h2>
                <button className="btn btn-primary" onClick={() => navigate(-1)}>
                    <Icons.ArrowLeft width={18} height={18} style={{ marginRight: '6px' }} /> Go Back
                </button>
            </div>
        );
    }

    const proxiedCoverUrl = window.electronAPI?.getProxiedImageUrl
        ? window.electronAPI.getProxiedImageUrl(currentManga.coverUrl, extensionId!)
        : currentManga.coverUrl;

    return (
        <div className="manga-detail-page">
            {/* Hero Section */}
            <div className="manga-hero">
                <div className="manga-hero-bg" style={{ backgroundImage: `url(${proxiedCoverUrl})` }} />

                <div className="manga-hero-content">
                    <img src={proxiedCoverUrl} alt={currentManga.title} className="manga-cover" />
                    <div className="manga-info">
                        <h1 className="manga-title">{currentManga.title}</h1>
                        <p className="manga-author">
                            {currentManga.author}
                            {currentManga.artist && currentManga.artist !== currentManga.author && (
                                <> • Art by {currentManga.artist}</>
                            )}
                        </p>
                        <div className="manga-status">
                            <span className={`status-badge ${currentManga.status}`}>
                                {currentManga.status}
                            </span>
                        </div>
                        <div className="manga-genres">
                            {currentManga.genres?.map((genre: string) => (
                                <span key={genre} className="genre-badge">{genre}</span>
                            ))}
                        </div>

                        {/* User Tags */}
                        {mangaTags.length > 0 && (
                            <div className="manga-user-tags">
                                {mangaTags.map(tag => (
                                    <span key={tag.id} className="user-tag-badge" style={{ borderColor: tag.color }}>
                                        <span className="tag-dot" style={{ background: tag.color }} />
                                        {tag.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        {currentManga.details && (
                            <div className="manga-metadata">
                                {currentManga.details.map((item: any) => (
                                    <span key={item.label} className="metadata-item">
                                        <span className="metadata-label">{item.label}:</span>{' '}
                                        <span className="metadata-value">{item.value}</span>
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="manga-actions">
                            {isInLibrary ? (
                                <>
                                    <button className="btn btn-secondary" onClick={handleRemoveFromLibrary}>
                                        <Icons.Check width={16} height={16} style={{ marginRight: '6px' }} /> In Library
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => setIsTagSelectorOpen(true)}>
                                        <Icons.Tag width={16} height={16} style={{ marginRight: '6px' }} /> Tags
                                    </button>
                                    <button
                                        className={`btn ${anilistId ? 'btn-anilist-linked' : 'btn-secondary'}`}
                                        onClick={() => setIsAniListModalOpen(true)}
                                        title={anilistId ? `Linked to AniList (ID: ${anilistId})` : 'Track on AniList'}
                                    >
                                        <Icons.Chart width={16} height={16} style={{ marginRight: '6px' }} /> {anilistId ? 'Tracking' : 'Track'}
                                    </button>
                                </>
                            ) : (
                                <button className="btn btn-primary" onClick={handleAddToLibrary}>
                                    <Icons.Plus width={18} height={18} style={{ marginRight: '6px' }} /> Add to Library
                                </button>
                            )}
                            {currentChapters.length > 0 && (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => handleReadChapter(currentChapters[currentChapters.length - 1].id)}
                                >
                                    <Icons.Play width={18} height={18} style={{ marginRight: '6px', fill: 'currentColor' }} /> Start Reading
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {
                isTagSelectorOpen && libraryEntry && (
                    <TagSelector
                        mangaId={libraryEntry.id}
                        onClose={() => setIsTagSelectorOpen(false)}
                    />
                )
            }

            {/* Description - only show if available */}
            {
                currentManga.description && (
                    <div className="manga-section">
                        <h2 className="section-title">Description</h2>
                        <p className="manga-description">
                            {currentManga.description}
                        </p>
                    </div>
                )
            }

            <div className="manga-section">
                <div className="section-header">
                    <h2 className="section-title">
                        Chapters
                        <span className="chapter-count">({currentChapters.length})</span>
                    </h2>
                    <div className="chapter-controls">
                        <button
                            className="btn-icon"
                            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                            title={`Sort ${sortOrder === 'desc' ? 'Ascending' : 'Descending'}`}
                        >
                            {sortOrder === 'desc' ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="M11 5h10" /><path d="M11 9h10" /><path d="M11 13h10" /></svg>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 4-4 4 4" /><path d="M7 4v16" /><path d="M11 12h10" /><path d="M11 8h10" /><path d="M11 16h10" /></svg>
                            )}
                        </button>
                        <button
                            className="btn-icon"
                            onClick={handleMarkAllUnread}
                            title="Mark all as unread"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                        </button>
                    </div>
                </div>
                <div className="chapter-list">
                    {Array.from(new Map(sortedChapters.map(c => [c.id, c])).values()).map((chapter) => (
                        <div
                            key={chapter.id}
                            className={`chapter-item ${chapter.read_at ? 'read' : ''}`}
                            onClick={() => handleReadChapter(chapter.id)}
                        >
                            <div className="detail-chapter-info">
                                <span className="chapter-number">Ch. {chapter.chapterNumber}</span>
                                <span className="chapter-title">{chapter.title}</span>
                            </div>
                            {chapter.uploadDate && (
                                <span className="chapter-date">
                                    {(() => {
                                        const date = new Date(chapter.uploadDate);
                                        // Fix for extensions that parse MM/DD without year (defaults to 2001)
                                        if (date.getFullYear() < 2010) {
                                            date.setFullYear(new Date().getFullYear());
                                        }
                                        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                    })()}
                                </span>
                            )}

                            <div className="chapter-actions">
                                <button
                                    className="action-icon-btn"
                                    onClick={(e) => handleToggleRead(e, chapter)}
                                    title={chapter.read_at ? "Mark as unread" : "Mark as read"}
                                >
                                    {chapter.read_at ? (
                                        // Eye Off (Mark as Unread)
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        // Double Check (Mark as Read)
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M18 6 7 17l-5-5" />
                                            <path d="m22 10-7.5 7.5L13 16" />
                                        </svg>
                                    )}
                                </button>
                                <button
                                    className="action-icon-btn"
                                    onClick={(e) => handleMarkPreviousRead(e, chapter.id)}
                                    title={sortOrder === 'desc' ? "Mark previous (older) chapters as read" : "Mark previous (older) chapters as read"}
                                >
                                    {sortOrder === 'desc' ? (
                                        // Down Arrow (Desc: Older are below)
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <polyline points="19 12 12 19 5 12" />
                                        </svg>
                                    ) : (
                                        // Up Arrow (Asc: Older are above)
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="19" x2="12" y2="5" />
                                            <polyline points="5 12 12 5 19 12" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <AniListLinkModal
                isOpen={isAniListModalOpen}
                mangaTitle={currentManga?.title || ''}
                mangaId={libraryEntry?.id || ''}
                currentAnilistId={anilistId}
                onClose={() => setIsAniListModalOpen(false)}
                onLinked={(id) => {
                    setAnilistId(id);
                    // Sync progress immediately after linking
                    if (libraryEntry?.id && isAniListAuthenticated) {
                        syncProgress(libraryEntry.id);
                    }
                }}
                onUnlinked={() => setAnilistId(null)}
            />
        </div >
    );
}

export default MangaDetail;
