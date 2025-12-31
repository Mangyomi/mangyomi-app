import { useNavigate } from 'react-router-dom';
import './MangaCard.css';

interface MangaCardProps {
    id: string;
    title: string;
    coverUrl: string;
    extensionId: string;
    index?: number;
    inLibrary?: boolean;
    totalChapters?: number;
    readChapters?: number;
    onContextMenu?: (e: React.MouseEvent, manga: { id: string; title: string; extensionId: string }) => void;
}

function MangaCard({ id, title, coverUrl, extensionId, index = 0, inLibrary, totalChapters, readChapters, onContextMenu }: MangaCardProps) {
    const navigate = useNavigate();

    const isFullyRead = inLibrary && totalChapters !== undefined && totalChapters > 0 && readChapters === totalChapters;

    const handleClick = () => {
        navigate(`/manga/${extensionId}/${encodeURIComponent(id)}`);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if (onContextMenu) {
            onContextMenu(e, { id, title, extensionId });
        }
    };

    // Use proxied URL for images
    const proxiedCoverUrl = window.electronAPI?.getProxiedImageUrl
        ? window.electronAPI.getProxiedImageUrl(coverUrl, extensionId)
        : coverUrl;

    return (
        <div
            className={`manga-card ${isFullyRead ? 'fully-read' : ''}`}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            style={{ '--index': index } as React.CSSProperties}
        >
            <div className="manga-card-cover">
                <img
                    src={proxiedCoverUrl}
                    alt={title}
                    loading="lazy"
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="220" viewBox="0 0 160 220"><rect fill="%2327272a" width="160" height="220"/><text x="80" y="110" font-family="sans-serif" font-size="14" fill="%2371717a" text-anchor="middle">No Cover</text></svg>';
                    }}
                />
                {inLibrary && (
                    <div className="manga-card-badge">
                        <span>{isFullyRead ? 'READ' : 'IN LIBRARY'}</span>
                    </div>
                )}
            </div>
            <div className="manga-card-info">
                <h3 className="manga-card-title">{title}</h3>
            </div>
        </div>
    );
}

export default MangaCard;

