import React, { useState, useRef, useEffect } from 'react';
import * as ttsService from '../services/gemini/ttsService';
import { dbService } from '../services/db';
import { TTSHistoryItem } from '../types';
import Card from './Card';
import Loader from './Loader';
import { DownloadIcon } from './icons/Icons';
import VoiceSelector from './VoiceSelector';

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createWavBlob(decodedPcmData: Uint8Array, sampleRate: number, numChannels: number): Blob {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const dataSize = decodedPcmData.length;
    const bitsPerSample = 16;
    const blockAlign = numChannels * (bitsPerSample / 8);

    function writeString(view: DataView, offset: number, str: string) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    return new Blob([view, decodedPcmData], { type: 'audio/wav' });
}

const FEMALE_VOICES = [
    { name: 'Zephyr', description: 'Cerah, bersemangat, ringan' },
    { name: 'Kore', description: 'Tegas, profesional, percaya diri' },
    { name: 'Leda', description: 'Muda, segar, lincah' },
    { name: 'Aoede', description: 'Ringan, santai, mengalir alami' },
    { name: 'Callirrhoe', description: 'Tenang, rileks, ramah' },
    { name: 'Autonoe', description: 'Cerah, hangat, optimis' },
    { name: 'Despina', description: 'Halus, elegan, profesional' },
    { name: 'Erinome', description: 'Jernih, ringan, mudah dipahami' },
    { name: 'Laomedeia', description: 'Ceria, optimis, positif' },
    { name: 'Achernar', description: 'Lembut, sopan, bersahabat' },
    { name: 'Gacrux', description: 'Dewasa, tenang, berwawa' },
    { name: 'Sulafat', description: 'Hangat, ramah, empatik' }
];

const MALE_VOICES = [
    { name: 'Puck', description: 'Ceria, energik, positif' },
    { name: 'Charon', description: 'Informatif, jelas, profesional' },
    { name: 'Fenrir', description: 'Antusias, ekspresif, penuh energi' },
    { name: 'Orus', description: 'Tegas, mantap, authoritative' },
    { name: 'Enceladus', description: 'Lembut, natural, bernapas' },
    { name: 'Iapetus', description: 'Jernih, tegas, fokus' },
    { name: 'Umbriel', description: 'Santai, ramah, fleksibel' },
    { name: 'Algieba', description: 'Halus, elegan, berkelas' },
    { name: 'Algenib', description: 'Berat, berkarakter, unik' },
    { name: 'Rasalgethi', description: 'Informatif, netral, terstruktur' },
    { name: 'Alnilam', description: 'Tegas, profesional, kuat' },
    { name: 'Schedar', description: 'Seimbang, natural, stabil' },
    { name: 'Pulcherrima', description: 'Tegas, fokus, dominan' },
    { name: 'Achird', description: 'Ramah, bersahabat, ringan' },
    { name: 'Zubenelgenubi', description: 'Santai, informal, natural' },
    { name: 'Vindemiatrix', description: 'Lembut, tenang, penuh empati' },
    { name: 'Sadachbia', description: 'Ceria, hidup, enerjik' },
    { name: 'Sadaltager', description: 'Pintar, tenang, seperti mentor' }
];

const SAMPLE_RATE = 24000;
const NUM_CHANNELS = 1;

