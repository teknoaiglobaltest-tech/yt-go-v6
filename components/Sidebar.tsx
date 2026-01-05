
import React from 'react';
import { Page } from '../types';
import { HomeIcon, ClockIcon, ShirtIcon, PresentationChartBarIcon, CubeTransparentIcon, SuperAffiliateIcon, SpeakerWaveIcon, FilmIcon, VideoCameraIcon, CogIcon, BookOpenIcon } from './icons/Icons';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  isOpen: boolean;
  onClose: () => void;
  onSettingsClick: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, isOpen, onClose, onSettingsClick }) => {
  const navItems = [
    { id: 'home', label: 'Beranda', icon: <HomeIcon /> },
    { id: 'asset', label: 'Aset', icon: <CubeTransparentIcon /> },
    { id: 'content-creator', label: 'Buat Konten', icon: <FilmIcon /> },
    { id: 'autostory', label: 'AutoStory', icon: <BookOpenIcon /> },
    { id: 'video', label: 'Buat Video', icon: <VideoCameraIcon /> },
    { id: 'history', label: 'Riwayat', icon: <ClockIcon /> },
  ];

  const handleNavClick = (page: Page) => {
    setCurrentPage(page);
    onClose();
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const item = e.currentTarget;
    const rect = item.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    item.style.setProperty('--mouse-x', `${x}px`);
    item.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <>
      {/* Overlay for mobile */}
      <div 
        className={`fixed inset-0 bg-black/60 z-30 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>
      
      <nav className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-700 p-4 flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-start gap-3 mb-10 p-2">
          <SuperAffiliateIcon className="w-8 h-8" />
          <span className="text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500">Youtube Go</span>
        </div>
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onMouseMove={handleMouseMove}
                onClick={() => handleNavClick(item.id as Page)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors card-glow ${
                  currentPage === item.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-auto">
            <button
                onMouseMove={handleMouseMove}
                onClick={() => {
                  onSettingsClick();
                  onClose();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors card-glow text-gray-400 hover:bg-gray-700 hover:text-white"
            >
                <CogIcon />
                <span className="font-medium">Pengaturan</span>
            </button>
            <div className="p-4 bg-gray-800 rounded-lg text-center mt-2">
                <p className="text-sm text-gray-400">Ubah Ide Random Jadi Konten.</p>
                <p className="text-xs text-gray-500 mt-2">&copy; 2024</p>
            </div>
        </div>
      </nav>
    </>
  );
};

export default Sidebar;
