import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { useSettingsStore } from '../stores/settingsStore';
import './ChapterReader.css';

function ChapterReader() {
    const { extensionId, '*': chapterIdParam } = useParams<{ extensionId: string; '*': string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const {
        currentPages,
        currentPageIndex,
        loadChapterPages,
        setCurrentPageIndex,
        markChapterRead,
        currentChapters,
        currentManga,
        prefetchChapter,
        loadChapters,
        loadMangaDetails,
        extensions,
    } = useAppStore();

    // Settings for Discord RPC
    const {
        prefetchChapters,
        defaultReaderMode,
        discordRpcEnabled,
        discordRpcHideNsfw,
        hideNsfwCompletely,
        hideNsfwInLibrary,
        hideNsfwInTags,
        hideNsfwInHistory,
        discordRpcStrictNsfw
    } = useSettingsStore();

    const [loading, setLoading] = useState(true);
    const [readerMode, setReaderMode] = useState<'vertical' | 'horizontal'>(defaultReaderMode);
    const [zoomLevel, setZoomLevel] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);

    const chapterId = decodeURIComponent(chapterIdParam || '');

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
    const handleResetZoom = () => setZoomLevel(1);

    const locationState = location.state as { mangaId?: string; mangaTitle?: string } | null;

    const currentChapterIndex = currentChapters.findIndex(c => c.id === chapterId);
    const prevChapter = currentChapters[currentChapterIndex + 1];
    const nextChapter = currentChapters[currentChapterIndex - 1];

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

    // Discord RPC Effect
    useEffect(() => {
        if (!discordRpcEnabled || !window.electronAPI.discord) return;

        const updateStatus = async () => {
            if (!currentManga || !chapterId) return;

            // Get source info
            const extension = extensions.find(e => e.id === extensionId);

            // Check Privacy Settings
            // Check if manga is explicitly NSFW or if the extension itself is NSFW (if strict mode enabled)
            const isExplicitNsfw = currentManga.nsfw || false;
            const isExtensionNsfw = extension?.nsfw || false;

            const isNsfw = isExplicitNsfw || (discordRpcStrictNsfw && isExtensionNsfw);
            const shouldHide = discordRpcHideNsfw && isNsfw;

            if (shouldHide) {
                await window.electronAPI.discord.clearActivity();
                return;
            }

            const chapterTitle = currentChapters.find(c => c.id === chapterId)?.title || `Chapter ${chapterId.split('/').pop()?.replace('chapter-', '')}`;

            // Get source name for small icon
            const sourceName = extension?.name || 'Mangyomi';
            // Discord keys should be lowercase and have no spaces
            const smallImageKey = sourceName.toLowerCase().replace(/\s+/g, '');

            // Build buttons array
            const buttons: { label: string; url: string }[] = [];

            // Add AniList button if manga has anilistId
            if (currentManga.anilistId) {
                buttons.push({
                    label: 'View on AniList',
                    url: `https://anilist.co/manga/${currentManga.anilistId}`
                });
            }

            // Always add GitHub button
            buttons.push({
                label: 'Mangyomi on GitHub',
                url: 'https://github.com/Mangyomi/mangyomi-app'
            });

            await window.electronAPI.discord.updateActivity(
                currentManga.title,
                `Reading ${chapterTitle}`,
                'icon', // 'icon' is the asset key uploaded by the user
                'Mangyomi',
                smallImageKey,
                sourceName,
                buttons
            );
        };

        updateStatus();

        return () => {
            // Optional: Don't clear on every chapter change, only on unmount or if feature disabled
            // But since this effect runs on chapterId change, we just let the next update overwrite it.
            // We only clear on unmount of the component (leaving reader).
        };
    }, [discordRpcEnabled, discordRpcHideNsfw, discordRpcStrictNsfw, currentManga, chapterId, currentChapters, extensions]);

    // Clear activity on unmount (leaving reader)
    useEffect(() => {
        return () => {
            if (discordRpcEnabled && window.electronAPI.discord) {
                window.electronAPI.discord.clearActivity();
            }
        };
    }, [discordRpcEnabled]);

    const hasMarkedReadRef = useRef<string>('');

    useEffect(() => {
        const loadPages = async () => {
            if (!extensionId || !chapterId) return;

            setLoading(true);
            try {
                await loadChapterPages(extensionId, chapterId);
            } catch (e) {
                console.error('Failed to load pages:', e);
            } finally {
                setLoading(false);
            }
        };

        loadPages();

        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
        }
        window.scrollTo(0, 0);

        hasMarkedReadRef.current = '';
    }, [extensionId, chapterId]);

    useEffect(() => {
        if (currentManga && currentPages.length > 0 && chapterId && hasMarkedReadRef.current !== chapterId) {
            markChapterRead(chapterId, 0);
            hasMarkedReadRef.current = chapterId;
        }
    }, [currentManga, currentPages, chapterId, markChapterRead]);

    // Reset scroll position when page changes in horizontal mode
    useEffect(() => {
        if (readerMode === 'horizontal' && containerRef.current) {
            containerRef.current.scrollTop = 0;
            containerRef.current.scrollLeft = 0;
        }
    }, [currentPageIndex, readerMode]);

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

    const handleScroll = useCallback(() => {
        if (!containerRef.current || readerMode !== 'vertical') return;

        const container = containerRef.current;
        const images = container.querySelectorAll('.reader-image');
        const containerTop = container.scrollTop;
        const containerHeight = container.clientHeight;

        for (let i = 0; i < images.length; i++) {
            const img = images[i] as HTMLElement;
            const imgTop = img.offsetTop - container.offsetTop;
            const imgHeight = img.clientHeight;

            if (imgTop + imgHeight > containerTop && imgTop < containerTop + containerHeight) {
                if (currentPageIndex !== i) {
                    setCurrentPageIndex(i);
                    if (i > currentPages.length * 0.5) {
                        markChapterRead(chapterId, i);
                    }
                }
                break;
            }
        }
    }, [readerMode, currentPageIndex, currentPages.length, chapterId]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (readerMode === 'horizontal') {
                if (e.key === 'ArrowLeft' && currentPageIndex > 0) {
                    setCurrentPageIndex(currentPageIndex - 1);
                } else if (e.key === 'ArrowRight' && currentPageIndex < currentPages.length - 1) {
                    setCurrentPageIndex(currentPageIndex + 1);
                }
            }

            // Handle scroll with arrow keys
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (containerRef.current) {
                    e.preventDefault();
                    const direction = e.key === 'ArrowDown' ? 1 : -1;
                    const scrollAmount = 50; // Pixels to scroll
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

    const handleGoBack = () => {
        if (currentManga && extensionId) {
            navigate(`/manga/${extensionId}/${currentManga.id}`);
        } else if (locationState?.mangaId && extensionId) {
            navigate(`/manga/${extensionId}/${encodeURIComponent(locationState.mangaId)}`);
        } else {
            navigate('/history');
        }
    };

    const handlePrevChapter = () => {
        if (prevChapter) {
            navigate(`/read/${extensionId}/${encodeURIComponent(prevChapter.id)}`);
        }
    };

    const handleNextChapter = () => {
        if (nextChapter) {
            navigate(`/read/${extensionId}/${encodeURIComponent(nextChapter.id)}`);
        }
    };

    if (loading) {
        return (
            <div className="reader-loading">
                <div className="spinner"></div>
                <p>Loading chapter...</p>
            </div>
        );
    }

    if (currentPages.length === 0) {
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
                    <button className="btn btn-ghost btn-icon" onClick={handleGoBack} title="Back">
                        ←
                    </button>

                    <div className="reader-title">
                        <span className="chapter-name">{currentChapters.find(c => c.id === chapterId)?.title || `Chapter ${chapterId.split('/').pop()?.replace('chapter-', '')}`}</span>
                        <span className="page-indicator">
                            {currentPageIndex + 1} / {currentPages.length}
                        </span>
                    </div>

                    <div className="reader-nav-actions">
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={handlePrevChapter}
                            disabled={!prevChapter}
                            title="Previous Chapter"
                        >
                            ⏮
                        </button>
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={handleNextChapter}
                            disabled={!nextChapter}
                            title="Next Chapter"
                        >
                            ⏭
                        </button>
                    </div>

                    <div className="reader-options">
                        <div className="reader-zoom-controls">
                            <button className="btn btn-ghost btn-icon" onClick={handleZoomOut} title="Zoom Out">
                                -
                            </button>
                            <button className="btn btn-ghost btn-text" onClick={handleResetZoom} title="Reset Zoom">
                                {Math.round(zoomLevel * 100)}%
                            </button>
                            <button className="btn btn-ghost btn-icon" onClick={handleZoomIn} title="Zoom In">
                                +
                            </button>
                        </div>
                        <div className="reader-mode-controls">
                            <button
                                className={`btn btn-ghost btn-icon ${readerMode === 'vertical' ? 'active' : ''}`}
                                onClick={() => setReaderMode('vertical')}
                                title="Vertical scroll"
                            >
                                ↕
                            </button>
                            <button
                                className={`btn btn-ghost btn-icon ${readerMode === 'horizontal' ? 'active' : ''}`}
                                onClick={() => setReaderMode('horizontal')}
                                title="Horizontal pages"
                            >
                                ↔
                            </button>
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

                        // Calculate click position relative to bar height (0 to 1)
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
                    {currentPages.map((pageUrl, index) => {
                        const proxiedUrl = window.electronAPI?.getProxiedImageUrl
                            ? window.electronAPI.getProxiedImageUrl(pageUrl, extensionId!)
                            : pageUrl;

                        return (
                            <img
                                key={index}
                                src={proxiedUrl}
                                alt={`Page ${index + 1}`}
                                className="reader-image"
                                loading="lazy"
                                style={{
                                    width: `${70 * zoomLevel}vw`,
                                    maxWidth: 'none'
                                }}
                            />
                        );
                    })}

                    {/* End of chapter */}
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
                </div>
            ) : (
                <div className="reader-horizontal-container" ref={containerRef}>
                    <button
                        className="page-nav prev"
                        onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                        disabled={currentPageIndex === 0}
                    >
                        ‹
                    </button>

                    <img
                        src={
                            window.electronAPI?.getProxiedImageUrl
                                ? window.electronAPI.getProxiedImageUrl(currentPages[currentPageIndex], extensionId!)
                                : currentPages[currentPageIndex]
                        }
                        alt={`Page ${currentPageIndex + 1}`}
                        className="reader-page"
                        style={{
                            maxHeight: `${100 * zoomLevel}vh`,
                            maxWidth: 'none'
                        }}
                    />

                    <button
                        className="page-nav next"
                        onClick={() => setCurrentPageIndex(Math.min(currentPages.length - 1, currentPageIndex + 1))}
                        disabled={currentPageIndex === currentPages.length - 1}
                    >
                        ›
                    </button>
                </div>
            )}
            {/* Persistent Page Indicator */}
            <div className="reader-persistent-indicator">
                {currentPageIndex + 1} / {currentPages.length}
            </div>
        </div>
    );
}

export default ChapterReader;
