import React, { useState, useEffect, useRef } from 'react';
import { fetchWithChutesFallbacks } from '../../services/chutesKeyService';
import { Spinner } from './Spinner';
import { SparklesIcon } from './icons/SparklesIcon';
import { ImageIcon } from './icons/ImageIcon';
import { ArrowPathIcon } from './icons/ArrowPathIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';

const aspectRatios = {
    '16:9': { width: 1344, height: 768 },
    '9:16': { width: 768, height: 1344 },
};
export type AspectRatio = keyof typeof aspectRatios;

interface AutoStoryFormProps {
  onBack: () => void;
  onGenerate: (params: {
      initialImageBlob: Blob;
      prompts: string[];
      quality: '480p' | '720p';
      duration: '5s' | '8s';
  }) => void;
  t: (key: string, params?: { [key: string]: string | number }) => string;
}

export const AutoStoryForm: React.FC<AutoStoryFormProps> = ({ onBack, onGenerate, t }) => {
    const [storyIdea, setStoryIdea] = useState('');
    const [numScenes, setNumScenes] = useState(3);
    const [quality, setQuality] = useState<'480p' | '720p'>('480p');
    const [duration, setDuration] = useState<'5s' | '8s'>('8s');
    
    const [imageSource, setImageSource] = useState<'generate' | 'upload'>('generate');
    const [uploadedImage, setUploadedImage] = useState<{ blob: Blob; url: string } | null>(null);
    const [imageFidelity, setImageFidelity] = useState<'creative' | 'exact'>('creative');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [stage, setStage] = useState<'input' | 'loading' | 'image_preview' | 'scene_preview'>('input');
    const [statusText, setStatusText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    
    const [storyData, setStoryData] = useState<{ imageBlob: Blob; imageUrl: string; initialImagePrompt: string; prompts?: string[] } | null>(null);

    useEffect(() => {
        return () => {
            if (storyData?.imageUrl) URL.revokeObjectURL(storyData.imageUrl);
            if (uploadedImage?.url) URL.revokeObjectURL(uploadedImage.url);
        };
    }, [storyData, uploadedImage]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            if (uploadedImage) URL.revokeObjectURL(uploadedImage.url);
            setUploadedImage({ blob: file, url: URL.createObjectURL(file) });
        }
        e.target.value = '';
    };

    const handleGenerateInitialImage = async () => {
        if (!storyIdea.trim() || numScenes < 1) return;
        if (imageSource === 'upload' && !uploadedImage) {
            setError("Please upload an image to start the story.");
            return;
        }
        setStage('loading');
        setError(null);

        const onRetry = (attempt: number, maxRetries: number, serverName: string) => {
            setStatusText(`Server ${serverName} sibuk... Mencoba lagi (${attempt}/${maxRetries})`);
        };
        
        try {
            if (imageSource === 'upload') {
                setStoryData({
                    imageBlob: uploadedImage!.blob,
                    imageUrl: URL.createObjectURL(uploadedImage!.blob),
                    initialImagePrompt: "Image uploaded by user. Describe this image to start the story.",
                });
                setStage('image_preview');
            } else {
                setStatusText(t('generatingInitialImagePrompt'));
                const promptGenSystem = "You are a creative prompt engineer for an AI image generator. Based on the user's story idea, create a single, detailed, descriptive prompt for generating the very first reference image of the story. The prompt should be suitable for a model like Stable Diffusion or DALL-E. Focus on visual details: scene, characters, lighting, style, composition, and the core action or narrative of the user's idea. Your output must be a JSON object with a single key: \"initial_image_prompt\".";

                const promptGenResponse = await fetchWithChutesFallbacks("https://llm.chutes.ai/v1/chat/completions", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: 'deepseek-ai/DeepSeek-V3-0324', response_format: { type: "json_object" },
                        messages: [{ role: "system", content: promptGenSystem }, { role: "user", content: storyIdea }],
                    })
                }, onRetry);
                const promptGenData = JSON.parse(await promptGenResponse.text());
                const initial_image_prompt = JSON.parse(promptGenData.choices[0].message.content).initial_image_prompt;

                setStatusText(t('generatingInitialImage'));
                const { width, height } = aspectRatios['16:9'];
                const imageResponse = await fetchWithChutesFallbacks("https://image.chutes.ai/generate", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ model: "qwen-image", prompt: initial_image_prompt, negative_prompt: "blur, distortion, low quality, text, watermark", width, height, num_inference_steps: 50 })
                }, onRetry);
                const imageBlob = await imageResponse.blob();
                if (!imageBlob.type.startsWith('image/')) throw new Error(`Failed to generate initial image: ${await imageBlob.text()}`);
                
                setStoryData({ imageBlob, imageUrl: URL.createObjectURL(imageBlob), initialImagePrompt: initial_image_prompt });
                setStage('image_preview');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            setStage('input');
            setStatusText('');
        }
    };
    
    const handleOptimizeInitialPrompt = async () => {
        if (!storyData?.initialImagePrompt.trim() || isOptimizing) return;
        setIsOptimizing(true);
        setError(null);
        try {
            const response = await fetchWithChutesFallbacks("https://llm.chutes.ai/v1/chat/completions", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: 'deepseek-ai/DeepSeek-V3-0324',
                    messages: [ { role: "system", content: "You are an expert prompt engineer for an AI image generation model. Rewrite the user's simple instruction into a detailed and descriptive English prompt for a high-quality image. The prompt should clearly describe the desired scene, characters, lighting, and style to produce a visually stunning result, focusing on the action and story provided by the user. Your output must be ONLY the final prompt string." }, { role: "user", content: storyData.initialImagePrompt } ],
                    temperature: 0.7
                })
            });
            const data = await response.json();
            const optimizedPrompt = data.choices[0]?.message?.content?.trim();
            if (optimizedPrompt && storyData) {
                setStoryData({ ...storyData, initialImagePrompt: optimizedPrompt });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during optimization.');
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleRegenerateImage = async () => {
        if (!storyData?.initialImagePrompt || stage === 'loading') return;
        setStage('loading');
        setError(null);
        setStatusText(t('generatingInitialImage'));

        const onRetry = (attempt: number, maxRetries: number, serverName: string) => {
            setStatusText(`Server ${serverName} sibuk... Mencoba lagi (${attempt}/${maxRetries})`);
        };

        try {
            const { width, height } = aspectRatios['16:9'];
            const imageResponse = await fetchWithChutesFallbacks("https://image.chutes.ai/generate", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: "qwen-image", prompt: storyData.initialImagePrompt, negative_prompt: "blur, distortion, low quality, text, watermark", width, height, num_inference_steps: 50 })
            }, onRetry);
            const imageBlob = await imageResponse.blob();
            if (!imageBlob.type.startsWith('image/')) throw new Error(`Failed to generate initial image: ${await imageBlob.text()}`);
            
            if (storyData.imageUrl) URL.revokeObjectURL(storyData.imageUrl);
            setStoryData({ ...storyData, imageBlob, imageUrl: URL.createObjectURL(imageBlob) });

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setStage('image_preview');
            setStatusText('');
        }
    };
    
    const handleGenerateScenePrompts = async () => {
        if (!storyData) return;
        setStage('loading');
        setError(null);
        setStatusText(t('generatingStoryPlan'));

        const onRetry = (attempt: number, maxRetries: number, serverName: string) => {
            setStatusText(`Server ${serverName} sibuk... Mencoba lagi (${attempt}/${maxRetries})`);
        };
        
        try {
             let systemPrompt = `You are a creative storyteller and expert cinematographer for an AI video generator. You will be given a story idea and a description of the initial scene. Your task is to create a plan for a ${numScenes}-scene video that continues from that initial scene. Your output must be a JSON object with a single key: "scene_prompts". The value should be an array of ${numScenes} strings. Each string is a prompt for a video scene. CRITICAL INSTRUCTION: The prompts must describe actions that are 100% consistent with the initial scene's characters, clothing, and environment. DO NOT change the setting or the appearance of the characters. Only describe their movements and camera actions. The story must flow logically from the initial scene. For each scene prompt, focus on describing powerful action, specific camera styles, and cinematography. The generated video scenes should maintain consistency with the characters and style of the initial scene.`;
             
             if (imageSource === 'upload' && imageFidelity === 'exact') {
                systemPrompt = `You are a creative storyteller and expert cinematographer for an AI video generator. You will be given a story idea and a description of the initial scene, which is based on a user-uploaded image. Your task is to create a plan for a ${numScenes}-scene video that continues from that initial scene. Your output must be a JSON object with a single key: "scene_prompts". The value should be an array of ${numScenes} strings. Each string is a prompt for a video scene. CRITICAL INSTRUCTION: The generated scenes must be EXACTLY consistent with the initial user-uploaded image. DO NOT change the characters' appearance, clothing, or the environment. The prompts should focus exclusively on describing actions and cinematic camera work (movements, angles, lighting) that happen within this fixed setting and to these fixed characters. The story must flow logically from the initial scene.`;
             }

             const storyPlanResponse = await fetchWithChutesFallbacks("https://llm.chutes.ai/v1/chat/completions", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: 'deepseek-ai/DeepSeek-V3-0324', response_format: { type: "json_object" },
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: `Story Idea: "${storyIdea}". Initial Scene Description: "${storyData.initialImagePrompt}"` }
                    ],
                })
            }, onRetry);
            const storyPlanData = JSON.parse(await storyPlanResponse.text());
            const { scene_prompts } = JSON.parse(storyPlanData.choices[0].message.content);
            
            setStoryData({ ...storyData, prompts: scene_prompts });
            setStage('scene_preview');
        
        } catch (err) {
             setError(err instanceof Error ? err.message : 'An unknown error occurred.');
             setStage('image_preview');
             setStatusText('');
        }
    }


    const handleUpdateInitialPrompt = (text: string) => {
        if (storyData) {
            setStoryData({ ...storyData, initialImagePrompt: text });
        }
    };

    const handleUpdateScenePrompt = (index: number, text: string) => {
        if (storyData && storyData.prompts) {
            const newPrompts = [...storyData.prompts];
            newPrompts[index] = text;
            setStoryData({ ...storyData, prompts: newPrompts });
        }
    };

    const handleConfirmAndStart = () => {
        if (storyData && storyData.prompts) {
            onGenerate({
                initialImageBlob: storyData.imageBlob, 
                prompts: storyData.prompts, 
                quality,
                duration
            });
        }
    };
    
    const renderContent = () => {
        const selectStyles = {
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 0.5rem center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '1.5em 1.5em',
        };

        switch (stage) {
            case 'loading':
                return (
                    <div className="flex flex-col items-center justify-center text-center p-8 h-64">
                       <Spinner />
                       <p className="mt-4 text-sm text-purple-400">{statusText}</p>
                    </div>
                );
            case 'image_preview':
                return (
                     <div className="p-4 space-y-4">
                        <div className="relative w-full bg-black rounded-lg aspect-video flex items-center justify-center">
                            <img src={storyData?.imageUrl} alt="Initial scene preview" className="max-w-full max-h-full object-contain" />
                        </div>
                         <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="font-medium text-slate-300 block text-sm">{t('autoStoryInitialImagePrompt')}</label>
                                {imageSource === 'generate' && (
                                     <button onClick={handleOptimizeInitialPrompt} disabled={isOptimizing || !storyData?.initialImagePrompt.trim()} className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 disabled:text-slate-500">
                                        {isOptimizing ? <Spinner size="sm" /> : <SparklesIcon className="w-4 h-4" />} {t('imageOptimizePrompt')}
                                    </button>
                                )}
                            </div>
                            <textarea value={storyData?.initialImagePrompt} onChange={e => handleUpdateInitialPrompt(e.target.value)} rows={3} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-sm"  disabled={imageSource === 'upload'} />
                        </div>
                    </div>
                );
            case 'scene_preview':
                return (
                    <div className="p-4 space-y-4">
                        <h4 className="text-lg font-semibold text-center">{t('autoStoryPreviewTitle')}</h4>
                        <div className="relative w-full bg-black rounded-lg aspect-video flex items-center justify-center">
                            <img src={storyData?.imageUrl} alt="Initial scene preview" className="max-w-full max-h-full object-contain" />
                        </div>
                        <div className="space-y-3">
                            {storyData?.prompts?.map((p, i) => (
                                <div key={i}>
                                    <label className="font-medium text-slate-300 block mb-1.5 text-sm">{t('autoStoryScenePrompt', {count: i+1})}</label>
                                    <textarea value={p} onChange={e => handleUpdateScenePrompt(i, e.target.value)} rows={3} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-sm" />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'input':
            default:
                return (
                    <div className="p-4 space-y-4">
                        {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-lg text-sm">{error}</p>}
                        <div className="flex bg-slate-700/50 rounded-lg p-1">
                            <button onClick={() => setImageSource('generate')} className={`flex-1 py-2 text-sm rounded-md ${imageSource === 'generate' ? 'bg-purple-600 text-white' : 'hover:bg-slate-600'}`}>{t('autoStoryGenerateImage')}</button>
                            <button onClick={() => setImageSource('upload')} className={`flex-1 py-2 text-sm rounded-md ${imageSource === 'upload' ? 'bg-purple-600 text-white' : 'hover:bg-slate-600'}`}>{t('autoStoryUploadImage')}</button>
                        </div>
                        {imageSource === 'upload' && (
                            <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-square max-h-64 flex flex-col items-center justify-center bg-slate-700/30 hover:bg-slate-700/50 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 transition-colors cursor-pointer">
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                                {uploadedImage ? <img src={uploadedImage.url} alt="Uploaded preview" className="max-w-full max-h-full object-contain p-2" /> : <><ImageIcon className="w-8 h-8 mb-2" /><span className="font-semibold text-sm">{t('autoStoryDropImage')}</span></>}
                            </div>
                        )}
                        {imageSource === 'upload' && uploadedImage && (
                            <div>
                                <label className="font-medium text-slate-300 block mb-1.5">{t('autoStoryImageFidelity')}</label>
                                <div className="flex bg-slate-700/50 rounded-lg p-1">
                                    <button onClick={() => setImageFidelity('exact')} className={`flex-1 py-2 text-sm rounded-md ${imageFidelity === 'exact' ? 'bg-purple-600 text-white' : 'hover:bg-slate-600'}`}>{t('autoStoryImageFidelityExact')}</button>
                                    <button onClick={() => setImageFidelity('creative')} className={`flex-1 py-2 text-sm rounded-md ${imageFidelity === 'creative' ? 'bg-purple-600 text-white' : 'hover:bg-slate-600'}`}>{t('autoStoryImageFidelityCreative')}</button>
                                </div>
                            </div>
                        )}
                        <div>
                            <label htmlFor="story-idea" className="font-medium text-slate-300 block mb-1.5">{t('storyIdea')}</label>
                            <textarea id="story-idea" value={storyIdea} onChange={e => setStoryIdea(e.target.value)} rows={3} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none" placeholder="e.g., A knight discovers a hidden magical forest." />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div className="md:col-span-1">
                                <label htmlFor="num-scenes" className="font-medium text-slate-300 block mb-1.5">{t('numScenes')}</label>
                                <select id="num-scenes" value={numScenes} onChange={e => setNumScenes(parseInt(e.target.value, 10))} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 pr-10 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none appearance-none" style={selectStyles}>
                                    {Array.from({ length: 10 }, (_, i) => i + 1).map(num => <option key={num} value={num}>{num}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-1">
                                <label htmlFor="quality-select" className="font-medium text-slate-300 block mb-1.5">Kualitas Video</label>
                                <select id="quality-select" value={quality} onChange={e => setQuality(e.target.value as '480p' | '720p')} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 pr-10 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none appearance-none" style={selectStyles}>
                                    <option value="480p">480p</option>
                                    <option value="720p">720p</option>
                                </select>
                            </div>
                             <div className="md:col-span-1">
                                <label htmlFor="duration-select" className="font-medium text-slate-300 block mb-1.5">Durasi Video</label>
                                <select id="duration-select" value={duration} onChange={e => setDuration(e.target.value as '5s' | '8s')} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg p-3 pr-10 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none appearance-none" style={selectStyles}>
                                    <option value="5s">5 detik</option>
                                    <option value="8s">8 detik</option>
                                </select>
                            </div>
                        </div>
                    </div>
                );
        }
    };
    
    const renderFooter = () => {
        switch (stage) {
            case 'image_preview':
                return (
                     <div className="p-4 border-t border-slate-700 flex flex-col sm:flex-row gap-2">
                        {imageSource === 'generate' && (
                             <button onClick={handleRegenerateImage} className="w-full sm:w-auto flex-shrink-0 bg-slate-600 hover:bg-slate-500 py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-2">
                                <ArrowPathIcon className="w-4 h-4" /> {t('autoStoryRegenerateImage')}
                            </button>
                        )}
                         <button onClick={handleGenerateScenePrompts} className="w-full bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-cyan-700 flex items-center justify-center gap-2 transition-colors">
                            {t('autoStoryGenerateScenes')}
                        </button>
                    </div>
                );
            case 'scene_preview':
                 return (
                    <div className="p-4 border-t border-slate-700">
                         <button onClick={handleConfirmAndStart} className="w-full bg-cyan-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-cyan-700 flex items-center justify-center gap-2 transition-colors">
                            {t('confirmAndStart')}
                        </button>
                    </div>
                );
            case 'input':
                return (
                    <div className="p-4 border-t border-slate-700">
                         <button onClick={handleGenerateInitialImage} disabled={!storyIdea.trim() || numScenes < 1} className="w-full bg-cyan-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-cyan-700 disabled:bg-slate-800 disabled:text-slate-500 flex items-center justify-center gap-2 transition-colors">
                            <SparklesIcon className="w-5 h-5" /> {t('generateStory')}
                        </button>
                    </div>
                );
            case 'loading':
            default:
                return null;
        }
    };

    return (
        <div className="h-full w-full flex flex-col items-center justify-start md:justify-center p-0 md:p-4">
            <div className="bg-slate-900 md:border md:border-purple-500/30 md:rounded-xl w-full max-w-2xl flex flex-col h-full md:h-auto md:max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-slate-700 flex-shrink-0">
                    <button onClick={onBack} disabled={stage === 'loading'} className="p-1 rounded-full hover:bg-slate-700 disabled:opacity-50">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <h3 className="text-lg font-bold">{t('autoStoryModalTitle')}</h3>
                    <div className="w-8"></div>
                </div>
                <div className="flex-grow overflow-y-auto">
                   {renderContent()}
                </div>
                 <div className="flex-shrink-0">
                   {renderFooter()}
                 </div>
            </div>
        </div>
    );
};