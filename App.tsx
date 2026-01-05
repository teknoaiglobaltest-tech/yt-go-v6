
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Home from './components/Home';
import AssetManager from './components/AssetManager';
import History from './components/History';
import FashionManager from './components/FashionManager';
import GeneralProductManager from './components/GeneralProductManager';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import SettingsModal from './components/Settings'; // Renamed for clarity
import { Page, Mode, VideoHistoryItem } from './types';
import { SuperAffiliateIcon } from './components/icons/Icons';
import ContentCreator from './components/ContentCreator';
// FIX: Changed the default import of 'VideoView' to a named import to match its export.
import { VideoView } from './components/VideoView';
import { dbService } from './services/db';
import AutoStory from './components/AutoStory';

const App: React.FC = () => {
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [isCheckingEmbed, setIsCheckingEmbed] = useState(true);

  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Check if the app is inside an iframe.
    try {
        const embedded = window.self !== window.top;
        setIsEmbedded(embedded);
    } catch (e) {
        // An error indicates we are in a cross-origin iframe.
        setIsEmbedded(true);
    }
    setIsCheckingEmbed(false);
  }, []);


  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Use clientX/Y for viewport-relative coordinates
      document.documentElement.style.setProperty('--global-mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--global-mouse-y', `${e.clientY}px`);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);

    // Cleanup listener on component unmount
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, []); // Empty dependency array ensures this runs only on mount/unmount

  const handleAddVideoHistory = async (item: { mode: Mode; prompt: string; output: Blob }) => {
    try {
        await dbService.addVideoHistoryItem({
            ...item,
            createdAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error("Failed to save video history:", err);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home setCurrentPage={setCurrentPage} />;
      case 'general-product':
        // Pass setCurrentPage to allow navigation from within the component
        return <GeneralProductManager setCurrentPage={setCurrentPage} />;
      case 'content-creator':
        return <ContentCreator setCurrentPage={setCurrentPage} />;
      case 'autostory':
        return <AutoStory />;
      case 'video':
        return <VideoView onAddHistory={handleAddVideoHistory} />;
      case 'asset':
        return <AssetManager />;
      case 'fashion':
        return <FashionManager />;
      case 'history':
        return <History setCurrentPage={setCurrentPage} />;
      default:
        return <Home setCurrentPage={setCurrentPage} />;
    }
  };

  if (isCheckingEmbed) {
    // Render a blank screen or a full-page loader while checking
    return null;
  }

  if (!isEmbedded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white text-center p-4">
        <div className="fashion-card card-glow p-8 md:p-12 max-w-md w-full">
          <SuperAffiliateIcon className="w-16 h-16 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-red-500 mb-4">Akses Ditolak</h1>
          <p className="text-gray-300 text-lg">
            Aplikasi ini hanya bisa dibuka jika anda berlangganan resmi.
          </p>
          <p className="text-gray-400 mt-2 text-sm">
            Silahkan daftar dan beli aksesnya di <a href="https://gudangbot.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">gudangbot.com</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="text-white min-h-screen flex"
    >
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      <div className="flex flex-col flex-1 md:ml-64">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main key={currentPage} className="flex-1 p-4 sm:p-6 lg:p-10 overflow-y-auto pb-24 md:pb-10 page-fade-in">
          {renderPage()}
        </main>
        <BottomNav 
          currentPage={currentPage} 
          setCurrentPage={setCurrentPage}
          onSettingsClick={() => setIsSettingsOpen(true)}
        />
      </div>
       <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default App;
