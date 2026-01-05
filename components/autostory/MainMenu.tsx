import React, { useRef } from 'react';
import { VideoIcon } from './icons/VideoIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { ClockIcon } from './icons/ClockIcon';
import { PlusIcon } from './icons/PlusIcon';

interface MainMenuProps {
    t: (key: string, params?: { [key: string]: string | number }) => string;
    onManualStoryClick: () => void;
    onAutoStoryClick: () => void;
    onHistoryClick: () => void;
}

const MenuCard: React.FC<{title: string, description: string, icon: React.ReactNode, onClick: () => void}> = ({title, description, icon, onClick}) => (
    <div 
        onClick={onClick}
        className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 text-center cursor-pointer transition-all duration-300 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1 flex flex-col items-center justify-center"
    >
        <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 mb-4 flex items-center justify-center bg-slate-700 text-purple-400 rounded-full flex-shrink-0">
            {icon}
        </div>
        <h2 className="text-base sm:text-xl font-bold text-slate-100">{title}</h2>
        <p className="text-slate-400 text-xs sm:text-sm mt-2">{description}</p>
    </div>
)

export const MainMenu: React.FC<MainMenuProps> = ({ t, onManualStoryClick, onAutoStoryClick, onHistoryClick }) => {
    return (
        <div className="h-full w-full flex flex-col items-center justify-start text-center p-4 sm:p-8 pt-12 overflow-y-auto pb-24">
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">Pilih Mode Pembuatan Cerita</h1>
            <p className="text-slate-400 mb-8 max-w-xl">Pilih antara kontrol manual penuh atau biarkan AI membuatkan cerita untuk Anda.</p>
            
            <div className="grid grid-cols-2 gap-4 md:gap-6 max-w-3xl w-full">
                <MenuCard 
                    title="Manual Story"
                    description="Kontrol penuh adegan per adegan. Unggah media Anda sendiri atau buat dengan AI."
                    icon={<PlusIcon className="w-8 h-8"/>}
                    onClick={onManualStoryClick}
                />
                 <MenuCard 
                    title="Auto Story"
                    description="Biarkan AI membuat seluruh cerita, karakter, dan adegan dari ide Anda."
                    icon={<SparklesIcon className="w-8 h-8"/>}
                    onClick={onAutoStoryClick}
                />
            </div>
            
             <button
                onClick={onHistoryClick}
                className="mt-8 bg-slate-800/50 text-slate-300 font-bold py-3 px-8 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 text-lg"
            >
                <ClockIcon className="w-6 h-6" />
                {t('historyButton')}
            </button>
        </div>
    );
};