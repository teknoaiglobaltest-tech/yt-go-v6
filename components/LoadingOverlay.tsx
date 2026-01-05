import React from 'react';
import { SuperAffiliateIcon } from './icons/Icons';

interface LoadingOverlayProps {
  text: string;
  onCancel?: () => void;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ text, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-[999]">
      <div className="loader-container">
        <div className="ring"></div>
        <div className="ring"></div>
        <div className="ring"></div>
        <div className="absolute icon-pulse">
            <SuperAffiliateIcon className="w-12 h-12" />
        </div>
      </div>
      
      <p className="mt-8 text-xl font-semibold text-white tracking-wider animate-pulse">{text}</p>
      
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-6 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg shadow-lg transition-transform transform hover:scale-105"
        >
          Hentikan Proses
        </button>
      )}
    </div>
  );
};

export default LoadingOverlay;