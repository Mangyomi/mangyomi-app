import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import './PrefetchOverlay.css'; // Reusing or creating new css

const PrefetchOverlay: React.FC = () => {
    const { isPrefetching, prefetchProgress, cancelPrefetch } = useAppStore();
    const location = useLocation();

    // Hide overlay when on reader page
    if (!isPrefetching || location.pathname.startsWith('/read/')) return null;

    return (
        <div className="prefetch-progress-overlay">
            <div className="prefetch-card">
                <div className="prefetch-header">
                    <span className="prefetch-title">Prefetching Chapters...</span>
                    <span className="prefetch-count">{prefetchProgress.current} / {prefetchProgress.total}</span>
                </div>
                <div className="prefetch-bar-bg">
                    <div
                        className="prefetch-bar-fill"
                        style={{ width: `${(prefetchProgress.current / prefetchProgress.total) * 100}%` }}
                    />
                </div>
                <div className="prefetch-status">
                    <span className="truncate">{prefetchProgress.chapter}</span>
                    <button className="btn-cancel-prefetch" onClick={cancelPrefetch}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default PrefetchOverlay;
