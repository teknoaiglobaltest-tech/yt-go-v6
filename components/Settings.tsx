
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { dbService } from '../services/db';
import { getChutesServers, fetchChutesServers } from '../services/chutesKeyService';
import Card from './Card';
import { AuthContext, AuthContextType } from '../contexts/AuthContext';

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
    const { token, refreshToken } = useContext(AuthContext) as AuthContextType;
    const [chutesServers, setChutesServers] = useState<{id: number, name: string}[]>([]);
    const [activeChutesServerId, setActiveChutesServerId] = useState<number | null>(null);
    const [isLoadingChutes, setIsLoadingChutes] = useState(true);
    const [refreshStatus, setRefreshStatus] = useState('');
    const [serverRefreshStatus, setServerRefreshStatus] = useState('');


    const loadChutesSettings = useCallback(async (forceRefresh = false) => {
        setIsLoadingChutes(true);
        if (forceRefresh) {
             setServerRefreshStatus('Memperbarui server...');
        }
        try {
            // Jika forceRefresh true, panggil fetchChutesServers langsung untuk update cache.
            // Jika false, getChutesServers akan menggunakan cache jika ada.
            let servers;
            if (forceRefresh) {
                const fullServers = await fetchChutesServers();
                servers = fullServers.map(({id, name}) => ({id, name}));
                 setServerRefreshStatus('Server diperbarui!');
            } else {
                servers = await getChutesServers();
            }

            setChutesServers(servers);
            const activeServerSetting = await dbService.getSetting('activeChutesServerId');
            
            // Set default ke server terakhir jika belum ada setting
            const defaultServer = servers.length > 0 ? servers[servers.length - 1].id : null;
            setActiveChutesServerId(activeServerSetting?.value as number ?? defaultServer);

        } catch (error) {
            console.error("Failed to load server settings:", error);
            if (forceRefresh) setServerRefreshStatus('Gagal memperbarui server.');
        } finally {
            setIsLoadingChutes(false);
            if (forceRefresh) setTimeout(() => setServerRefreshStatus(''), 3000);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadChutesSettings();
        }
    }, [isOpen, loadChutesSettings]);
    
    const handleSetChutesServer = async (id: number | null) => {
        try {
            await dbService.addSetting({ key: 'activeChutesServerId', value: id });
            setActiveChutesServerId(id);
        } catch (error) {
            console.error("Failed to set active server:", error);
        }
    };

    const handleRefreshToken = async () => {
        setRefreshStatus('Memperbarui token...');
        try {
            await refreshToken();
            setRefreshStatus('Token berhasil diperbarui!');
        } catch (e: any) {
            setRefreshStatus(`Gagal: ${e.message}`);
        } finally {
            setTimeout(() => setRefreshStatus(''), 3000);
        }
    };

    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <Card className="w-full max-w-md max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-indigo-400">Pengaturan</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl">&times;</button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-4 space-y-4">
                     <div>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-semibold text-gray-300 text-lg">Pilih Server Video</h3>
                             <button 
                                onClick={() => loadChutesSettings(true)} 
                                className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded transition-colors"
                                disabled={!!serverRefreshStatus}
                            >
                                {serverRefreshStatus || 'Refresh Server'}
                            </button>
                        </div>
                        <p className="text-sm text-gray-400 mb-3">Pilih server yang akan digunakan untuk membuat video. Jika satu server sibuk, coba ganti ke server lain.</p>
                        {isLoadingChutes ? <p className="text-gray-500 text-center py-4">Memuat server...</p> : (
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {chutesServers.length > 0 ? chutesServers.map(server => (
                                    <label key={server.id} className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${activeChutesServerId === server.id ? 'bg-indigo-900/30 border border-indigo-500/50' : 'bg-gray-900/50 hover:bg-gray-700 border border-transparent'}`}>
                                        <input
                                            type="radio"
                                            name="video-server"
                                            value={server.id}
                                            checked={activeChutesServerId === server.id}
                                            onChange={() => handleSetChutesServer(server.id)}
                                            className="w-4 h-4 text-indigo-500 bg-gray-800 border-gray-600 focus:ring-indigo-600 ring-offset-gray-900"
                                        />
                                        <span className="ml-3 font-medium text-sm text-gray-200">{server.name}</span>
                                    </label>
                                )) : (
                                    <p className="text-red-400 text-sm">Gagal memuat daftar server.</p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-gray-700">
                        <h3 className="font-semibold text-gray-300 text-lg">Otentikasi Token</h3>
                        <p className="text-sm text-gray-400">Kelola token API untuk layanan generate gambar.</p>
                        <div className="mt-2 p-3 bg-gray-900/50 rounded-lg">
                            <p className="text-sm text-gray-400">Token Saat Ini:</p>
                            <p className="text-xs text-indigo-300 break-all font-mono">
                                {token ? `${token.substring(0, 8)}...${token.substring(token.length - 4)}` : 'Tidak ada token'}
                            </p>
                            <button
                                onClick={handleRefreshToken}
                                disabled={!!refreshStatus && refreshStatus.includes('Memperbarui')}
                                className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors disabled:bg-gray-600"
                            >
                                {refreshStatus.includes('Memperbarui') ? 'Memperbarui...' : 'Perbarui Token'}
                            </button>
                            {refreshStatus && <p className="text-xs text-center mt-2 text-gray-400">{refreshStatus}</p>}
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default SettingsModal;
