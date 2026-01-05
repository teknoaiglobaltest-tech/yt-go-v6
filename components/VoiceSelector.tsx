import React, { useState, useRef } from 'react';

interface Voice {
    name: string;
    description: string;
}

interface VoiceSelectorProps {
    voices: Voice[];
    selectedVoice: string;
    onSelectVoice: (voiceName: string) => void;
}

const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
    </svg>
);

const PauseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);


const VoiceSelector: React.FC<VoiceSelectorProps> = ({ voices, selectedVoice, onSelectVoice }) => {
    const [playingVoice, setPlayingVoice] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const playPreview = (voiceName: string) => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.onended = () => setPlayingVoice(null);
        }
        
        const audio = audioRef.current;

        if (playingVoice === voiceName) {
            audio.pause();
            setPlayingVoice(null);
        } else {
            audio.src = `https://www.gstatic.com/aistudio/voices/samples/${voiceName}.wav`;
            audio.play().catch(e => console.error("Audio playback failed:", e));
            setPlayingVoice(voiceName);
        }
    };

    return (
        <div className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 max-h-48 overflow-y-auto">
            {voices.map(voice => (
                <div
                    key={voice.name}
                    onClick={() => onSelectVoice(voice.name)}
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${selectedVoice === voice.name ? 'bg-indigo-600' : 'hover:bg-gray-600'}`}
                >
                    <div className="flex items-center">
                        <input
                            type="radio"
                            name="voice-selection"
                            checked={selectedVoice === voice.name}
                            onChange={() => onSelectVoice(voice.name)}
                            className="w-4 h-4 text-indigo-500 bg-gray-800 border-gray-600 focus:ring-indigo-600"
                        />
                        <div className="ml-3">
                            <p className="text-sm font-medium">{voice.name}</p>
                            <p className="text-xs text-gray-400">{voice.description}</p>
                        </div>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            playPreview(voice.name);
                        }}
                        className="p-1 rounded-full text-gray-300 hover:text-white hover:bg-gray-500 transition-colors"
                        aria-label={`Play preview for ${voice.name}`}
                    >
                        {playingVoice === voice.name ? <PauseIcon /> : <PlayIcon />}
                    </button>
                </div>
            ))}
        </div>
    );
};

export default VoiceSelector;
