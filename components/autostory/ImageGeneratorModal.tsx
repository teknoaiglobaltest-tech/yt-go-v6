import React, { useState } from 'react';
// FIX: Removed import from non-existent module and replaced with centralized service.
import { fetchWithChutesFallbacks } from '../../services/chutesKeyService';
import { Spinner } from './Spinner';
import { CloseIcon } from './icons/CloseIcon';
import { SparklesIcon } from './icons/SparklesIcon';

interface ImageGeneratorModalProps {
  onClose: () => void;
  onSelect: (blob: Blob) => void;
  t: (key: string, params?: { [key: string]: string | number }) => string;
}

const aspectRatios = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1344, height: 768 },
    '9:16': { width: 768, height: 1344 },
    '4:3': { width: 1024, height: 768 },
    '3:4': { width: 768, height: 1024 },
};
type AspectRatio = keyof typeof aspectRatios;

// FIX: Removed local API key and fetch logic to use the centralized service.

export const ImageGeneratorModal: React.FC<ImageGeneratorModalProps> = ({ onClose, onSelect, t }) => {
    const [prompt, setPrompt] = useState('');
    const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('16:9');
    const [isLoading, setIsLoading] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);

    const handleOptimizePrompt = async () => {
        if (!prompt.trim() || isOptimizing) return;
        setIsOptimizing(true);
        setError(null);
        try {
            const response = await fetchWithChutesFallbacks("https://llm.chutes.ai/v1/chat/completions", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: 'deepseek-ai/DeepSeek-V3-0324',
                    messages: [ { role: "system", content: "You are an expert prompt engineer for an AI image generation model. Rewrite the user's simple instruction into a detailed and descriptive English prompt for a high-quality image. The prompt should clearly describe the desired scene, characters, lighting, and style to produce a visually stunning result, focusing on the action and story provided by the user. Your output must be ONLY the final prompt string." }, { role: "user", content: prompt } ],
                    temperature: 0.7
                })
            });
            const data = await response.json();
            const optimizedPrompt = data.choices[0]?.message?.content?.trim();
            if (optimizedPrompt) setPrompt(optimizedPrompt);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during optimization.');
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim() || isLoading) return;
        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);

        try {
            const { width, height } = aspectRatios[selectedRatio];
            const response = await fetchWithChutesFallbacks("https://image.chutes.ai/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "qwen-image",
                    prompt,
                    negative_prompt: "text, watermark, signature, username, blur, distortion, low quality",
                    guidance_scale: 7.5,
                    width,
                    height,
                    num_inference_steps: 50
                })
            });

            const blob = await response.blob();

            if (blob.type.startsWith('image/')) {
                const base64String = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const result = (reader.result as string)?.split(',')[1];
                        if (result) {
                            resolve(result);
                        } else {
                            reject(new Error("Failed to read image data."));
                        }
                    };
                    reader.onerror = (error) => reject(error);
                    reader.readAsDataURL(blob);
                });
                setGeneratedImage(base64String);
            } else {
                // Not an image, assume it's an error message (text or JSON)
                const errorText = await blob.text();
                let errorMessage = "Received an invalid response from the image generation server.";
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.detail || errorJson.message || errorText;
                } catch {
                    if (errorText.trim()) {
                       errorMessage = errorText;
                    }
                }
                throw new Error(errorMessage);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate image.');
        } finally {
            setIsLoading(false);
        }
    };

    const base64ToBlob = (base64: string, contentType = 'image/png'): Blob => {
        const byteCharacters = atob(base64);
        const byteArrays = [];
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }
        return new Blob(byteArrays, { type: contentType });
    };

    const handleSelectImage = () => {
        if (generatedImage) {
            const blob = base64ToBlob(generatedImage);
            onSelect(blob);
        }
    };

    const ratioContainerStyle = aspectRatios[selectedRatio];
    const previewAspectRatioStyle = {
      paddingTop: `${(ratioContainerStyle.height / ratioContainerStyle.width) * 100}%`,
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-purple-500/30 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-slate-700">
                    <h3 className="text-lg font-bold">{t('imageGeneratorTitle')}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-700"><CloseIcon className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4 flex flex-col">
                         <div className="flex-grow flex flex-col">
                            <div className="flex justify-between items-center mb-1.5">
                                <label htmlFor="gen-prompt" className="font-medium text-slate-300">{t('prompt')}</label>
                                <button onClick={handleOptimizePrompt} disabled={isOptimizing || !prompt.trim()} className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 disabled:text-slate-500">
                                    {isOptimizing ? <Spinner size="sm" /> : <SparklesIcon className="w-4 h-4" />} {t('imageOptimizePrompt')}
                                </button>
                            </div>
                            <textarea id="gen-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} rows={8} className="w-full bg-slate-800/50 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none flex-grow" />
                        </div>
                        <div>
                            <label className="font-medium text-slate-300 block mb-2">{t('aspectRatio')}</label>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                {(Object.keys(aspectRatios) as AspectRatio[]).map(ratio => (
                                    <button
                                        key={ratio}
                                        onClick={() => setSelectedRatio(ratio)}
                                        className={`py-2 px-1 text-sm font-semibold rounded-md transition-colors ${selectedRatio === ratio ? 'bg-purple-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}
                                    >
                                        {ratio}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col">
                        <div className="w-full bg-black rounded-lg flex-1 flex items-center justify-center relative overflow-hidden">
                           {isLoading && <Spinner />}
                           {error && !isLoading && <p className="text-red-400 text-sm p-4 text-center">{error}</p>}
                           {generatedImage && !isLoading && (
                               <img src={`data:image/png;base64,${generatedImage}`} alt="Generated image" className="absolute inset-0 w-full h-full object-contain" />
                           )}
                           <div className="absolute inset-0" style={previewAspectRatioStyle} />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-700 flex flex-col sm:flex-row justify-end gap-2">
                    <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 py-2 px-4 rounded-lg text-sm">{t('cancel')}</button>
                    {!generatedImage ? (
                         <button onClick={handleGenerate} disabled={isLoading || !prompt.trim()} className="bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-cyan-700 disabled:bg-slate-800 flex items-center justify-center gap-2">
                            {isLoading ? <><Spinner size="sm" /> {t('generating')}</> : <><SparklesIcon className="w-5 h-5" /> {t('generate')}</>}
                        </button>
                    ) : (
                        <div className="flex flex-col sm:flex-row gap-2">
                             <button onClick={handleGenerate} disabled={isLoading || !prompt.trim()} className="bg-slate-700 hover:bg-slate-600 py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-2">
                                {isLoading ? <><Spinner size="sm" /> {t('generating')}</> : <>{t('generateAgain')}</>}
                            </button>
                            <button onClick={handleSelectImage} className="bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700">
                                {t('useImage')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};