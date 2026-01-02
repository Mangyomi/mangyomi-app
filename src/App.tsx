import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAppStore } from './stores/appStore';
import { useExtensionStore } from './features/extensions/stores/extensionStore';
import { useLibraryStore } from './features/library/stores/libraryStore';
import { useSettingsStore } from './features/settings/stores/settingsStore';
import { useAniListStore } from './stores/anilistStore';
import { useTagStore } from './features/tags/stores/tagStore';
import Sidebar from './components/Layout/Sidebar/Sidebar';
import CaptchaModal from './components/CaptchaModal';
import { DialogProvider } from './components/ConfirmModal/DialogContext';
import MangaDetail from './pages/MangaDetail/MangaDetail';
import TitleBar from './components/Layout/TitleBar/TitleBar';
import PrefetchOverlay from './components/PrefetchOverlay/PrefetchOverlay';
import './App.css';

// Lazy Load Reader
const ReaderPage = lazy(() => import('./features/reader/components/ReaderPage'));
const Browse = lazy(() => import('./features/browse/components/Browse'));
const History = lazy(() => import('./features/history/components/History'));
const Tags = lazy(() => import('./features/tags/components/Tags'));
const Extensions = lazy(() => import('./features/extensions/components/Extensions'));
const Library = lazy(() => import('./features/library/components/Library'));
const Settings = lazy(() => import('./features/settings/components/Settings'));

function App() {
    const { loadExtensions } = useExtensionStore();
    const { loadLibrary } = useLibraryStore();
    const { loadTags } = useTagStore();
    const {
        captchaUrl,
        captchaCallback,
        hideCaptcha,
    } = useAppStore();

    const { loadSettings } = useSettingsStore();
    const { loadFromStorage: loadAniListFromStorage } = useAniListStore();

    useEffect(() => {
        // Initialize app data
        loadSettings();
        loadAniListFromStorage();
        loadExtensions();
        loadLibrary();
        loadTags();
    }, []);

    const handleCaptchaSolved = () => {
        const callback = captchaCallback;
        hideCaptcha();

        if (callback) {
            setTimeout(callback, 500);
        }
    };

    return (
        <DialogProvider>
            <div className="app">
                <TitleBar />
                <div className="app-content" style={{ marginTop: 32 }}>
                    <Sidebar />
                    <main className="main-content">
                        <Suspense fallback={
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                <div className="spinner"></div>
                            </div>
                        }>
                            <Routes>
                                <Route path="/" element={<Library />} />
                                <Route path="/browse" element={<Browse />} />
                                <Route path="/history" element={<History />} />
                                <Route path="/tags" element={<Tags />} />
                                <Route path="/extensions" element={<Extensions />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/manga/:extensionId/:mangaId" element={<MangaDetail />} />
                                <Route path="/read/:extensionId/*" element={<ReaderPage />} />
                            </Routes>
                        </Suspense>
                    </main>
                </div>

                {/* Global Prefetch Overlay */}
                <PrefetchOverlay />

                {/* Global Captcha Modal */}
                {captchaUrl && (
                    <CaptchaModal
                        url={captchaUrl}
                        onSolved={handleCaptchaSolved}
                        onClose={hideCaptcha}
                    />
                )}
            </div>
        </DialogProvider>
    );
}

export default App;
