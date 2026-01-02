import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../../stores/appStore';
import './PrefetchOverlay.css';

const PrefetchOverlay: React.FC = () => {
    const { isPrefetching, prefetchProgress, cancelPrefetch } = useAppStore();
    const location = useLocation();

    // Hide overlay when on reader page
    if (!isPrefetching || location.pathname.startsWith('/read/')) return null;

    const hasError = !!prefetchProgress.error;
    const progressPercent = prefetchProgress.total > 0
        ? (prefetchProgress.current / prefetchProgress.total) * 100
        : 0;

    return (
        <div className="prefetch-progress-overlay">
            <div className={`prefetch-card ${hasError ? 'prefetch-error' : ''}`}>
                <div className="prefetch-header">
                    <span className="prefetch-title">
                        {hasError ? 'Prefetch Paused' : 'Prefetching Chapters...'}
                    </span>
                    <div className="prefetch-header-right">
                        <span className="prefetch-count">{prefetchProgress.current} / {prefetchProgress.total}</span>
                        {hasError && (
                            <button className="btn-close-prefetch" onClick={cancelPrefetch} title="Cancel prefetch">
                                ✕
                            </button>
                        )}
                    </div>
                </div>
                <div className={`prefetch-bar-bg ${hasError ? 'prefetch-bar-error' : ''}`}>
                    <div
                        className={`prefetch-bar-fill ${hasError ? 'prefetch-bar-fill-error' : ''}`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <div className="prefetch-status">
                    {hasError ? (
                        <span className="prefetch-error-message">{prefetchProgress.error}</span>
                    ) : (
                        <>
                            <span className="truncate">{prefetchProgress.chapter}</span>
                            <button className="btn-cancel-prefetch" onClick={cancelPrefetch}>Cancel</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PrefetchOverlay;
