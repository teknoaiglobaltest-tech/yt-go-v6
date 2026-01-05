import React from 'react';

interface LoaderProps {
  text: string;
  onCancel?: () => void;
}

const Loader: React.FC<LoaderProps> = ({ text, onCancel }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 my-8 p-4 bg-gray-800/50 rounded-lg">
      <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-indigo-400"></div>
      <p className="text-lg font-medium text-gray-300">{text}</p>
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-4 rounded-lg text-sm transition-colors"
        >
          Hentikan
        </button>
      )}
    </div>
  );
};

export default Loader;