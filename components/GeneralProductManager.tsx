import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { dbService } from '../services/db';
import * as storyboardService from '../services/gemini/storyboardService';
import * as seoService from '../services/gemini/seoService';
import * as videoService from '../services/gemini/videoService';
import { Avatar, Product, Scene, Project, Page, Location, SeoContent, Mode } from '../types';
import LoadingOverlay from './LoadingOverlay';
import Card from './Card';
import { DownloadIcon, ClipboardIcon, CheckIcon, SparklesIcon, ExternalLinkIcon, VideoIcon } from './icons/Icons';
import ImageCropper from './ImageCropper';
import SeoDisplay from './SeoDisplay';
import ImageEditor from './ImageEditor';
import Loader from './Loader';
import { AuthContext, AuthContextType } from '../contexts/AuthContext';
import { ImageGenerationAuthError } from '../services/gemini/sandboxImageService';

type Step = 'setup' | 'storyboard' | 'final';
type VoiceOverStyle = 'narasi' | 'lypsing';
type SceneTab = 'image' | 'video1' | 'video2';

interface GeneralProductManagerProps {
    setCurrentPage: (page: Page) => void;
}

const cancellableRetry = async <T,>(
  asyncFn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    onRetry: (attempt: number, error: any) => void;
    isCancelled: () => boolean;
  }
): Promise<T> => {
  const { maxRetries = 5, delayMs = 2000, onRetry, isCancelled } = options;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (isCancelled()) {
      throw new Error("Operation cancelled by user.");
    }
    try {
      return await asyncFn();
    } catch (error) {
      // Do not retry on auth error, let it propagate up.
      if (error instanceof ImageGenerationAuthError) {
          throw error;
      }
      lastError = error;
      if (attempt < maxRetries) {
        onRetry(attempt, error);
        // Exponential backoff
        const delay = delayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
};


const AssetSelector: React.FC<{
    items: any[];
    selectedId: string;
    onSelect: (id: string) => void;
    title: string;
    renderItem: (item: any) => React.ReactNode;
    onAddNew: () => void;
}> = ({ items, selectedId, onSelect, title, renderItem, onAddNew }) => (
    <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-200">{title}</h3>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {items.map(item => (
                <Card 
                    key={item.id} 
                    onClick={() => onSelect(item.id!.toString())}
                    className={`p-1 cursor-pointer transition-colors duration-200 ${selectedId === item.id!.toString() ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-gray-700'}`}
                >
                    {renderItem(item)}
                </Card>
            ))}
             <Card 
                onClick={onAddNew}
                className="p-1 cursor-pointer transition-colors duration-200 border-gray-600 hover:border-indigo-500 bg-gray-700/50 flex flex-col items-center justify-center aspect-square"
            >
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-xl font-bold mb-1">+</div>
                <p className="text-[10px] text-center font-semibold leading-tight">Buat Baru</p>
            </Card>
        </div>
    </div>
);

