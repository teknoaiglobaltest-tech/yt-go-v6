

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchWithChutesFallbacks } from '../services/chutesKeyService';
import { Spinner } from './Spinner';
import { Mode } from '../types';
import { ImageIcon } from './icons/Icons';
import { DownloadIcon } from './icons/Icons';
import { VideoIcon } from './icons/Icons';
import { SparklesIcon } from './icons/Icons';
import { generateVideoFromImage, generateVideoFromText } from '../services/gemini/videoService';


interface VideoViewProps {
  onAddHistory: (item: { mode: Mode; prompt: string; output: Blob }) => void;
  initialImage?: Blob | null;
  onInitialImageConsumed?: () => void;
}

type VideoMode = 'text-to-video' | 'image-to-video';
type AspectRatio = '9:16' | '16:9';

const translations: { [key: string]: string } = {
    loadingVideo1: 'Memanaskan inti fusi video...',
    loadingVideo2: 'Menyelaraskan piksel kuantum...',
    loadingVideo3: 'Hampir selesai, AI sedang menyeduh kopi...',
    loadingVideo4: 'Membuat mahakarya visual...',
    videoErrorRead: 'Gagal membaca file gambar.',
    videoErrorSelect: 'Silakan pilih file gambar yang valid.',
    videoTitle: 'Buat Video',
    videoSubtitle: 'Ubah ide Anda menjadi video pendek.',
    videoModeT2V: 'Teks ke Video',
    videoModeI2V: 'Gambar ke Video',
    videoSourceImage: 'Gambar Sumber',
    videoUpload: 'Unggah file',
    videoDragDrop: 'atau seret dan lepas',
    prompt: 'Prompt',
    imageOptimizePrompt: 'Optimalkan Prompt',
    optimizing: 'Mengoptimalkan...',
    videoPlaceholderT2V: 'Contoh: seekor kucing lucu bermain dengan bola benang...',
    videoPlaceholderI2V: 'Contoh: buat kucing ini menari...',
    generate: 'Buat',
    stop: 'Hentikan',
    videoGenerating: 'Pembuatan video bisa memakan waktu beberapa menit.',
    videoDownload: 'Unduh Video',
    videoEmptyTitle: 'Video Anda akan muncul di sini',
    videoErrorUploadI2V: 'Silakan unggah gambar untuk mode Gambar ke Video.',
    imageAspectRatio: 'Aspek Rasio',
    videoStopped: 'Pembuatan video dihentikan oleh pengguna.',
};
const t = (key: string) => translations[key] || key;

