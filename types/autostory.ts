export enum Mode {
    ExpandVideo = 'ExpandVideo',
}

// Old HistoryItem from state, no longer the primary type.
export interface LegacyHistoryItem {
    id?: number;
    timestamp: number;
    mode: Mode;
    prompt: string;
    expandVideoOutput?: {
        scenes: {
            prompt: string;
            videoBlob: Blob;
            referenceImageBlob: Blob;
        }[];
    };
}

// New HistoryItem type for IndexedDB
export interface HistoryItem {
    id?: number; // Auto-incremented by IndexedDB
    sessionId: number; // Groups scenes and story into one session
    timestamp: number;
    type: 'scene' | 'story';
    prompt?: string; // For scenes
    videoBlob: Blob;
    referenceImageBlob?: Blob; // For scenes
}
