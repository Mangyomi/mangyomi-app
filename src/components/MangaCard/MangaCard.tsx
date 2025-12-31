import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../Icons';
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
    const [imageError, setImageError] = useState(false);

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
                {!imageError && proxiedCoverUrl ? (
                    <img
                        src={proxiedCoverUrl}
                        alt={title}
                        loading="lazy"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="manga-card-placeholder">
                        <Icons.Book width={48} height={48} opacity={0.3} />
                    </div>
                )}
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

