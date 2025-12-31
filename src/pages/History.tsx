import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useDialog } from '../components/ConfirmModal/DialogContext';
import './History.css';

function History() {
    const { history, loadHistory, removeFromHistory } = useAppStore();
    const { disabledExtensions } = useSettingsStore();
    const navigate = useNavigate();
    const location = useLocation();
    const dialog = useDialog();

    useEffect(() => {
        loadHistory();
    }, [location.key]);

    const visibleHistory = history.filter(entry => !disabledExtensions.has(entry.source_id));

    const groupedHistory = visibleHistory.reduce((groups, entry) => {
        const date = new Date(entry.read_at * 1000).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(entry);
        return groups;
    }, {} as Record<string, typeof history>);

    const handleContinueReading = (entry: typeof history[0]) => {
        const [extensionId] = entry.manga_id.split(':');
        const sourceMangaId = entry.manga_id.split(':').slice(1).join(':');

        const chapterId = entry.chapter_id.startsWith(`${extensionId}:`)
            ? entry.chapter_id.slice(extensionId.length + 1)
            : entry.chapter_id;

        navigate(`/read/${extensionId}/${encodeURIComponent(chapterId)}`, {
            state: {
                mangaId: sourceMangaId,
                mangaTitle: entry.manga_title,
            }
        });
    };

    if (history.length === 0) {
        return (
            <div className="history-page">
                <div className="page-header">
                    <h1 className="page-title">History</h1>
                </div>
                <div className="empty-state">
                    <div className="empty-state-icon">📖</div>
                    <h2 className="empty-state-title">No reading history yet</h2>
                    <p className="empty-state-description">
                        Start reading manga to see your history here
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="history-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">History</h1>
                    <p className="page-subtitle">Your recent reading activity</p>
                </div>
            </div>

            <div className="history-list">
                {Object.entries(groupedHistory).map(([date, entries]) => (
                    <div key={date} className="history-group">
                        <h3 className="history-date">{date}</h3>
                        <div className="history-entries">
                            {entries.map((entry) => {
                                const [extensionId] = entry.manga_id.split(':');
                                const proxiedCoverUrl = window.electronAPI?.getProxiedImageUrl
                                    ? window.electronAPI.getProxiedImageUrl(entry.cover_url, extensionId)
                                    : entry.cover_url;

                                return (
                                    <div
                                        key={`${entry.id}-${entry.chapter_id}`}
                                        className="history-entry"
                                        onClick={() => handleContinueReading(entry)}
                                    >
                                        <img
                                            src={proxiedCoverUrl}
                                            alt={entry.manga_title}
                                            className="history-cover"
                                        />
                                        <div className="history-info">
                                            <h4 className="history-manga-title">{entry.manga_title}</h4>
                                            <p className="history-chapter">
                                                {(() => {
                                                    const title = entry.chapter_title;
                                                    const num = entry.chapter_number;
                                                    const isRedundant =
                                                        title === `Chapter ${num}` ||
                                                        title === num.toString() ||
                                                        title.toLowerCase() === `chapter ${num}`;

                                                    return isRedundant
                                                        ? `Chapter ${num}`
                                                        : `Chapter ${num}: ${title}`;
                                                })()}
                                            </p>
                                            <p className="history-source">
                                                {entry.source_id?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown Source'}
                                            </p>
                                        </div>
                                        <button
                                            className="history-delete-btn"
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                const confirmed = await dialog.confirm({
                                                    title: 'Remove from History',
                                                    message: 'Remove this manga from history?',
                                                    confirmLabel: 'Remove',
                                                    isDestructive: true,
                                                });
                                                if (confirmed) {
                                                    removeFromHistory(entry.manga_id);
                                                }
                                            }}
                                            title="Remove from history"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 6h18"></path>
                                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                        <button className="btn btn-secondary history-continue">
                                            Continue
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default History;
