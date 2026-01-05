import React, { useMemo, useEffect, useState } from 'react';
import { HistoryItem } from '../../types/autostory';
import { DownloadIcon } from './icons/DownloadIcon';
import { TrashIcon } from './icons/TrashIcon';
import { FilmIcon } from './icons/FilmIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';

interface HistoryViewProps {
    history: HistoryItem[];
    onDeleteSession: (sessionId: number) => void;
    t: (key: string, params?: { [key: string]: string | number }) => string;
}

type Session = {
    sessionId: number;
    timestamp: number;
    items: HistoryItem[];
    thumbnailUrl?: string;
    thumbnailType: 'video' | 'image';
    sceneCount: number;
};

const groupHistoryBySession = (history: HistoryItem[]): Session[] => {
    const sessionsMap = new Map<number, HistoryItem[]>();
    history.forEach(item => {
        if (!sessionsMap.has(item.sessionId)) {
            sessionsMap.set(item.sessionId, []);
        }
        sessionsMap.get(item.sessionId)!.push(item);
    });

    return Array.from(sessionsMap.entries())
        .map(([sessionId, items]) => {
            const sortedItems = items.sort((a, b) => a.timestamp - b.timestamp);
            const firstSceneItem = sortedItems.find(i => i.type === 'scene');

            let thumbnailUrl: string | undefined;
            let thumbnailType: 'video' | 'image' = 'image';

            if (firstSceneItem) {
                thumbnailUrl = URL.createObjectURL(firstSceneItem.videoBlob);
                thumbnailType = 'video';
            } else {
                const storyItem = sortedItems.find(i => i.type === 'story');
                if (storyItem) {
                    thumbnailUrl = URL.createObjectURL(storyItem.videoBlob);
                    thumbnailType = 'video';
                } else if (sortedItems[0]?.referenceImageBlob) {
                    thumbnailUrl = URL.createObjectURL(sortedItems[0].referenceImageBlob);
                } else if (sortedItems[0]?.videoBlob) {
                    thumbnailUrl = URL.createObjectURL(sortedItems[0].videoBlob);
                    thumbnailType = 'video';
                }
            }


            return {
                sessionId,
                items: sortedItems,
                timestamp: sortedItems[0].timestamp,
                thumbnailUrl,
                thumbnailType,
                sceneCount: items.filter(i => i.type === 'scene').length,
            };
        })
        .sort((a, b) => b.timestamp - a.timestamp);
};

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onDeleteSession, t }) => {
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const sessions = useMemo(() => groupHistoryBySession(history), [history]);

    useEffect(() => {
        return () => {
            sessions.forEach(session => {
                if (session.thumbnailUrl) {
                    URL.revokeObjectURL(session.thumbnailUrl);
                }
            });
        };
    }, [sessions]);

    if (!selectedSession) {
        if (history.length === 0) {
            return (
                 <div className="flex items-center justify-center h-full">
                     <div className="text-center p-8 bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-xl">
                        <p className="text-slate-400">{t('historyEmpty')}</p>
                     </div>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {sessions.map(session => (
                    <div key={session.sessionId} className="bg-slate-900/70 backdrop-blur-sm border border-purple-500/30 rounded-xl flex flex-col group">
                        <div className="w-full aspect-video bg-black rounded-t-xl overflow-hidden relative">
                           {session.thumbnailUrl && session.thumbnailType === 'video' ? (
                                <video 
                                    src={session.thumbnailUrl} 
                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                    muted 
                                    loop
                                    preload="metadata"
                                    onMouseEnter={e => e.currentTarget.play().catch(console.error)}
                                    onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                />
                            ) : (
                                <img src={session.thumbnailUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Session thumbnail" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                            <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                                <FilmIcon className="w-3 h-3" />
                                <span>{t('historyScenes', {count: session.sceneCount})}</span>
                            </div>
                        </div>
                        <div className="p-4 flex-1 flex flex-col justify-between">
                            <div>
                                <h3 className="font-bold text-slate-200">{t('historySessionTitle', {timestamp: new Date(session.timestamp).toLocaleString()})}</h3>
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                                <button onClick={() => setSelectedSession(session)} className="flex-1 bg-purple-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-purple-700 transition-colors text-sm">
                                    {t('viewSession')}
                                </button>
                                <button 
                                    onClick={() => onDeleteSession(session.sessionId)}
                                    className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                    title={t('delete')}
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }
    
    return <SessionDetailView session={selectedSession} onBack={() => setSelectedSession(null)} t={t} />;
};


const SessionDetailView: React.FC<{session: Session, onBack: () => void, t: (key: string, params?: { [key: string]: string | number }) => string}> = ({ session, onBack, t }) => {
    const [itemUrls, setItemUrls] = useState<Map<number, string>>(new Map());

    useEffect(() => {
        const urlMap = new Map<number, string>();
        session.items.forEach(item => {
            if (item.id) {
                urlMap.set(item.id, URL.createObjectURL(item.videoBlob));
            }
        });
        setItemUrls(urlMap);

        return () => {
            urlMap.forEach(url => URL.revokeObjectURL(url));
        };
    }, [session]);
    
    const storyVideo = session.items.find(item => item.type === 'story');
    const sceneVideos = session.items.filter(item => item.type === 'scene');

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                 <button onClick={onBack} className="flex items-center gap-2 bg-slate-700/50 hover:bg-slate-700/80 px-4 py-2 rounded-lg transition-colors">
                    <ArrowLeftIcon className="w-5 h-5" />
                </button>
                <h2 className="text-2xl font-bold">{t('sessionDetails')}</h2>
            </div>

            {storyVideo && storyVideo.id && (
                <div className="bg-slate-900/70 backdrop-blur-sm border border-purple-500/30 rounded-xl p-4">
                     <h3 className="text-lg font-bold text-indigo-400 mb-3">{t('combinedStoryVideo')}</h3>
                     <video src={itemUrls.get(storyVideo.id)} controls playsInline className="w-full aspect-video bg-black rounded-md" />
                      <a 
                        href={itemUrls.get(storyVideo.id)} 
                        download={`video-story-${session.sessionId}.webm`}
                        className="w-full mt-3 flex items-center justify-center gap-2 bg-cyan-600 text-white font-bold py-2 px-3 rounded-lg hover:bg-cyan-700 transition-colors"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        {t('download')}
                    </a>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {sceneVideos.map((item, index) => (
                    item.id && (
                         <div key={item.id} className="bg-slate-900/70 backdrop-blur-sm border border-purple-500/30 rounded-xl p-4 flex flex-col gap-3">
                            <h4 className="font-bold text-purple-400">{t('expandVideoScene', {count: index + 1})}</h4>
                            <video 
                                src={itemUrls.get(item.id)} 
                                controls 
                                loop
                                playsInline
                                className="w-full h-full object-contain aspect-video bg-black rounded-md" 
                            />
                            <p className="text-sm text-slate-300 bg-black/20 p-2 rounded-md break-words">
                                {item.prompt}
                            </p>
                        </div>
                    )
                 ))}
            </div>
        </div>
    );
}
