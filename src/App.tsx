import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAppStore } from './stores/appStore';
import { useSettingsStore } from './stores/settingsStore';
import { useAniListStore } from './stores/anilistStore';
import Sidebar from './components/Layout/Sidebar';
import CaptchaModal from './components/CaptchaModal';
import { DialogProvider } from './components/ConfirmModal/DialogContext';
import Gallery from './pages/Gallery';
import Browse from './pages/Browse';
import History from './pages/History';
import Tags from './pages/Tags';
import Extensions from './pages/Extensions';
import Settings from './pages/Settings';
import MangaDetail from './pages/MangaDetail';
import ChapterReader from './pages/ChapterReader';
import TitleBar from './components/Layout/TitleBar';
import PrefetchOverlay from './components/PrefetchOverlay';
import './App.css';

function App() {
    const {
        loadLibrary,
        loadExtensions,
        loadTags,
        loadHistory,
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
        loadHistory();
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
                        <Routes>
                            <Route path="/" element={<Gallery />} />
                            <Route path="/browse" element={<Browse />} />
                            <Route path="/history" element={<History />} />
                            <Route path="/tags" element={<Tags />} />
                            <Route path="/extensions" element={<Extensions />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/manga/:extensionId/:mangaId" element={<MangaDetail />} />
                            <Route path="/read/:extensionId/*" element={<ChapterReader />} />
                        </Routes>
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
