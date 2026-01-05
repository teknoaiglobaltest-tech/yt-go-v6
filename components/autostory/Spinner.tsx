import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-16 h-16 border-8',
  };

  return (
    <div className="flex justify-center items-center">
      <div className={`${sizeClasses[size]} border-purple-500 border-t-transparent rounded-full animate-spin`}></div>
    </div>
  );
};
