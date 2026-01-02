import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../../stores/appStore';
import { useSettingsStore } from '../../settings/stores/settingsStore';
import { useExtensionStore } from '../../extensions/stores/extensionStore';
import { useReaderStore } from '../stores/readerStore';
import Tooltip from '../../../components/Tooltip/Tooltip';
import './ReaderPage.css';

function ReaderPage() {
    const { extensionId, '*': chapterIdParam } = useParams<{ extensionId: string; '*': string }>();
    const navigate = useNavigate();
    const location = useLocation();

    // App Store - Global Data
    const {
        markChapterRead,
        currentChapters,
        currentManga,
        prefetchChapter,
        loadChapters,
        loadMangaDetails,
    } = useAppStore();

    const { extensions } = useExtensionStore();

    // Reader Store - Session Data
    const {
        pages: currentPages,
        currentPageIndex,
        loadChapterPages,
        setCurrentPageIndex,
        zoomLevel,
        setZoomLevel,
        readerMode,
        setReaderMode,
        loading
    } = useReaderStore();

    // Settings
    const {
        prefetchChapters,
        defaultReaderMode,
        discordRpcEnabled,
        discordRpcHideNsfw,
        discordRpcStrictNsfw
    } = useSettingsStore();

    const containerRef = useRef<HTMLDivElement>(null);
    const [showChapterSelect, setShowChapterSelect] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const chapterId = decodeURIComponent(chapterIdParam || '');
    const locationState = location.state as { mangaId?: string; mangaTitle?: string } | null;

    const currentChapterIndex = currentChapters.findIndex(c => c.id === chapterId);
    const prevChapter = currentChapters[currentChapterIndex + 1];
    const nextChapter = currentChapters[currentChapterIndex - 1];

    // Initialize Default Mode on Mount if needed (or prefer store persistence)
    // For now, we respect the setting on initial load if store is "fresh"
    useEffect(() => {
        // Only set if we haven't touched it yet / or maybe we want to always reset?
        // Let's stick to simple: if store mode is defaults, maybe set it?
        // Actually, let's just use the store state. If we want to enforce default on open, we can do it here.
        if (defaultReaderMode) {
            setReaderMode(defaultReaderMode);
        }
    }, []); // Run once on mount

    // Load Manga/Chapter Data
    useEffect(() => {
        if (extensionId && locationState?.mangaId) {
            if (!currentManga || currentManga.id !== locationState.mangaId) {
                loadMangaDetails(extensionId, locationState.mangaId);
            }
            const chapterExists = currentChapters.some(c => c.id === chapterId);
            if (!chapterExists) {
                loadChapters(extensionId, locationState.mangaId);
            }
        }
    }, [extensionId, locationState?.mangaId, chapterId]);

    // Load Pages
    const hasMarkedReadRef = useRef<string>('');
    useEffect(() => {
        const loadPages = async () => {
            if (!extensionId || !chapterId) return;
            try {
                await loadChapterPages(extensionId, chapterId);
            } catch (e) {
                console.error('Failed to load pages:', e);
            }
        };

        loadPages();

        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }
        window.scrollTo(0, 0);
        hasMarkedReadRef.current = '';
    }, [extensionId, chapterId]);

    // Mark Read
    useEffect(() => {
        if (currentManga && currentPages.length > 0 && chapterId && hasMarkedReadRef.current !== chapterId) {
            markChapterRead(chapterId, 0);
            hasMarkedReadRef.current = chapterId;
        }
    }, [currentManga, currentPages, chapterId, markChapterRead]);

    // Discord RPC
    useEffect(() => {
        if (!discordRpcEnabled || !window.electronAPI.discord) return;

        const updateStatus = async () => {
            if (!currentManga || !chapterId) return;

            const extension = extensions.find(e => e.id === extensionId);
            const isExplicitNsfw = currentManga.nsfw || false;
            const isExtensionNsfw = extension?.nsfw || false;

            // Fix: explicit check for boolean true
            const isNsfw = isExplicitNsfw === true || (discordRpcStrictNsfw && isExtensionNsfw === true);
            const shouldHide = discordRpcHideNsfw && isNsfw;

            if (shouldHide) {
                await window.electronAPI.discord.clearActivity();
                return;
            }

            const chapterTitle = currentChapters.find(c => c.id === chapterId)?.title || `Chapter ${chapterId.split('/').pop()?.replace('chapter-', '')}`;
            const sourceName = extension?.name || 'Mangyomi';
            const smallImageKey = sourceName.toLowerCase().replace(/\s+/g, '');

            const buttons: { label: string; url: string }[] = [];
            if (currentManga.anilistId) {
                buttons.push({
                    label: 'View on AniList',
                    url: `https://anilist.co/manga/${currentManga.anilistId}`
                });
            }
            buttons.push({
                label: 'Mangyomi on GitHub',
                url: 'https://github.com/Mangyomi/mangyomi-app'
            });

            await window.electronAPI.discord.updateActivity(
                currentManga.title,
                `Reading ${chapterTitle}`,
                'icon',
                'Mangyomi',
                smallImageKey,
                sourceName,
                buttons
            );
        };

        updateStatus();
    }, [discordRpcEnabled, discordRpcHideNsfw, discordRpcStrictNsfw, currentManga, chapterId, currentChapters, extensions]);

    // Clear RPC on unmount
    useEffect(() => {
        return () => {
            if (discordRpcEnabled && window.electronAPI.discord) {
                window.electronAPI.discord.clearActivity();
            }
        };
    }, [discordRpcEnabled]);

    // Prefetch
    useEffect(() => {
        if (!extensionId || prefetchChapters === 0 || currentChapters.length === 0) return;
        const chaptersToFetch: string[] = [];

        for (let i = 1; i <= prefetchChapters; i++) {
            const nextIdx = currentChapterIndex - i;
            if (nextIdx >= 0 && currentChapters[nextIdx]) {
                chaptersToFetch.push(currentChapters[nextIdx].id);
            }
            const prevIdx = currentChapterIndex + i;
            if (prevIdx < currentChapters.length && currentChapters[prevIdx]) {
                chaptersToFetch.push(currentChapters[prevIdx].id);
            }
        }

        chaptersToFetch.forEach((chId, index) => {
            setTimeout(() => {
                prefetchChapter(extensionId, chId);
            }, index * 500);
        });
    }, [extensionId, chapterId, currentChapterIndex, prefetchChapters, currentChapters]);

    // Controls
    const handleZoomIn = () => setZoomLevel(Math.min(zoomLevel + 0.25, 3));
    const handleZoomOut = () => setZoomLevel(Math.max(zoomLevel - 0.25, 0.5));
    const handleResetZoom = () => setZoomLevel(1);

    const handleChapterSelect = (targetChapterId: string) => {
        setShowChapterSelect(false);
        if (targetChapterId !== chapterId) {
            navigate(`/read/${extensionId}/${encodeURIComponent(targetChapterId)}`, { replace: true });
        }
    };

    const handlePrevChapter = () => {
        if (prevChapter) {
            navigate(`/read/${extensionId}/${encodeURIComponent(prevChapter.id)}`, { replace: true });
        }
    };

    const handleNextChapter = () => {
        if (nextChapter) {
            navigate(`/read/${extensionId}/${encodeURIComponent(nextChapter.id)}`, { replace: true });
        }
    };

    const handleGoBack = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            if (currentManga && extensionId) {
                navigate(`/manga/${extensionId}/${currentManga.id}`, { replace: true });
            } else if (locationState?.mangaId && extensionId) {
                navigate(`/manga/${extensionId}/${encodeURIComponent(locationState.mangaId)}`, { replace: true });
            } else {
                navigate('/history', { replace: true });
            }
        }
    };

    // Scroll Handler
    const handleScroll = useCallback(() => {
        if (!containerRef.current || readerMode !== 'vertical') return;

        const container = containerRef.current;
        const pageWrappers = container.querySelectorAll('.reader-page-wrapper');
        const containerTop = container.scrollTop;
        const containerHeight = container.clientHeight;

        for (let i = 0; i < pageWrappers.length; i++) {
            const wrapper = pageWrappers[i] as HTMLElement;
            const wrapperTop = wrapper.offsetTop - container.offsetTop;
            const wrapperHeight = wrapper.clientHeight;

            if (wrapperTop + wrapperHeight > containerTop && wrapperTop < containerTop + containerHeight) {
                if (currentPageIndex !== i) {
                    setCurrentPageIndex(i);
                    // Mark progress if past 50%
                    if (i > currentPages.length * 0.5) {
                        markChapterRead(chapterId, i);
                    }
                }
                break;
            }
        }
    }, [readerMode, currentPageIndex, currentPages.length, chapterId]);

    // Keyboard handlers
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (readerMode === 'horizontal') {
                if (e.key === 'ArrowLeft' && currentPageIndex > 0) {
                    setCurrentPageIndex(currentPageIndex - 1);
                } else if (e.key === 'ArrowRight' && currentPageIndex < currentPages.length - 1) {
                    setCurrentPageIndex(currentPageIndex + 1);
                }
            } else {
                if (e.key === 'ArrowLeft') {
                    handlePrevChapter();
                } else if (e.key === 'ArrowRight') {
                    handleNextChapter();
                }
            }

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (containerRef.current) {
                    e.preventDefault();
                    const direction = e.key === 'ArrowDown' ? 1 : -1;
                    const scrollAmount = 50;
                    containerRef.current.scrollBy({ top: direction * scrollAmount, behavior: 'auto' });
                }
            }

            if (e.key === 'Escape') {
                handleGoBack();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [readerMode, currentPageIndex, currentPages.length, navigate]);


    // Click Outside for dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowChapterSelect(false);
            }
        };

        if (showChapterSelect) {
            document.addEventListener('mousedown', handleClickOutside);
            setTimeout(() => {
                const activeOption = dropdownRef.current?.querySelector('.chapter-option.active');
                if (activeOption) {
                    activeOption.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            }, 10);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showChapterSelect]);


    if (!loading && currentPages.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <h2 className="empty-state-title">No pages found</h2>
                <button className="btn btn-primary" onClick={handleGoBack}>
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className={`chapter-reader ${readerMode}`}>
            {/* Controls Overlay */}
            <div className="reader-controls">
                <div className="reader-header">
                    <Tooltip content="Back" position="bottom">
                        <button className="btn btn-ghost btn-icon" onClick={handleGoBack}>
                            ←
                        </button>
                    </Tooltip>

                    <div className="reader-title-container" ref={dropdownRef}>
                        <button
                            className={`chapter-select-btn ${showChapterSelect ? 'active' : ''}`}
                            onClick={() => setShowChapterSelect(!showChapterSelect)}
                        >
                            <span className="chapter-name">
                                {currentChapters.find(c => c.id === chapterId)?.title || `Chapter ${chapterId.split('/').pop()?.replace('chapter-', '')}`}
                            </span>
                            <span className="dropdown-caret">▼</span>
                        </button>

                        {showChapterSelect && (
                            <div className="chapter-dropdown">
                                <div className="chapter-dropdown-header">
                                    <span>Select Chapter</span>
                                    <span className="chapter-count">{currentChapters.length} chapters</span>
                                </div>
                                <div className="chapter-list">
                                    {currentChapters.map((chapter) => (
                                        <div
                                            key={chapter.id}
                                            className={`chapter-option ${chapter.id === chapterId ? 'active' : ''}`}
                                            onClick={() => handleChapterSelect(chapter.id)}
                                        >
                                            <div className="chapter-info">
                                                <span className="chapter-option-title">{chapter.title}</span>
                                                {chapter.uploadDate && (
                                                    <span className="chapter-date">
                                                        {new Date(chapter.uploadDate).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            {!!chapter.read_at && <span className="chapter-read-indicator">Read</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="reader-nav-actions">
                        <Tooltip content="Previous Chapter" position="bottom">
                            <button
                                className="btn btn-ghost btn-icon"
                                onClick={handlePrevChapter}
                                disabled={!prevChapter}
                            >
                                ⏮
                            </button>
                        </Tooltip>
                        <Tooltip content="Next Chapter" position="bottom">
                            <button
                                className="btn btn-ghost btn-icon"
                                onClick={handleNextChapter}
                                disabled={!nextChapter}
                            >
                                ⏭
                            </button>
                        </Tooltip>
                    </div>

                    <div className="reader-options">
                        <div className="reader-zoom-controls">
                            <Tooltip content="Zoom Out" position="bottom">
                                <button className="btn btn-ghost btn-icon" onClick={handleZoomOut}>
                                    -
                                </button>
                            </Tooltip>
                            <Tooltip content="Reset Zoom" position="bottom">
                                <button className="btn btn-ghost btn-text" onClick={handleResetZoom}>
                                    {Math.round(zoomLevel * 100)}%
                                </button>
                            </Tooltip>
                            <Tooltip content="Zoom In" position="bottom">
                                <button className="btn btn-ghost btn-icon" onClick={handleZoomIn}>
                                    +
                                </button>
                            </Tooltip>
                        </div>
                        <div className="reader-mode-controls">
                            <Tooltip content="Vertical scroll" position="bottom">
                                <button
                                    className={`btn btn-ghost btn-icon ${readerMode === 'vertical' ? 'active' : ''}`}
                                    onClick={() => setReaderMode('vertical')}
                                >
                                    ↕
                                </button>
                            </Tooltip>
                            <Tooltip content="Horizontal pages" position="bottom">
                                <button
                                    className={`btn btn-ghost btn-icon ${readerMode === 'horizontal' ? 'active' : ''}`}
                                    onClick={() => setReaderMode('horizontal')}
                                >
                                    ↔
                                </button>
                            </Tooltip>
                        </div>
                    </div>
                </div>

                {/* Side Progress Bar */}
                <div
                    className="reader-sidebar"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        const sidebar = e.currentTarget;
                        const rect = sidebar.getBoundingClientRect();
                        const scrollContainer = containerRef.current;

                        const handleMove = (moveEvent: MouseEvent) => {
                            const barHeight = rect.height;
                            const relativeY = moveEvent.clientY - rect.top;
                            const percentage = Math.max(0, Math.min(1, relativeY / barHeight));

                            if (readerMode === 'vertical') {
                                if (!scrollContainer) return;
                                const totalScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
                                scrollContainer.scrollTop = totalScroll * percentage;
                            } else {
                                const targetPage = Math.floor(percentage * (currentPages.length - 1));
                                setCurrentPageIndex(targetPage);
                            }
                        };

                        handleMove(e as unknown as MouseEvent);

                        const handleUp = () => {
                            window.removeEventListener('mousemove', handleMove);
                            window.removeEventListener('mouseup', handleUp);
                        };

                        window.addEventListener('mousemove', handleMove);
                        window.addEventListener('mouseup', handleUp);
                    }}
                >
                    <div className="sidebar-track">
                        <div
                            className="sidebar-fill"
                            style={{ height: `${((currentPageIndex + 1) / currentPages.length) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Reader Content */}
            {readerMode === 'vertical' ? (
                <div
                    ref={containerRef}
                    className="reader-scroll-container"
                    onScroll={handleScroll}
                >
                    {loading ? (
                        <div className="reader-loading-skeleton">
                            <div className="skeleton-page" />
                            <div className="skeleton-page" />
                            <div className="skeleton-page" />
                        </div>
                    ) : (
                        <>
                            {currentPages.map((pageUrl, index) => {
                                const proxiedUrl = window.electronAPI?.getProxiedImageUrl
                                    ? window.electronAPI.getProxiedImageUrl(pageUrl, extensionId!, currentManga?.id, chapterId)
                                    : pageUrl;

                                return (
                                    <div key={index} className="reader-page-wrapper">
                                        <img
                                            src={proxiedUrl}
                                            alt={`Page ${index + 1}`}
                                            className="reader-image"
                                            loading="lazy"
                                            style={{
                                                width: `${70 * zoomLevel}vw`,
                                                maxWidth: 'none'
                                            }}
                                        />
                                    </div>
                                );
                            })}

                            <div className="chapter-end">
                                <p>End of Chapter</p>
                                <div className="chapter-nav-buttons">
                                    {prevChapter && (
                                        <button className="btn btn-secondary" onClick={handlePrevChapter}>
                                            ← Previous Chapter
                                        </button>
                                    )}
                                    {nextChapter && (
                                        <button className="btn btn-primary" onClick={handleNextChapter}>
                                            Next Chapter →
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <div className="reader-horizontal-container" ref={containerRef}>
                    <button
                        className="page-nav prev"
                        onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                        disabled={currentPageIndex === 0 || loading}
                    >
                        ‹
                    </button>

                    {loading ? (
                        <div className="reader-loading-inline" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div className="spinner"></div>
                        </div>
                    ) : (
                        <img
                            src={
                                window.electronAPI?.getProxiedImageUrl
                                    ? window.electronAPI.getProxiedImageUrl(currentPages[currentPageIndex], extensionId!, currentManga?.id, chapterId)
                                    : currentPages[currentPageIndex]
                            }
                            alt={`Page ${currentPageIndex + 1}`}
                            className="reader-page"
                            style={{
                                maxHeight: `${100 * zoomLevel}vh`,
                                maxWidth: 'none'
                            }}
                        />
                    )}

                    <button
                        className="page-nav next"
                        onClick={() => setCurrentPageIndex(Math.min(currentPages.length - 1, currentPageIndex + 1))}
                        disabled={currentPageIndex === currentPages.length - 1 || loading}
                    >
                        ›
                    </button>
                </div>
            )}
            {!loading && (
                <div className="reader-persistent-indicator">
                    {currentPageIndex + 1} / {currentPages.length}
                </div>
            )}
        </div>
    );
}

export default ReaderPage;
