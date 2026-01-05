import React, { useState, useEffect, useRef } from 'react';
import { Spinner } from './Spinner';
import { ImageIcon } from './icons/ImageIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { VideoIcon } from './icons/VideoIcon';

const FrameSelectorModal: React.FC<{videoUrl: string, onClose: () => void, onSelect: (blob: Blob) => void, t: (key: string) => string}> = ({ videoUrl, onClose, onSelect, t }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleSelect = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            video.pause();
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => {
                if (blob) {
                    onSelect(blob);
                    onClose();
                }
            }, 'image/jpeg');
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-800 border border-purple-500/30 rounded-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-base font-bold p-3 border-b border-slate-700">{t('expandVideoFrameSelectorTitle')}</h3>
                <div className="p-3 space-y-3">
                     <video 
                         ref={videoRef} 
                         src={videoUrl} 
                         className="w-full aspect-video object-contain bg-black rounded-md"
                         controls
                         playsInline
                     />
                    <p className="text-sm text-center text-slate-400">{t('expandVideoFrameSelectorInstructions')}</p>
                </div>
                <div className="p-3 border-t border-slate-700 flex justify-end gap-2">
                    <button onClick={onClose} className="bg-slate-600 hover:bg-slate-500 py-1.5 px-3 rounded-md text-sm">{t('cancel')}</button>
                    <button onClick={handleSelect} className="bg-purple-600 hover:bg-purple-700 text-white py-1.5 px-3 rounded-md text-sm">{t('expandVideoSelectFrame')}</button>
                </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};


interface ManualStoryFormProps {
  onBack: () => void;
  onStart: (params: {
      initialImageBlob: Blob;
      quality: '480p' | '720p';
      duration: '5s' | '8s';
  }) => void;
  t: (key: string, params?: { [key: string]: string | number }) => string;
}

export const ManualStoryForm: React.FC<ManualStoryFormProps> = ({ onBack, onStart, t }) => {
    const [quality, setQuality] = useState<'480p' | '720p'>('480p');
    const [duration, setDuration] = useState<'5s' | '8s'>('8s');
    const [mediaFile, setMediaFile] = useState<{ file: File; url: string; type: 'image' | 'video' } | null>(null);
    const [selectedFrame, setSelectedFrame] = useState<{ blob: Blob; url: string } | null>(null);
    const [isFrameSelectorOpen, setIsFrameSelectorOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            if (mediaFile) URL.revokeObjectURL(mediaFile.url);
            if (selectedFrame) URL.revokeObjectURL(selectedFrame.url);
        };
    }, [mediaFile, selectedFrame]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (mediaFile) URL.revokeObjectURL(mediaFile.url);
        if (selectedFrame) URL.revokeObjectURL(selectedFrame.url);
        setMediaFile(null);
        setSelectedFrame(null);
        setError(null);

        const url = URL.createObjectURL(file);
        if (file.type.startsWith('image/')) {
            setMediaFile({ file, url, type: 'image' });
            setSelectedFrame({ blob: file, url }); // For images, the file itself is the "frame"
        } else if (file.type.startsWith('video/')) {
            setMediaFile({ file, url, type: 'video' });
            setIsFrameSelectorOpen(true);
        } else {
            setError(t('expandVideoErrorInvalidFile'));
            URL.revokeObjectURL(url);
        }
        e.target.value = '';
    };

    const handleFrameSelected = (blob: Blob) => {
        if (selectedFrame) URL.revokeObjectURL(selectedFrame.url);
        setSelectedFrame({ blob, url: URL.createObjectURL(blob) });
    };
    
    const handleStartStory = () => {
        if (selectedFrame) {
            onStart({
                initialImageBlob: selectedFrame.blob,
                quality,
                duration
            });
        }
    };
    
    const selectStyles = {
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 0.5rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '1.5em 1.5em',
    };
    
    return (
        <div className="h-full w-full flex flex-col items-center justify-start md:justify-center p-0 md:p-4">
            <div className="bg-slate-900 md:border md:border-purple-500/30 md:rounded-xl w-full max-w-2xl flex flex-col h-full md:h-auto md:max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-slate-700 flex-shrink-0">
                    <button onClick={onBack} className="p-1 rounded-full hover:bg-slate-700">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <h3 className="text-lg font-bold">Mulai Cerita Manual</h3>
                    <div className="w-8"></div>
                </div>
                <div className="flex-grow overflow-y-auto">
                    <div className="p-4 space-y-4">
                        {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-lg text-sm">{error}</p>}
                        
                        <label className="font-medium text-slate-300 block">1. Unggah Media Awal</label>
                        <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-video flex flex-col items-center justify-center bg-slate-700/30 hover:bg-slate-700/50 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 transition-colors cursor-pointer relative overflow-hidden">
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
                            {selectedFrame ? (
                                <img src={selectedFrame.url} alt="Selected frame preview" className="absolute inset-0 w-full h-full object-contain p-1" />
                            ) : mediaFile?.type === 'video' ? (
                                 <div className="text-center">
                                    <VideoIcon className="w-12 h-12 mb-2" />
                                    <span className="font-semibold text-sm">Video Diunggah</span>
                                    <button onClick={(e) => { e.stopPropagation(); setIsFrameSelectorOpen(true); }} className="mt-2 bg-purple-600 hover:bg-purple-700 text-white py-1.5 px-3 rounded-md text-sm">Pilih Frame</button>
                                 </div>
                            ) : (
                                 <div className="text-center">
                                    <ImageIcon className="w-12 h-12 mb-2" />
                                    <span className="font-semibold text-sm">Klik untuk mengunggah Gambar/Video</span>
                                 </div>
                            )}
                        </div>
                        
                        <label className="font-medium text-slate-300 block pt-4">2. Atur Pengaturan Video</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="quality-select" className="font-medium text-slate-400 block mb-1.5 text-sm">Kualitas Video</label>
                                <select id="quality-select" value={quality} onChange={e => setQuality(e.target.value as '480p' | '720p')} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 pr-10 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none appearance-none" style={selectStyles}>
                                    <option value="480p">480p (Cepat)</option>
                                    <option value="720p">720p (Kualitas Tinggi)</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="duration-select" className="font-medium text-slate-400 block mb-1.5 text-sm">Durasi per Adegan</label>
                                <select id="duration-select" value={duration} onChange={e => setDuration(e.target.value as '5s' | '8s')} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 pr-10 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none appearance-none" style={selectStyles}>
                                    <option value="5s">~5 detik</option>
                                    <option value="8s">~8 detik</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-700 flex-shrink-0">
                     <button onClick={handleStartStory} disabled={!selectedFrame} className="w-full bg-cyan-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-cyan-700 disabled:bg-slate-800 disabled:text-slate-500 flex items-center justify-center gap-2 transition-colors">
                        Mulai Cerita
                    </button>
                </div>
            </div>
            {isFrameSelectorOpen && mediaFile?.type === 'video' && (
                <FrameSelectorModal 
                    videoUrl={mediaFile.url} 
                    onClose={() => setIsFrameSelectorOpen(false)}
                    onSelect={handleFrameSelected}
                    t={t}
                />
            )}
        </div>
    );
};