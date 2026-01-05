import React, { useState } from 'react';
import { SeoContent } from '../types';
import { ClipboardIcon, CheckIcon } from './icons/Icons';
import Card from './Card';

interface SeoDisplayProps {
    content: SeoContent;
}

type Platform = 'tiktok' | 'shopee' | 'reels_youtube' | 'facebook_pro' | 'whatsapp';

const platformNames: Record<Platform, string> = {
    tiktok: 'TikTok',
    shopee: 'Shopee Video',
    reels_youtube: 'Reels & Shorts',
    facebook_pro: 'Facebook Pro',
    whatsapp: 'WhatsApp',
};

const AccordionItem: React.FC<{
    title: string;
    isOpen: boolean;
    onClick: () => void;
    platform: Platform;
    content: SeoContent[Platform];
}> = ({ title, isOpen, onClick, platform, content }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCombinedCopy = (e: React.MouseEvent) => {
        e.stopPropagation(); // Mencegah akordion terbuka/tertutup saat menyalin
        const combinedText = `${content.deskripsi}\n\n${content.tagar}`;
        navigator.clipboard.writeText(combinedText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <div className="border border-gray-700 rounded-lg overflow-hidden">
            <div className="flex justify-between items-center p-3 bg-gray-800 hover:bg-gray-700">
                <button
                    onClick={onClick}
                    className="flex-grow flex items-center justify-between text-left focus:outline-none"
                >
                    <span className="font-semibold text-gray-200">{title}</span>
                    <svg className={`w-5 h-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                <button onClick={handleCombinedCopy} className="ml-4 flex items-center gap-1 text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded shrink-0">
                    {isCopied ? <CheckIcon className="w-3 h-3 text-green-400" /> : <ClipboardIcon className="w-3 h-3" />}
                    {isCopied ? 'Disalin' : 'Salin'}
                </button>
            </div>
            {isOpen && (
                <div className="p-4 bg-gray-900/50 space-y-3">
                    <div>
                        <h4 className="font-semibold text-sm text-gray-400 mb-1">Deskripsi</h4>
                        <p className="text-gray-200 text-sm whitespace-pre-wrap">{content.deskripsi}</p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-sm text-gray-400 mb-1">{platform === 'whatsapp' ? 'CTA/Link' : 'Tagar'}</h4>
                        <p className="text-indigo-300 text-sm break-words">{content.tagar}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const SeoDisplay: React.FC<SeoDisplayProps> = ({ content }) => {
    const [openAccordion, setOpenAccordion] = useState<Platform | null>(null);
    const [isTitleCopied, setIsTitleCopied] = useState(false);

    const toggleAccordion = (platform: Platform) => {
        setOpenAccordion(openAccordion === platform ? null : platform);
    };

    const handleCopyTitle = () => {
        navigator.clipboard.writeText(content.judul_clickbait);
        setIsTitleCopied(true);
        setTimeout(() => setIsTitleCopied(false), 2000);
    };

    return (
        <Card className="p-4 sm:p-6 mt-4 bg-gray-900/50">
            <h3 className="text-xl font-bold text-green-400 mb-4">Judul, Deskripsi & Tagar</h3>
            
            <div className="mb-4 relative bg-gray-800 p-3 rounded-lg border border-gray-700 flex justify-between items-start gap-4">
                <div>
                    <h4 className="font-semibold text-sm text-gray-400 mb-1">Judul Clickbait (Semua Platform)</h4>
                    <p className="text-gray-200">{content.judul_clickbait}</p>
                </div>
                <button onClick={handleCopyTitle} className="flex items-center gap-1 text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded shrink-0">
                    {isTitleCopied ? <CheckIcon className="w-3 h-3 text-green-400" /> : <ClipboardIcon className="w-3 h-3" />}
                    {isTitleCopied ? 'Disalin' : 'Salin'}
                </button>
            </div>

            <div className="space-y-2">
                {Object.keys(platformNames).map((p) => (
                    <AccordionItem
                        key={p}
                        title={platformNames[p as Platform]}
                        isOpen={openAccordion === p}
                        onClick={() => toggleAccordion(p as Platform)}
                        platform={p as Platform}
                        content={content[p as Platform]}
                    />
                ))}
            </div>
        </Card>
    );
};

export default SeoDisplay;