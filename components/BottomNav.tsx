

import React from 'react';
import { Page } from '../types';
import { HomeIcon, ClockIcon, CubeTransparentIcon, FilmIcon, VideoCameraIcon, CogIcon, BookOpenIcon } from './icons/Icons';

interface BottomNavProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  onSettingsClick: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentPage, setCurrentPage, onSettingsClick }) => {
  const navItems = [
    { id: 'home', label: 'Beranda', icon: <HomeIcon />, action: () => setCurrentPage('home') },
    { id: 'asset', label: 'Aset', icon: <CubeTransparentIcon />, action: () => setCurrentPage('asset') },
    { id: 'content-creator', label: 'Konten', icon: <FilmIcon />, action: () => setCurrentPage('content-creator') },
    { id: 'autostory', label: 'AutoStory', icon: <BookOpenIcon />, action: () => setCurrentPage('autostory') },
    { id: 'video', label: 'Video', icon: <VideoCameraIcon />, action: () => setCurrentPage('video') },
    { id: 'history', label: 'Riwayat', icon: <ClockIcon />, action: () => setCurrentPage('history') },
    { id: 'settings', label: 'Pengaturan', icon: <CogIcon />, action: onSettingsClick },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 z-20">
      <ul className="flex justify-around items-center h-16">
        {navItems.map((item) => (
          <li key={item.id} className="flex-1">
            <button
              onClick={item.action}
              className={`w-full h-full flex flex-col items-center justify-center gap-1 transition-colors ${
                currentPage === item.id ? 'text-indigo-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              {React.cloneElement(item.icon, { className: 'w-6 h-6' })}
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default BottomNav;