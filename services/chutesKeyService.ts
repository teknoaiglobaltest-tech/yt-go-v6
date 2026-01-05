
import { dbService } from './db';

export interface ChutesServer {
    id: number;
    name: string;
    key: string;
}

let cachedServers: ChutesServer[] = [];

// Fallback server in case fetching fails entirely initially
const DEFAULT_FALLBACK_KEY = 'cpk_d0ede59ceda74784a88628fe012845e4.0dce1b81fd69535fbda051012064a30e.KBX3uunfQNB3LPqGbiZrKFBSDTu753ln';

export const fetchChutesServers = async (): Promise<ChutesServer[]> => {
    try {
        const response = await fetch(`https://duniakreator.my.id/api.txt?cb=${Date.now()}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch server list: ${response.status}`);
        }
        const text = await response.text();
        
        // Pisahkan berdasarkan spasi atau baris baru (whitespace apa pun) dan filter string kosong
        const keys = text.split(/\s+/).filter(k => k.trim().length > 0);

        if (keys.length === 0) {
            console.warn("Fetched server list is empty.");
            // Jika cache sudah ada, gunakan itu. Jika tidak, return kosong.
            return cachedServers; 
        }

        cachedServers = keys.map((key, index) => ({
            id: index + 1,
            name: `Server ${index + 1}`,
            key: key.trim()
        }));

        console.log(`Loaded ${cachedServers.length} video servers.`);
        return cachedServers;

    } catch (error) {
        console.error("Error fetching chutes servers:", error);
        // Kembalikan server yang sudah ada di cache jika fetch gagal
        return cachedServers;
    }
};

export const getChutesServers = async (): Promise<{id: number, name: string}[]> => {
    if (cachedServers.length === 0) {
        await fetchChutesServers();
    }
    return cachedServers.map(({id, name}) => ({id, name}));
};

export const fetchWithChutesFallbacks = async (
    url: string,
    options: RequestInit,
    onRetry?: (attempt: number, maxRetries: number, serverName: string) => void,
    signal?: AbortSignal,
    retriesPerKey = 3,
    initialDelay = 2000
): Promise<Response> => {
    let servers = cachedServers;
    if (servers.length === 0) {
        servers = await fetchChutesServers();
    }
    if (servers.length === 0) {
        console.warn("No Chutes servers configured, using default fallback key.");
        servers = [{ id: 0, name: "Fallback", key: DEFAULT_FALLBACK_KEY }];
    }

    const activeServerSetting = await dbService.getSetting('activeChutesServerId');
    const activeId = activeServerSetting?.value as number | undefined;

    // Sort servers to prioritize the active one, then the rest
    const sortedServers = [...servers].sort((a, b) => {
        if (a.id === activeId) return -1;
        if (b.id === activeId) return 1;
        return a.id - b.id; // stable sort
    });

    let lastError: Error | null = null;

    for (const server of sortedServers) {
        const currentOptions = {
            ...(signal ? { ...options, signal } : options),
            headers: {
                ...(options.headers || {}),
                'Authorization': `Bearer ${server.key}`,
            },
        };

        for (let attempt = 0; attempt < retriesPerKey; attempt++) {
            if (signal?.aborted) {
                throw new DOMException('Request aborted by user.', 'AbortError');
            }
            try {
                console.log(`Trying Chutes API on ${server.name} (Attempt ${attempt + 1}/${retriesPerKey})`);
                const response = await fetch(url, currentOptions);

                if (response.ok) {
                    if (server.id !== activeId) {
                        console.log(`Switching active Chutes server to: ${server.name}`);
                        await dbService.addSetting({ key: 'activeChutesServerId', value: server.id });
                    }
                    return response;
                }

                // Don't retry client errors on the same key, move to next server
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    const errorText = await response.text();
                    lastError = new Error(`Chutes API client error on ${server.name}: ${response.status} - ${errorText}`);
                    break; // break inner loop to try next server
                }
                
                // Retry on server errors (5xx) or rate limits (429)
                lastError = new Error(`Chutes API server error on ${server.name}: ${response.status}.`);
                onRetry?.(attempt + 1, retriesPerKey, server.name);

            } catch (error) {
                lastError = error as Error;
                if (error instanceof DOMException && error.name === 'AbortError') throw error;
            }

            if (attempt < retriesPerKey - 1) {
                const delay = initialDelay * Math.pow(2, attempt);
                await new Promise(res => setTimeout(res, delay));
            }
        }
    }

    throw lastError || new Error("All Chutes servers failed after all retries.");
};