const TextToSpeech: React.FC = () => {
    const [text, setText] = useState<string>('Halo! Ubah teks ini menjadi suara untuk iklan video Anda.');
    const [style, setStyle] = useState<string>('');
    const [customStyle, setCustomStyle] = useState<string>('');
    const [language, setLanguage] = useState<string>('Bahasa Indonesia');
    const [customLanguage, setCustomLanguage] = useState<string>('');
    const [gender, setGender] = useState<'Wanita' | 'Pria'>('Wanita');
    const [voice, setVoice] = useState<string>(FEMALE_VOICES[0].name);
    const [speakingRate, setSpeakingRate] = useState<number>(1.0);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [rawAudioData, setRawAudioData] = useState<Uint8Array | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const editDataString = sessionStorage.getItem('ttsEditData');
        if (editDataString) {
            try {
                const item: TTSHistoryItem = JSON.parse(editDataString);
                
                setText(item.text);
                setSpeakingRate(item.speakingRate || 1.0);

                // Determine gender from voice name
                const isMale = MALE_VOICES.some(v => v.name === item.voice);
                setGender(isMale ? 'Pria' : 'Wanita');
                setVoice(item.voice);

                // Determine style
                const predefinedStyles = ['cheerful', 'professional', 'calm', 'energetic', 'sad', 'whispering'];
                if (item.style && predefinedStyles.includes(item.style)) {
                    setStyle(item.style);
                    setCustomStyle('');
                } else if (item.style) { // Custom style
                    setStyle('custom');
                    setCustomStyle(item.style);
                } else { // No style
                    setStyle('');
                    setCustomStyle('');
                }
                
                sessionStorage.removeItem('ttsEditData');
            } catch (e) {
                console.error("Failed to parse TTS edit data from sessionStorage", e);
                sessionStorage.removeItem('ttsEditData'); // Clean up on error
            }
        }
    }, []);

    useEffect(() => {
        // Revoke the old URL when a new one is created or when the component unmounts
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    useEffect(() => {
        // When gender changes, reset the voice to the first one in the new list
        if (gender === 'Wanita') {
            setVoice(FEMALE_VOICES[0].name);
        } else {
            setVoice(MALE_VOICES[0].name);
        }
    }, [gender]);

    const handleGenerate = async () => {
        if (!text) {
            setError('Teks tidak boleh kosong.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setAudioUrl(null);
        setRawAudioData(null);

        const finalStyle = style === 'custom' ? customStyle : style;
        const finalLanguage = language === 'custom' ? customLanguage : language;

        let promptParts = [];
        if (finalLanguage && finalLanguage !== 'Bahasa Indonesia') {
            promptParts.push(`in ${finalLanguage}`);
        }
        if (finalStyle) {
            promptParts.push(`with a ${finalStyle} tone`);
        }
        
        const prefix = promptParts.length > 0 ? `Speak ${promptParts.join(' ')}: ` : '';
        const prompt = `${prefix}${text}`;

        try {
            const audioBase64 = await ttsService.generateSpeech(prompt, voice, speakingRate);
            
            try {
                 const finalEffectiveStyle = style === 'custom' ? customStyle : style;
                 await dbService.addTTSHistoryItem({
                    text,
                    voice,
                    style: finalEffectiveStyle,
                    audioBase64,
                    createdAt: new Date().toISOString(),
                    speakingRate
                });
            } catch (dbError) {
                console.error("Failed to save TTS history:", dbError);
                // Non-critical error, so just log it and continue.
            }
            
            const pcmData = decode(audioBase64);
            setRawAudioData(pcmData);

            const wavBlob = createWavBlob(pcmData, SAMPLE_RATE, NUM_CHANNELS);
            const url = URL.createObjectURL(wavBlob);
            setAudioUrl(url);

        } catch (err: any) {
            setError(err.message || 'Terjadi kesalahan yang tidak diketahui.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDownload = () => {
        if (!rawAudioData) return;
        
        const wavBlob = createWavBlob(rawAudioData, SAMPLE_RATE, NUM_CHANNELS);
        const url = URL.createObjectURL(wavBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `superaffiliate_tts_${Date.now()}.wav`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <header className="text-center">
                <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500">
                    AI Teks ke Suara
                </h1>
                <p className="text-lg text-gray-400 mt-2">Buat sulih suara (voice-over) berkualitas studio untuk iklan Anda dalam hitungan detik.</p>
            </header>

            <Card className="p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Jenis Kelamin Suara</label>
                        <div className="flex justify-center gap-6 bg-gray-700 border border-gray-600 rounded-lg p-2.5">
                            <label className="flex items-center cursor-pointer">
                                <input type="radio" name="gender" value="Wanita" checked={gender === 'Wanita'} onChange={() => setGender('Wanita')} className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-500 focus:ring-indigo-600 ring-offset-gray-800 focus:ring-2"/>
                                <span className="ml-2 text-sm font-medium text-gray-300">Wanita</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                                <input type="radio" name="gender" value="Pria" checked={gender === 'Pria'} onChange={() => setGender('Pria')} className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-500 focus:ring-indigo-600 ring-offset-gray-800 focus:ring-2"/>
                                <span className="ml-2 text-sm font-medium text-gray-300">Pria</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Pilih Suara</label>
                        <VoiceSelector 
                            voices={gender === 'Wanita' ? FEMALE_VOICES : MALE_VOICES}
                            selectedVoice={voice}
                            onSelectVoice={setVoice}
                        />
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="language" className="block text-sm font-medium text-gray-300 mb-2">Bahasa</label>
                        <select id="language" value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                            <option value="Jawa">Jawa</option>
                            <option value="English">Inggris</option>
                            <option value="custom">Isi Sendiri...</option>
                        </select>
                        {language === 'custom' && (
                            <input type="text" id="customLanguage" value={customLanguage} onChange={e => setCustomLanguage(e.target.value)} placeholder="e.g., Sunda, Betawi" className="mt-2 w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-indigo-500 focus:border-indigo-500" />
                        )}
                    </div>
                    <div>
                        <label htmlFor="style" className="block text-sm font-medium text-gray-300 mb-2">Gaya Bicara</label>
                        <select id="style" value={style} onChange={e => setStyle(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="">-- Natural (Tanpa Gaya) --</option>
                            <option value="cheerful">Ceria & Bersemangat</option>
                            <option value="professional">Profesional & Informatif</option>
                            <option value="calm">Tenang & Meyakinkan</option>
                            <option value="energetic">Enerjik & Antusias</option>
                            <option value="sad">Sedih & Empatik</option>
                            <option value="whispering">Berbisik & Intim</option>
                            <option value="custom">Isi Sendiri...</option>
                        </select>
                        {style === 'custom' && (
                            <input type="text" id="customStyle" value={customStyle} onChange={e => setCustomStyle(e.target.value)} placeholder="Gaya kustom (Inggris), e.g., happy" className="mt-2 w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-indigo-500 focus:border-indigo-500" />
                        )}
                    </div>
                </div>
                 <div>
                    <label htmlFor="speakingRate" className="block text-sm font-medium text-gray-300 mb-2">
                        Kecepatan Bicara: <span className="font-semibold text-indigo-400">{speakingRate.toFixed(2)}x</span>
                    </label>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-400">Lambat</span>
                        <input
                            id="speakingRate"
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.05"
                            value={speakingRate}
                            onChange={e => setSpeakingRate(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <span className="text-xs text-gray-400">Cepat</span>
                    </div>
                </div>
                <div>
                    <label htmlFor="tts-text" className="block text-sm font-medium text-gray-300 mb-2">Teks Naskah</label>
                    <textarea
                        id="tts-text"
                        rows={6}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg p-4 text-white focus:ring-indigo-500 focus:border-indigo-500"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Masukkan naskah Anda di sini..."
                    />
                </div>

                <div className="text-center">
                    <button onClick={handleGenerate} disabled={isLoading} className="btn-primary font-bold py-3 px-12 rounded-full shadow-lg text-lg transition-transform transform hover:scale-105 disabled:transform-none disabled:scale-100">
                        {isLoading ? 'Membuat Audio...' : 'Generate & Simpan Audio'}
                    </button>
                </div>
            </Card>

            {isLoading && (
                <div className="flex justify-center">
                     <Loader text="AI sedang mengubah teks menjadi suara..." />
                </div>
            )}
            
            {error && <p className="text-red-400 text-center p-4 bg-red-900/50 rounded-lg">{error}</p>}
            
            {audioUrl && !isLoading && (
                <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4 text-center text-indigo-400">Hasil Audio</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center">
                        <audio ref={audioRef} controls src={audioUrl} className="w-full">
                            Your browser does not support the audio element.
                        </audio>
                        <button onClick={handleDownload} className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors w-full sm:w-auto shrink-0">
                            <DownloadIcon className="w-5 h-5" />
                            Unduh WAV
                        </button>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default TextToSpeech;
