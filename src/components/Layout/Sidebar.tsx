import { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../stores/appStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Logo } from '../Logo';
import './Sidebar.css';

// SVG Icons
const Icons = {
    // ... (icons remain unchanged, skipping for brevity in replacement if possible, but replace_file_content needs context)
    Library: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
    ),
    Browse: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    ),
    History: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l4 2" />
        </svg>
    ),
    Tags: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
            <path d="M7 7h.01" />
        </svg>
    ),
    Extensions: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M10 12v4" />
            <path d="M8 14h4" />
        </svg>
    ),
    Settings: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ),
};

const SIDEBAR_WIDTH = 260; // Default width
const COLLAPSED_WIDTH = 72; // Icon-only width
const COLLAPSE_THRESHOLD = 150; // Width below which we snap to collapsed
const MIN_WIDTH = 200; // Min expanded width
const MAX_WIDTH = 480;

function Sidebar() {
    const { library, extensions } = useAppStore();
    const { hideNsfwInLibrary, hideNsfwCompletely } = useSettingsStore();

    // Default to expanded, read from local storage if needed in future
    const [width, setWidth] = useState(SIDEBAR_WIDTH);
    const [isResizing, setIsResizing] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Compute filtered library count
    const filteredLibraryCount = useMemo(() => {
        if (!hideNsfwCompletely && !hideNsfwInLibrary) {
            return library.length;
        }

        const nsfwExtensions = new Set(
            extensions.filter(ext => ext.nsfw).map(ext => ext.id)
        );

        return library.filter(m => !nsfwExtensions.has(m.source_id)).length;
    }, [library, extensions, hideNsfwCompletely, hideNsfwInLibrary]);

    // Check local storage on mount
    useEffect(() => {
        const savedWidth = localStorage.getItem('sidebar-width');
        if (savedWidth) {
            const w = parseInt(savedWidth, 10);
            if (!isNaN(w)) {
                setWidth(w);
                setIsCollapsed(w <= COLLAPSE_THRESHOLD);
                document.documentElement.style.setProperty('--sidebar-width', `${w}px`);
            }
        }
    }, []);

    const navItems = [
        { path: '/', label: 'Library', icon: Icons.Library, count: filteredLibraryCount },
        { path: '/browse', label: 'Browse', icon: Icons.Browse },
        { path: '/history', label: 'History', icon: Icons.History },
        { path: '/tags', label: 'Tags', icon: Icons.Tags },
        { path: '/extensions', label: 'Extensions', icon: Icons.Extensions },
        { path: '/settings', label: 'Settings', icon: Icons.Settings },
    ];

    const startResizing = useCallback(() => {
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback(
        (mouseMoveEvent: MouseEvent) => {
            if (isResizing) {
                let mouseX = mouseMoveEvent.clientX;

                // Constraints
                if (mouseX > MAX_WIDTH) mouseX = MAX_WIDTH;

                // Instant snap logic
                // If mouse position is below MIN_WIDTH, we treat it as collapsed visual state
                let effectiveWidth = mouseX;
                let shouldBeCollapsed = false;

                if (mouseX < MIN_WIDTH) {
                    effectiveWidth = COLLAPSED_WIDTH;
                    shouldBeCollapsed = true;
                }

                // Update state
                setWidth(effectiveWidth);
                setIsCollapsed(shouldBeCollapsed);
                document.documentElement.style.setProperty('--sidebar-width', `${effectiveWidth}px`);
            }
        },
        [isResizing]
    );

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    // Prevent text selection while resizing
    useEffect(() => {
        if (isResizing) {
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
        } else {
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }
    }, [isResizing]);

    // Finalize on stop
    useEffect(() => {
        if (!isResizing) {
            // Save current state to local storage
            localStorage.setItem('sidebar-width', String(width));
        }
    }, [isResizing, width]);

    return (
        <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
                <div className="logo">
                    <Logo size={32} />
                    {!isCollapsed && <span className="logo-text">Mangyomi</span>}
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        title={isCollapsed ? item.label : undefined}
                    >
                        <item.icon />
                        {!isCollapsed && <span className="nav-label">{item.label}</span>}
                        {!isCollapsed && item.count !== undefined && item.count > 0 && (
                            <span className="nav-count">{item.count}</span>
                        )}
                        {/* Dot indicator for count when collapsed? */}
                        {isCollapsed && item.count !== undefined && item.count > 0 && (
                            <div className="nav-count-dot" />
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-footer">
                {!isCollapsed && <div className="version">v{APP_VERSION}</div>}
            </div>

            <div
                className="sidebar-resizer"
                onMouseDown={startResizing}
            />
        </aside>
    );
}

export default Sidebar;