const GeneralProductManager: React.FC<GeneralProductManagerProps> = ({ setCurrentPage }) => {
  const { token, refreshToken } = useContext(AuthContext) as AuthContextType;
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [sceneCount, setSceneCount] = useState<number>(3);
  const [language, setLanguage] = useState<string>('Bahasa Indonesia');
  const [customLanguage, setCustomLanguage] = useState<string>('');
  const [promotionStyle, setPromotionStyle] = useState<string>('Hard Selling (langsung jual penekanan ke produk dengan scarcity dan penekanan kalau gak beli rugi)');
  const [hookStyle, setHookStyle] = useState<string>('sesuaikan gaya promosi');
  const [customHook, setCustomHook] = useState<string>('');
  const [cta, setCta] = useState<string>('Cek Keranjang Kiri Bawah');
  const [customCta, setCustomCta] = useState<string>('');
  const [voice, setVoice] = useState<string>('');
  const [voiceOverStyle, setVoiceOverStyle] = useState<VoiceOverStyle>('lypsing');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [storyboard, setStoryboard] = useState<Scene[]>([]);
  const [seoContent, setSeoContent] = useState<SeoContent | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('setup');
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null);
  const [copiedScriptIndex, setCopiedScriptIndex] = useState<number | null>(null);
  const [croppingImage, setCroppingImage] = useState<{ image: string; index: number } | null>(null);
  const [editingImage, setEditingImage] = useState<{ image: string; index: number } | null>(null);
  const [openVeoAccordion, setOpenVeoAccordion] = useState<number | null>(null);
  const isCancelledRef = useRef(false);
  
  const [sceneVideos, setSceneVideos] = useState<Record<number, { isLoading: boolean; videos: ({ url: string; blob: Blob } | null)[]; error: string | null }>>({});
  const [activeTabs, setActiveTabs] = useState<Record<number, SceneTab>>({});

  // Script states
  const [fullScript, setFullScript] = useState('');
  const [isScriptCopied, setIsScriptCopied] = useState(false);


  const fetchData = useCallback(async () => {
    try {
      const [avatarsData, productsData, locationsData] = await Promise.all([
        dbService.getAvatars(),
        dbService.getProducts(),
        dbService.getLocations(),
      ]);
      setAvatars(avatarsData);
      setProducts(productsData);
      setLocations(locationsData);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Gagal memuat data dari database.");
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedAvatarId) {
      const selectedAvatar = avatars.find(a => a.id === parseInt(selectedAvatarId));
      if (selectedAvatar?.gender) {
        const voiceMapping = {
          'Pria': 'Pria / Male',
          'Wanita': 'Wanita / Female'
        };
        setVoice(voiceMapping[selectedAvatar.gender]);
      }
    } else {
        setVoice(''); // Reset if no avatar is selected
    }
  }, [selectedAvatarId, avatars]);
  
  const handleGenerateStoryboard = async () => {
    const finalLanguage = language === 'Isi Sendiri' ? customLanguage : language;
    const finalCta = cta === 'Isi Sendiri...' ? customCta : cta;
    const finalHook = hookStyle === 'isi sendiri' ? customHook : hookStyle;

    if (!selectedAvatarId || !selectedProductId || !promotionStyle || !finalLanguage || !finalCta || !voice || !finalHook.trim()) {
      setError("Silakan lengkapi semua pilihan konsep iklan terlebih dahulu.");
      return;
    }
    if (!token) {
        setError('Token otentikasi tidak ditemukan. Coba perbarui di Pengaturan.');
        return;
    }
    setError(null);
    setIsLoading(true);
    setStoryboard([]);
    isCancelledRef.current = false;
    
    try {
      const avatar = avatars.find(a => a.id === parseInt(selectedAvatarId));
      const product = products.find(p => p.id === parseInt(selectedProductId));
      const location = locations.find(l => l.id === parseInt(selectedLocationId));
      if (!avatar || !product) throw new Error("Aset tidak ditemukan.");
      
      setLoadingText("Membuat konsep storyboard...");
      const generatedStoryboardText = await storyboardService.generateStoryboard(product, sceneCount, finalLanguage, promotionStyle, finalHook);

      if (generatedStoryboardText.length > 0) {
        const lastSceneIndex = generatedStoryboardText.length - 1;
        generatedStoryboardText[lastSceneIndex].script = `${generatedStoryboardText[lastSceneIndex].script} ${finalCta}.`;
      }
      
      const scenes: Scene[] = [];
      for (let i = 0; i < generatedStoryboardText.length; i++) {
        if (isCancelledRef.current) throw new Error("Operation cancelled by user.");
        setLoadingText(`Membuat gambar untuk adegan ${i + 1}/${sceneCount}...`);
        const sceneText = generatedStoryboardText[i];
        
        const sceneImage = await cancellableRetry(
          () => storyboardService.composeSceneImage(`data:image/jpeg;base64,${avatar.imageBase64}`, `data:image/jpeg;base64,${product.imageBase64}`, sceneText.description, token, location ? `data:image/jpeg;base64,${location.imageBase64}` : undefined),
          {
            onRetry: (attempt) => setLoadingText(`Gagal adegan ${i + 1}. Mencoba lagi... (${attempt}/5)`),
            isCancelled: () => isCancelledRef.current
          }
        );
        
        scenes.push({
          sceneNumber: i + 1,
          description: sceneText.description,
          script: sceneText.script,
          image: `data:image/jpeg;base64,${sceneImage}`
        });
      }
      setStoryboard(scenes);
      
      // Save preliminary project to get an ID
      const tempProject: Omit<Project, 'id' | 'seoContent'> = {
        contentType: 'general-product',
        avatarId: avatar.id!,
        productId: product.id!,
        avatarName: avatar.name,
        productName: product.name,
        storyboard: scenes,
        createdAt: new Date().toISOString(),
      };
      const newProjectId = await dbService.addProject(tempProject as Project);
      setProjectId(newProjectId);

      setCurrentStep('storyboard');
    } catch (err: any) {
        console.error(err);
        if (err instanceof ImageGenerationAuthError) {
            setError("Token tidak valid. Memperbarui token...");
            try {
                await refreshToken();
                setError("Token telah diperbarui. Silakan coba buat storyboard lagi.");
            } catch (refreshError: any) {
                 setError(`Gagal memperbarui token: ${refreshError.message}`);
            }
        } else if (err.message.includes("cancelled")) {
            setError("Proses dihentikan oleh pengguna.");
        } else {
            setError(`Terjadi kesalahan saat membuat storyboard: ${err.message}`);
        }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRegenerateScene = async (index: number) => {
    const sceneToRegen = storyboard[index];
    if (!sceneToRegen || sceneToRegen.isRegenerating) return;
    if (!token) { setError(`Gagal membuat ulang: Token tidak ditemukan.`); return; }

    setStoryboard(prev => prev.map((s, i) => i === index ? { ...s, isRegenerating: true } : s));
    setError(null);
    
    try {
        const avatar = avatars.find(a => a.id === parseInt(selectedAvatarId));
        const product = products.find(p => p.id === parseInt(selectedProductId));
        const location = locations.find(l => l.id === parseInt(selectedLocationId));

        if (!avatar || !product) {
            throw new Error("Aset yang dipilih tidak valid untuk membuat ulang gambar.");
        }

        const newImageBase64 = await storyboardService.composeSceneImage(
            `data:image/jpeg;base64,${avatar.imageBase64}`,
            `data:image/jpeg;base64,${product.imageBase64}`,
            sceneToRegen.description,
            token,
            location ? `data:image/jpeg;base64,${location.imageBase64}` : undefined
        );
        
        const newImage = `data:image/jpeg;base64,${newImageBase64}`;

        setStoryboard(prevStoryboard => {
            const updatedStoryboard = prevStoryboard.map((s, i) => 
                i === index ? { ...s, image: newImage, isRegenerating: false } : s
            );

            if (projectId) {
                dbService.getProjects()
                    .then(projects => projects.find(p => p.id === projectId))
                    .then(project => {
                        if (project) {
                            dbService.updateProject({ ...project, storyboard: updatedStoryboard });
                        }
                    });
            }

            return updatedStoryboard;
        });

    } catch (err: any) {
        console.error("Gagal membuat ulang adegan:", err);
        if (err instanceof ImageGenerationAuthError) {
            setError("Token tidak valid. Memperbarui...");
            try {
                await refreshToken();
                setError("Token telah diperbarui. Silakan coba buat ulang gambar.");
            } catch (refreshError: any) {
                 setError(`Gagal memperbarui token: ${refreshError.message}`);
            }
        } else {
             setError(`Gagal membuat ulang gambar untuk Adegan ${index + 1}.`);
        }
        setStoryboard(prev => prev.map((s, i) => i === index ? { ...s, isRegenerating: false } : s));
    }
  };

  const handleGenerateSceneVideos = async (index: number) => {
    const scene = storyboard[index];
    if (!scene || !scene.image) return;

    setSceneVideos(prev => ({
        ...prev,
        [index]: { isLoading: true, videos: [null, null], error: "Mengoptimalkan prompt..." }
    }));

    const onRetryCallback = (variation: 1 | 2) => (attempt: number, maxRetries: number) => {
        setSceneVideos(prev => ({
            ...prev,
            [index]: { ...prev[index], error: `Server sibuk untuk Video ${variation}. Mencoba lagi... (${attempt}/${maxRetries})` }
        }));
    };

    try {
        const imageBase64 = scene.image.split(',')[1];
        const optimizedPrompts = await videoService.optimizeScenesForVideo(scene.description);

        if (optimizedPrompts.length < 2) throw new Error("Gagal mendapatkan dua variasi prompt.");

        setSceneVideos(prev => ({
            ...prev,
            [index]: { ...prev[index], error: "Membuat 2 video..." }
        }));

        const [videoBlob1, videoBlob2] = await Promise.all([
            videoService.generateVideoFromImage(imageBase64, optimizedPrompts[0], onRetryCallback(1)),
            videoService.generateVideoFromImage(imageBase64, optimizedPrompts[1], onRetryCallback(2))
        ]);

        const videoUrl1 = URL.createObjectURL(videoBlob1);
        const videoUrl2 = URL.createObjectURL(videoBlob2);

        if (projectId) {
            await Promise.all([
                dbService.addVideoHistoryItem({ mode: Mode.Video, prompt: optimizedPrompts[0], output: videoBlob1, createdAt: new Date().toISOString(), projectId, sceneNumber: index + 1, variation: 1 }),
                dbService.addVideoHistoryItem({ mode: Mode.Video, prompt: optimizedPrompts[1], output: videoBlob2, createdAt: new Date().toISOString(), projectId, sceneNumber: index + 1, variation: 2 })
            ]);
        }

        setSceneVideos(prev => ({
            ...prev,
            [index]: {
                isLoading: false,
                videos: [
                    { url: videoUrl1, blob: videoBlob1 },
                    { url: videoUrl2, blob: videoBlob2 }
                ],
                error: null
            }
        }));

        setActiveTabs(prev => ({ ...prev, [index]: 'video1' }));

    } catch (err: any) {
        console.error(`Gagal membuat video untuk adegan ${index + 1}:`, err);
        setSceneVideos(prev => ({
            ...prev,
            [index]: { isLoading: false, videos: [null, null], error: err.message || "Gagal membuat video." }
        }));
    }
  };


  const handleScriptChange = (index: number, newScript: string) => {
    const updatedStoryboard = [...storyboard];
    updatedStoryboard[index].script = newScript;
    setStoryboard(updatedStoryboard);
  };
  
  const handleGenerateFinalPrompts = async () => {
    const avatar = avatars.find(a => a.id === parseInt(selectedAvatarId));
    const product = products.find(p => p.id === parseInt(selectedProductId));

    if (!avatar || !avatar.gender) {
        setError("Avatar yang dipilih tidak memiliki informasi jenis kelamin.");
        return;
    }
    if (!product) {
        setError("Produk tidak ditemukan.");
        return;
    }

    setIsLoading(true);
    setError(null);
    isCancelledRef.current = false;
    const finalLanguage = language === 'Isi Sendiri' ? customLanguage : language;
    try {
        setLoadingText("Membuat prompt VEO final...");
        const prompts = await storyboardService.generateVeoPrompts(storyboard, finalLanguage, voiceOverStyle, avatar.gender!);
        
        const finalStoryboard = storyboard.map((scene, index) => ({
            ...scene,
            veoPrompt: prompts[index]
        }));
        setStoryboard(finalStoryboard);

        if (isCancelledRef.current) throw new Error("Operation cancelled by user.");

        setLoadingText("Membuat konten SEO...");
        const context = `Iklan untuk produk '${product.name}' (${product.description}). Naskah iklan: ${finalStoryboard.map(s => s.script).join(' ')}`;
        // FIX: Added the 'finalLanguage' argument to the seoService.generateSeoContent call to match its definition.
        const generatedSeo = await seoService.generateSeoContent(context, finalLanguage);
        setSeoContent(generatedSeo);
        
        if (isCancelledRef.current) throw new Error("Operation cancelled by user.");

        setLoadingText("Memperbarui proyek...");
        if (projectId) {
            const project = await dbService.getProjects().then(p => p.find(proj => proj.id === projectId));
            if(project) {
                const updatedProject: Project = {
                    ...project,
                    storyboard: finalStoryboard,
                    seoContent: generatedSeo || undefined
                };
                await dbService.updateProject(updatedProject);
            }
        } else {
             // Fallback just in case projectId is lost. This is unlikely but safe.
             const newProjectId = await dbService.addProject({
                contentType: 'general-product',
                avatarId: avatar.id!,
                productId: product!.id!,
                avatarName: avatar.name,
                productName: product!.name,
                storyboard: finalStoryboard,
                createdAt: new Date().toISOString(),
                seoContent: generatedSeo || undefined
            } as Project);
            setProjectId(newProjectId);
        }

        const initialFullScript = finalStoryboard.map(s => s.script).join('\n\n');
        setFullScript(initialFullScript);
        setCurrentStep('final');

    } catch (err: any) {
      console.error(err);
       if (err.message.includes("cancelled")) {
        setError("Proses dihentikan oleh pengguna.");
      } else {
        setError("Gagal membuat hasil akhir. Coba lagi.");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCropComplete = (croppedImageUrl: string) => {
    if (croppingImage === null) return;
    const updatedStoryboard = [...storyboard];
    updatedStoryboard[croppingImage.index].image = croppedImageUrl;
    setStoryboard(updatedStoryboard);
    setCroppingImage(null);
  };
  
  const handleImageEditSave = async (newImage: string) => {
    if (editingImage === null) return;

    const updatedStoryboard = [...storyboard];
    updatedStoryboard[editingImage.index].image = newImage;
    setStoryboard(updatedStoryboard);

    if (projectId) {
        const project = await dbService.getProjects().then(p => p.find(proj => proj.id === projectId));
        if (project) {
            project.storyboard = updatedStoryboard;
            await dbService.updateProject(project);
        }
    }
    
    setEditingImage(null);
  };

  const resetState = () => {
    setCurrentStep('setup');
    setStoryboard([]);
    setSelectedAvatarId('');
    setSelectedProductId('');
    setSelectedLocationId('');
    setPromotionStyle('Hard Selling (langsung jual penekanan ke produk dengan scarcity dan penekanan kalau gak beli rugi)');
    setHookStyle('sesuaikan gaya promosi');
    setCustomHook('');
    setCta('Cek Keranjang Kiri Bawah');
    setCustomCta('');
    setVoice('');
    setVoiceOverStyle('lypsing');
    setError(null);
    setSeoContent(null);
    setProjectId(null);
    setSceneVideos({});
  };

  const handleDownload = (index: number) => {
    const activeTab = activeTabs[index] || 'image';
    const scene = storyboard[index];
    const videoData = sceneVideos[index];

    if (activeTab === 'image') {
        downloadImage(scene.image, `scene_${scene.sceneNumber}.jpg`);
    } else if (activeTab === 'video1' && videoData?.videos[0]?.url) {
        const a = document.createElement('a');
        a.href = videoData.videos[0].url;
        a.download = `scene_${scene.sceneNumber}_video1.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } else if (activeTab === 'video2' && videoData?.videos[1]?.url) {
        const a = document.createElement('a');
        a.href = videoData.videos[1].url;
        a.download = `scene_${scene.sceneNumber}_video2.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
  };

  const downloadImage = (base64Image: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = base64Image;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = (text: string, index: number, type: 'prompt' | 'script') => {
    navigator.clipboard.writeText(text);
    if (type === 'prompt') {
        setCopiedPromptIndex(index);
        setTimeout(() => setCopiedPromptIndex(null), 2000);
    } else {
        setCopiedScriptIndex(index);
        setTimeout(() => setCopiedScriptIndex(null), 2000);
    }
  };
  
  const handleCopyFullScript = () => {
    navigator.clipboard.writeText(fullScript);
    setIsScriptCopied(true);
    setTimeout(() => setIsScriptCopied(false), 2000);
  };


  const renderStep = (stepNum: number, title: string, children: React.ReactNode) => (
    <Card className="p-6">
        <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-xl font-bold">
                {stepNum}
            </div>
            <div className="flex-1">
                <h2 className="text-2xl font-bold mb-4">{title}</h2>
                {children}
            </div>
        </div>
    </Card>
  );
  
  const finalLang = language === 'Isi Sendiri' ? customLanguage : language;
  const finalCta = cta === 'Isi Sendiri...' ? customCta : cta;
  const isSetupComplete = selectedAvatarId && selectedProductId && promotionStyle && finalLang && finalCta && voice && voiceOverStyle;

  return (
    <div className="space-y-8">
      {isLoading && <LoadingOverlay text={loadingText} onCancel={() => isCancelledRef.current = true} />}
      <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500">Iklan Produk Umum</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Left Card for Asset Selection */}
        <Card className="p-6 md:col-span-3">
            <div className="space-y-6">
                <AssetSelector 
                    title="1. Pilih Avatar"
                    items={avatars}
                    selectedId={selectedAvatarId}
                    onSelect={setSelectedAvatarId}
                    onAddNew={() => setCurrentPage('asset')}
                    renderItem={(item: Avatar) => (
                        <>
                            <img src={`data:image/jpeg;base64,${item.imageBase64}`} alt={item.name} className="aspect-square w-full object-cover rounded-md" />
                            <p className="text-[10px] font-medium truncate text-center mt-1 whitespace-nowrap">{item.name}</p>
                        </>
                    )}
                />
                <AssetSelector 
                    title="2. Pilih Produk"
                    items={products}
                    selectedId={selectedProductId}
                    onSelect={setSelectedProductId}
                    onAddNew={() => setCurrentPage('asset')}
                    renderItem={(item: Product) => (
                        <>
                            <div className="aspect-square w-full rounded-md bg-gray-900 flex items-center justify-center">
                               <img src={`data:image/jpeg;base64,${item.imageBase64}`} alt={item.name} className="max-h-full max-w-full" />
                            </div>
                            <p className="text-[10px] font-medium truncate text-center mt-1 whitespace-nowrap">{item.name}</p>
                        </>
                    )}
                />
                <AssetSelector 
                    title="3. Pilih Lokasi (Opsional)"
                    items={locations}
                    selectedId={selectedLocationId}
                    onSelect={(id) => setSelectedLocationId(id === selectedLocationId ? '' : id)} // Allow deselect
                    onAddNew={() => setCurrentPage('asset')}
                    renderItem={(item: Location) => (
                        <>
                            <img src={`data:image/jpeg;base64,${item.imageBase64}`} alt={item.name} className="aspect-square w-full object-cover rounded-md" />
                            <p className="text-[10px] font-medium truncate text-center mt-1 whitespace-nowrap">{item.name}</p>
                        </>
                    )}
                />
            </div>
        </Card>
        
        {/* Right Card for Ad Concept and Generation */}
        <Card className="p-6 md:col-span-2 flex flex-col">
            <div className="flex-grow">
                <h3 className="text-xl font-bold text-gray-200 mb-4">4. Atur Konsep Iklan</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="promotionStyle" className="block text-sm font-medium text-gray-300 mb-2">Gaya Promosi</label>
                        <select id="promotionStyle" value={promotionStyle} onChange={e => setPromotionStyle(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="">-- Pilih Gaya --</option>
                            <option value="Soft Selling ( model curhat manfaatkan cerita yang mengandung problem dan produk jadi solusi)">Soft Selling (Cerita & Solusi)</option>
                            <option value="Hard Selling (langsung jual penekanan ke produk dengan scarcity dan penekanan kalau gak beli rugi)">Hard Selling (Langsung & Mendesak)</option>
                            <option value="Model Drama ( menarik dan buat orang penasaran, vibe seperti drama korea)">Model Drama (Vibe K-Drama)</option>
                            <option value="Lucu & Humoris ( lucu dengan humor khas orang indonesia)">Lucu & Humoris (Humor Indonesia)</option>
                            <option value="Model Presenter Berita ( profesional seperti presenter berita di tv)">Model Presenter Berita (Profesional)</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="hookStyle" className="block text-sm font-medium text-gray-300 mb-2">Model Hook</label>
                        <select id="hookStyle" value={hookStyle} onChange={e => setHookStyle(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="sesuaikan gaya promosi">Sesuaikan Gaya Promosi</option>
                            <option value="kenapa ya">"Kenapa ya..."</option>
                            <option value="kalian tahu gak">"Kalian tahu gak..."</option>
                            <option value="sumpah, nyesel baru tahu">"Sumpah, nyesel baru tahu..."</option>
                            <option value="isi sendiri">Isi Sendiri...</option>
                        </select>
                    </div>
                    {hookStyle === 'isi sendiri' && (
                        <div>
                            <label htmlFor="customHook" className="block text-sm font-medium text-gray-300 mb-2">Masukkan Hook Kustom</label>
                            <input type="text" id="customHook" value={customHook} onChange={e => setCustomHook(e.target.value)} placeholder="Tulis hook pembuka Anda..." className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                    )}
                     <div>
                        <label htmlFor="cta" className="block text-sm font-medium text-gray-300 mb-2">CTA / Ajakan Beli</label>
                        <select id="cta" value={cta} onChange={e => setCta(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="">-- Pilih CTA --</option>
                            <option>Cek Keranjang Kuning</option>
                            <option>Cek Keranjang Kiri Bawah</option>
                            <option>Cek Link di Profil</option>
                            <option>Isi Sendiri...</option>
                        </select>
                    </div>
                    {cta === 'Isi Sendiri...' && (
                        <div>
                            <label htmlFor="customCta" className="block text-sm font-medium text-gray-300 mb-2">Masukkan CTA Kustom</label>
                            <input type="text" id="customCta" value={customCta} onChange={e => setCustomCta(e.target.value)} placeholder="Contoh: Beli sekarang!" className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                    )}
                    <div>
                        <label htmlFor="scenes" className="block text-sm font-medium text-gray-300 mb-2">Jumlah Adegan</label>
                        <select id="scenes" value={sceneCount} onChange={e => setSceneCount(parseInt(e.target.value))} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-indigo-500 focus:border-indigo-500">
                            {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                                <option key={num} value={num}>{num}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="language" className="block text-sm font-medium text-gray-300 mb-2">Bahasa Naskah</label>
                        <select id="language" value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-indigo-500 focus:border-indigo-500">
                            <option>Bahasa Indonesia</option>
                            <option>English</option>
                            <option>Isi Sendiri</option>
                        </select>
                    </div>
                    {language === 'Isi Sendiri' && (
                         <div>
                            <label htmlFor="customLanguage" className="block text-sm font-medium text-gray-300 mb-2">Masukkan Bahasa</label>
                            <input type="text" id="customLanguage" value={customLanguage} onChange={e => setCustomLanguage(e.target.value)} placeholder="Contoh: Bahasa Jawa, Sunda, Betawi..." className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                    )}
                     <div>
                        <label htmlFor="voiceOverStyle" className="block text-sm font-medium text-gray-300 mb-2">Gaya Voice Over</label>
                        <select id="voiceOverStyle" value={voiceOverStyle} onChange={e => setVoiceOverStyle(e.target.value as VoiceOverStyle)} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="lypsing">Lypsing</option>
                            <option value="narasi">Narasi</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-6 border-t border-gray-700">
                <button
                    onClick={handleGenerateStoryboard}
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors text-lg"
                    >
                    Buat Storyboard & Gambar
                </button>
            </div>
        </Card>
      </div>
      
      {error && <p className="text-red-400 text-center p-4 bg-red-900/50 rounded-lg">{error}</p>}

      {(currentStep === 'storyboard' || currentStep === 'final') && storyboard.length > 0 && renderStep(2, currentStep === 'final' ? "Hasil Akhir: Gambar, Prompt & SEO" : "Review & Edit Storyboard", (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {storyboard.map((scene, index) => {
                    const activeTab = activeTabs[index] || 'image';
                    const sceneVideoData = sceneVideos[index];
                    const isAnyLoading = scene.isRegenerating || sceneVideoData?.isLoading;
                    const product = products.find(p => p.id === parseInt(selectedProductId));
                    const productName = product ? product.name.replace(/\s+/g, '_').substring(0, 15) : 'iklan';

                    return (
                        <Card key={index} className="p-3 flex flex-col bg-gray-900/50">
                            <div className="relative">
                                <div className="flex justify-center p-1 bg-gray-800 rounded-t-lg text-xs">
                                    <button onClick={() => setActiveTabs(prev => ({ ...prev, [index]: 'image' }))} className={`px-3 py-1 rounded-md ${activeTab === 'image' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>Gambar</button>
                                    <button onClick={() => setActiveTabs(prev => ({ ...prev, [index]: 'video1' }))} disabled={!sceneVideoData?.videos[0]} className={`px-3 py-1 rounded-md ${activeTab === 'video1' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'} disabled:text-gray-500 disabled:hover:bg-transparent`}>Adegan 1</button>
                                    <button onClick={() => setActiveTabs(prev => ({ ...prev, [index]: 'video2' }))} disabled={!sceneVideoData?.videos[1]} className={`px-3 py-1 rounded-md ${activeTab === 'video2' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'} disabled:text-gray-500 disabled:hover:bg-transparent`}>Adegan 2</button>
                                </div>
                                <div className="relative aspect-[9/16] w-full bg-gray-800 rounded-b-lg overflow-hidden">
                                    {activeTab === 'image' && <img src={scene.image} alt={`Scene ${scene.sceneNumber}`} className="w-full h-full object-cover" />}
                                    {activeTab === 'video1' && sceneVideoData?.videos[0]?.url && <video src={sceneVideoData.videos[0].url} controls loop className="w-full h-full object-cover" />}
                                    {activeTab === 'video2' && sceneVideoData?.videos[1]?.url && <video src={sceneVideoData.videos[1].url} controls loop className="w-full h-full object-cover" />}
                                    
                                    {isAnyLoading && (
                                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded-lg">
                                            <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-indigo-400"></div>
                                            <p className="text-sm mt-2 text-white">{scene.isRegenerating ? 'Membuat ulang...' : sceneVideoData?.error || 'Membuat video...'}</p>
                                        </div>
                                    )}
                                    {sceneVideoData?.error && !isAnyLoading && activeTab !== 'image' && (
                                         <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-2"><p className="text-red-400 text-center text-xs">{sceneVideoData.error}</p></div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="py-2 flex justify-center gap-2 flex-wrap">
                                {activeTab === 'image' && (
                                    <>
                                        <button onClick={() => downloadImage(scene.image, `scene_${scene.sceneNumber}.jpg`)} className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-green-600 text-white font-semibold py-1.5 px-3 rounded-md transition-colors" title="Unduh Gambar"><DownloadIcon className="w-4 h-4"/><span>Unduh</span></button>
                                        <button onClick={() => setEditingImage({ image: scene.image, index: index })} className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-purple-600 text-white font-semibold py-1.5 px-3 rounded-md transition-colors" title="Edit dengan AI"><SparklesIcon className="w-4 h-4"/><span>Edit</span></button>
                                        <button onClick={() => handleRegenerateScene(index)} disabled={isAnyLoading} className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-teal-600 text-white font-semibold py-1.5 px-3 rounded-md transition-colors disabled:bg-gray-800 disabled:cursor-not-allowed" title="Buat Ulang Gambar"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg><span>Ulang</span></button>
                                        <button onClick={() => handleGenerateSceneVideos(index)} disabled={isAnyLoading} className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-pink-600 text-white font-semibold py-1.5 px-3 rounded-md transition-colors disabled:bg-gray-800 disabled:cursor-not-allowed" title="Buat Video dari Gambar"><VideoIcon className="w-4 h-4"/><span>Buat Video</span></button>
                                    </>
                                )}
                                {sceneVideoData?.videos[0] && (
                                  <button onClick={() => downloadBlob(sceneVideoData.videos[0]!.blob, `${productName}_scene_${scene.sceneNumber}_video_1.mp4`)} className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-green-600 text-white font-semibold py-1.5 px-3 rounded-md transition-colors"><DownloadIcon className="w-4 h-4"/><span>Unduh Video 1</span></button>
                                )}
                                {sceneVideoData?.videos[1] && (
                                  <button onClick={() => downloadBlob(sceneVideoData.videos[1]!.blob, `${productName}_scene_${scene.sceneNumber}_video_2.mp4`)} className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-green-600 text-white font-semibold py-1.5 px-3 rounded-md transition-colors"><DownloadIcon className="w-4 h-4"/><span>Unduh Video 2</span></button>
                                )}
                            </div>


                            <div className="flex-1 space-y-3 pt-2 border-t border-gray-700">
                                <h3 className="font-bold text-lg text-indigo-400">Adegan {scene.sceneNumber}</h3>
                                <p className="text-sm text-gray-400">{scene.description}</p>
                                
                                {currentStep === 'final' && scene.veoPrompt ? (
                                    <div className="mt-3">
                                        <div className="border border-gray-700 rounded-lg overflow-hidden">
                                            <div className="flex justify-between items-center p-3 bg-gray-800 hover:bg-gray-700">
                                                <button onClick={() => setOpenVeoAccordion(openVeoAccordion === index ? null : index)} className="flex-grow flex items-center justify-between text-left focus:outline-none"><h4 className="font-semibold text-gray-300">Prompt VEO (Final)</h4><svg className={`w-5 h-5 transform transition-transform ${openVeoAccordion === index ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                                                <button onClick={(e) => { e.stopPropagation(); if (scene.veoPrompt) { const fullPrompt = `DIALOGUE INSTRUCTION:\n${scene.veoPrompt.dialogueInstruction}\n\nMAIN PROMPT:\n${scene.veoPrompt.mainPrompt}\n\nNEGATIVE PROMPT:\n${scene.veoPrompt.negativePrompt}`; handleCopyToClipboard(fullPrompt, index, 'prompt'); } }} className="ml-4 flex items-center gap-1 text-sm bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded shrink-0">{copiedPromptIndex === index ? <CheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}{copiedPromptIndex === index ? 'Disalin' : 'Salin'}</button>
                                            </div>
                                            {openVeoAccordion === index && scene.veoPrompt && (
                                                <div className="p-4 bg-gray-900/50 space-y-3">
                                                    <div><h5 className="font-semibold text-sm text-gray-400 mb-1">Instruksi Dialog</h5><p className="text-sm whitespace-pre-wrap text-indigo-300">{scene.veoPrompt.dialogueInstruction}</p></div>
                                                    <div><h5 className="font-semibold text-sm text-gray-400 mb-1">Prompt Utama (Animasi)</h5><p className="text-sm whitespace-pre-wrap text-gray-200">{scene.veoPrompt.mainPrompt}</p></div>
                                                    <div><h5 className="font-semibold text-sm text-gray-400 mb-1">Prompt Negatif</h5><p className="text-xs whitespace-pre-wrap text-gray-500">{scene.veoPrompt.negativePrompt}</p></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="flex justify-between items-center"><label htmlFor={`script-${index}`} className="block text-sm font-medium text-gray-300">Naskah (Bisa diedit)</label><button onClick={() => handleCopyToClipboard(scene.script, index, 'script')} className="flex items-center gap-1 text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded">{copiedScriptIndex === index ? <CheckIcon className="w-3 h-3 text-green-400" /> : <ClipboardIcon className="w-3 h-3" />}{copiedScriptIndex === index ? 'Disalin' : 'Salin'}</button></div>
                                        <textarea id={`script-${index}`} rows={4} className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white text-sm" value={scene.script} onChange={(e) => handleScriptChange(index, e.target.value)} />
                                    </div>
                                )}
                            </div>
                        </Card>
                    )
                })}
            </div>

            {currentStep === 'final' && (
                <>
                    {seoContent && <SeoDisplay content={seoContent} />}
                    <div className="flex justify-center gap-4 my-6">
                        <a href="https://labs.google/fx/tools/flow" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 btn-primary font-semibold py-2 px-4 rounded-lg"><ExternalLinkIcon className="w-5 h-5"/>Buat Di Flow AI</a>
                        <a href="https://gemini.google.com/?hl=id" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 btn-primary font-semibold py-2 px-4 rounded-lg"><ExternalLinkIcon className="w-5 h-5"/>Buat Di Gemini</a>
                    </div>
                    <Card className="p-4 sm:p-6 mt-6 bg-gray-900/50">
                         <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xl font-bold text-purple-400">Naskah Lengkap</h3>
                            <button onClick={handleCopyFullScript} className="flex items-center gap-1 text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded">
                                {isScriptCopied ? <CheckIcon className="w-3 h-3 text-green-400" /> : <ClipboardIcon className="w-3 h-3" />}
                                {isScriptCopied ? 'Disalin' : 'Salin Naskah'}
                            </button>
                        </div>
                        <textarea value={fullScript} onChange={e => setFullScript(e.target.value)} rows={8} className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-300" />
                        <div className="text-center mt-4">
                            <a href="https://gemini.google.com/share/5e6359c3b475" target="_blank" rel="noopener noreferrer" className="btn-primary font-bold py-2 px-8 rounded-lg inline-block">
                                Buat Suara Natural
                            </a>
                        </div>
                    </Card>
                </>
            )}

            <div className="mt-6 flex justify-center">
                 {currentStep === 'storyboard' && (
                    <button onClick={handleGenerateFinalPrompts} disabled={isLoading} className="btn-primary font-bold py-3 px-12 rounded-full shadow-lg text-lg">Konfirmasi & Buat Hasil Akhir</button>
                )}
                 {currentStep === 'final' && (<button onClick={resetState} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-12 rounded-full shadow-lg text-lg">Buat Iklan Baru</button>)}
            </div>
        </div>
      ))}
       {croppingImage && (<ImageCropper src={croppingImage.image} onCrop={handleCropComplete} onClose={() => setCroppingImage(null)}/>)}
        {editingImage && (<ImageEditor src={editingImage.image} onSave={handleImageEditSave} onClose={() => setEditingImage(null)}/>)}
    </div>
  );
};

export default GeneralProductManager;