export const VideoView: React.FC<VideoViewProps> = ({ onAddHistory, initialImage, onInitialImageConsumed }) => {
  const [prompt, setPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoMode, setVideoMode] = useState<VideoMode>('image-to-video');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [loadingMessage, setLoadingMessage] = useState('');
  const loadingMessages = useMemo(() => [
      t('loadingVideo1'),
      t('loadingVideo2'),
      t('loadingVideo3'),
      t('loadingVideo4'),
  ], []);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
      let interval: ReturnType<typeof setInterval> | null = null;
      if (isLoading) {
          let i = 0;
          setLoadingMessage(loadingMessages[i]);
          interval = setInterval(() => {
              i = (i + 1) % loadingMessages.length;
              setLoadingMessage(loadingMessages[i]);
          }, 3500);
      }
      return () => {
          if (interval) clearInterval(interval);
      };
  }, [isLoading, loadingMessages]);

  const processImageBlob = useCallback((blob: Blob) => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    
    const previewUrl = URL.createObjectURL(blob);
    setImagePreview(previewUrl);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const base64 = (loadEvent.target?.result as string)?.split(',')[1];
      if (base64) {
        setImageBase64(base64);
        setError(null);
      } else {
        setError(t('videoErrorRead'));
      }
    };
    reader.onerror = () => {
      setError(t('videoErrorRead'));
    }
    reader.readAsDataURL(blob);
  }, [imagePreview]);

  useEffect(() => {
    const initialImageDataUrl = sessionStorage.getItem('videoViewInitialImage');
    if (initialImageDataUrl) {
        fetch(initialImageDataUrl)
            .then(res => res.blob())
            .then(blob => {
                processImageBlob(blob);
                setVideoMode('image-to-video');
                sessionStorage.removeItem('videoViewInitialImage');
            })
            .catch(err => {
                console.error("Failed to load initial image from history:", err);
                setError("Gagal memuat gambar dari riwayat.");
            });
    } else {
        // Default to image-to-video on first load
        setVideoMode('image-to-video');
    }
  }, [processImageBlob]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageBlob(file);
    } else {
      setError(t('videoErrorSelect'));
    }
  };
  
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);
  
  useEffect(() => {
    if (initialImage) {
      setVideoMode('image-to-video');
      processImageBlob(initialImage);
      onInitialImageConsumed?.();
    }
  }, [initialImage, onInitialImageConsumed, processImageBlob]);

  const handleOptimizePrompt = async () => {
    if (!prompt.trim() || isOptimizing) return;

    setIsOptimizing(true);
    try {
        const promptStructure = {
            "scene_description": "A high-level summary of the visual scene and its main action.",
            "camera": { "movement": "e.g., static, gentle upward tilt, slow pan", "angle": "e.g., eye-level, low-angle shot" },
            "lighting": { "type": "e.g., warm sunset lighting, soft studio", "mood": "e.g., joyful and magical, dramatic" },
            "animation": { "duration": "5 seconds", "actions": ["list of specific, subtle movements for characters or environment"] },
            "style": { "visual": "e.g., Pixar-style 3D animation, photorealistic", "mood": "e.g., cheerful, wholesome, epic" },
            "negative_prompt": ["list of things to avoid, e.g., no text, no blur, no distorted anatomy"],
            "duration": 5,
            "aspect_ratio": aspectRatio
        };
        
      // FIX: Use fetchWithChutesFallbacks to handle API key rotation and retries.
      const response = await fetchWithChutesFallbacks("https://llm.chutes.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: 'deepseek-ai/DeepSeek-V3-0324',
          messages: [
            {
              role: "system",
              content: `You are an expert prompt engineer for AI video generation models. Your task is to take a user's simple concept and expand it into a detailed, structured JSON object that will produce a high-quality, 5-second video. The final output must be in English. Do not add any conversational text or explanations, just return the raw JSON object. The JSON object should follow this exact structure: ${JSON.stringify(promptStructure)}`
            },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();
      const contentString = data.choices[0]?.message?.content;

      if (contentString) {
        try {
            const optimizedJson = JSON.parse(contentString);
            const prettyJson = JSON.stringify(optimizedJson, null, 2);
            setPrompt(prettyJson);
        } catch (e) {
            console.error("Failed to parse optimized JSON", e);
            setPrompt(contentString);
        }
      } else {
        console.error("Optimization returned an empty prompt.");
      }
    } catch (err) {
      console.error("Error optimizing prompt:", err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;
    if (videoMode === 'image-to-video' && !imageBase64) {
      setError(t('videoErrorUploadI2V'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setVideoUrl(null);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    let finalPrompt = prompt;
    let finalNegativePrompt = "Vibrant colors, overexposed, static, blurry details, subtitles, style, artwork, painting, picture, still, overall grayish, worst quality, low quality, JPEG compression artifacts, ugly, incomplete, extra fingers, poorly drawn hands, poorly drawn face, deformed, disfigured, malformed limbs, fused fingers, motionless image, cluttered background, three legs, many people in the background, walking backwards, slow motion";
    if (videoMode === 'image-to-video') {
        finalNegativePrompt = "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走";
    }

    try {
        const parsed = JSON.parse(prompt);
        if (parsed && typeof parsed === 'object') {
            if (parsed.scene_description) {
                finalPrompt = parsed.scene_description;
            }
            if (Array.isArray(parsed.negative_prompt)) {
                finalNegativePrompt += ', ' + parsed.negative_prompt.join(', ');
            }
        }
    } catch (e) {
        // Not JSON, proceed with prompt as is
    }

    const onRetryCallback = (attempt: number, maxRetries: number) => {
        setError(`Server sibuk. Mencoba lagi... (Percobaan ${attempt}/${maxRetries})`);
    };

    try {
      let videoBlob: Blob;

      if (videoMode === 'text-to-video') {
        // This path is currently disabled in the UI
        videoBlob = await generateVideoFromText(finalPrompt, finalNegativePrompt, aspectRatio, onRetryCallback, signal);
      } else { // Image-to-Video
        if (!imageBase64) throw new Error(t('videoErrorUploadI2V'));
        videoBlob = await generateVideoFromImage(imageBase64, finalPrompt, onRetryCallback, signal);
      }
      
      setError(null); // Clear any retry messages on success

      const url = URL.createObjectURL(videoBlob);
      setVideoUrl(url);

      onAddHistory({
        mode: Mode.Video,
        prompt: prompt,
        output: videoBlob,
      });

    } catch (err) {
      console.error("Error generating video:", err);
      if (err instanceof DOMException && err.name === 'AbortError') {
          setError(t('videoStopped'));
      } else {
          setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };
  
  const handleStop = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
      }
  };

  const resetImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setImageBase64(null);
    const fileInput = document.getElementById('image-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  const isBusy = isLoading || isOptimizing;

  return (
    <div className="flex flex-col lg:flex-row h-full max-w-full mx-auto p-4 md:p-6 lg:p-8 gap-8">
      <div className="w-full lg:w-[400px] lg:flex-shrink-0 flex flex-col bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
        <div className="flex-shrink-0 mb-6">
          <h2 className="text-3xl font-bold tracking-tight">{t('videoTitle')}</h2>
          <p className="text-gray-400 mt-1">{t('videoSubtitle')}</p>
        </div>
        
        <div className="flex-1 space-y-6 overflow-y-auto pr-2 -mr-2">
           <div className="flex justify-center p-1 bg-gray-700/60 rounded-lg">
            <button onClick={() => setVideoMode('text-to-video')} className={`w-1/2 py-2 rounded-md text-sm font-semibold transition-all ${videoMode === 'text-to-video' ? 'bg-pink-600 text-white shadow' : 'text-gray-300 hover:bg-gray-700'}`}>{t('videoModeT2V')}</button>
            <button onClick={() => setVideoMode('image-to-video')} className={`w-1/2 py-2 rounded-md text-sm font-semibold transition-all ${videoMode === 'image-to-video' ? 'bg-pink-600 text-white shadow' : 'text-gray-300 hover:bg-gray-700'}`}>{t('videoModeI2V')}</button>
          </div>
          
          {videoMode === 'text-to-video' ? (
             <div className="text-center p-4 my-auto bg-yellow-900/50 border border-yellow-700 rounded-lg flex flex-col items-center justify-center h-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-yellow-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="font-bold text-yellow-300">Sedang Maintenance</h3>
                <p className="text-sm text-yellow-400 mt-2">
                    Fitur ini sedang dalam perbaikan. Silakan gunakan fitur 
                    <button 
                        onClick={() => setVideoMode('image-to-video')} 
                        className="font-bold underline ml-1 text-yellow-300"
                    >
                        Gambar ke Video
                    </button>.
                </p>
            </div>
          ) : (
            <>
                <div>
                  <label htmlFor="image-upload" className="block text-sm font-medium text-gray-300 mb-2">{t('videoSourceImage')}</label>
                  {!imagePreview ? (
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md hover:border-pink-500 transition-colors">
                      <div className="space-y-1 text-center">
                        <ImageIcon className="mx-auto h-12 w-12 text-gray-500" />
                        <div className="flex text-sm text-gray-400">
                          <label htmlFor="image-upload" className="relative cursor-pointer rounded-md font-medium text-pink-400 hover:text-pink-500">
                            <span>{t('videoUpload')}</span>
                            <input id="image-upload" name="image-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} disabled={isBusy} />
                          </label>
                          <p className="pl-1">{t('videoDragDrop')}</p>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, GIF</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative group">
                      <img src={imagePreview} alt="Image preview" className="w-full max-h-40 object-contain rounded-md bg-black/20"/>
                      <button onClick={resetImage} disabled={isBusy} className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-black/80 transition opacity-0 group-hover:opacity-100">&times;</button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                    <label htmlFor="prompt-video-input" className="font-medium text-gray-300">{t('prompt')}</label>
                    <button
                        onClick={handleOptimizePrompt}
                        disabled={isBusy || !prompt.trim()}
                        className="flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                        title={t('imageOptimizePrompt')}
                    >
                        {isOptimizing ? (
                        <>
                            <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                            <span>{t('optimizing')}</span>
                        </>
                        ) : (
                        <>
                            <SparklesIcon className="w-4 h-4" />
                            <span>{t('imageOptimizePrompt')}</span>
                        </>
                        )}
                    </button>
                    </div>
                    <textarea
                    id="prompt-video-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={t('videoPlaceholderI2V')}
                    rows={3}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-pink-500 focus:outline-none transition-colors min-h-[80px]"
                    disabled={isBusy}
                    />
                </div>
            </>
          )}

        </div>
        
        <div className="mt-6 flex-shrink-0">
            <button
            onClick={isLoading ? handleStop : handleGenerate}
            disabled={isBusy || videoMode === 'text-to-video' || (videoMode === 'image-to-video' && (!imageBase64 || !prompt.trim()))}
            className={`w-full font-bold py-3 px-4 rounded-lg transition-all transform flex items-center justify-center text-lg ${
                isLoading 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-pink-600 text-white hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed hover:scale-105'
            }`}
            >
            {isLoading ? t('stop') : t('generate') + ' Video'}
            </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-black/20 border border-gray-700/50 rounded-xl p-4 min-h-[400px] lg:min-h-0 h-full">
        <div className="w-full h-full flex items-center justify-center">
            {isLoading && (
            <div className="text-center flex flex-col items-center justify-center gap-4">
                <Spinner size="lg" />
                <p className="text-gray-400 animate-pulse font-semibold">{loadingMessage}</p>
                {error && <p className="text-yellow-400 text-sm mt-2">{error}</p>}
                <p className="text-sm text-gray-500">{t('videoGenerating')}</p>
            </div>
            )}
            {error && !isLoading && <p className="text-red-400 text-center">{error}</p>}
            {videoUrl && !isLoading && (
            <div className="relative group w-full h-full">
                <video 
                src={videoUrl} 
                controls 
                autoPlay 
                loop 
                className="w-full h-full rounded-md object-contain"
                />
                <a
                href={videoUrl}
                download={`ai-video-${Date.now()}.mp4`}
                className="absolute top-4 right-4 bg-black/50 text-white p-2.5 rounded-full hover:bg-black/80 transition-all transform opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                aria-label={t('videoDownload')}
                >
                <DownloadIcon className="w-6 h-6" />
                </a>
            </div>
            )}
            {!isLoading && !error && !videoUrl && (
            <div className="text-center text-gray-500">
                <VideoIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="font-medium">{t('videoEmptyTitle')}</p>
            </div>
            )}
        </div>
      </div>
    </div>
  );
};