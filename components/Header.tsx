import React from 'react';
import { MenuIcon, SuperAffiliateIcon } from './icons/Icons';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  return (
    <header className="md:hidden bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="p-2 rounded-md hover:bg-gray-700">
          <MenuIcon className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <SuperAffiliateIcon className="w-7 h-7" />
          <span className="text-xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500">Youtube Go</span>
        </div>
      </div>
    </header>
  );
};

export default Header;