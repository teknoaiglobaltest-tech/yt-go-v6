import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import * as fashionService from '../services/gemini/fashionService';
import * as seoService from '../services/gemini/seoService';
import { dbService } from '../services/db';
import { DownloadIcon, ClipboardIcon, CheckIcon, SparklesIcon, ExternalLinkIcon } from './icons/Icons';
import { Avatar, Product, Location, SeoContent, FashionHistoryItem } from '../types';
import Loader from './Loader';
import ImageCropper from './ImageCropper';
import SeoDisplay from './SeoDisplay';
import ImageEditor from './ImageEditor';


type Tab = 'tryon' | 'poses';
type ImageData = { file: File | null; dataUrl: string; base64: string; mimeType: string; };
type PoseResult = { id: number; dbId?: number; pose: string; imageUrl?: string; error?: string; isLoading: boolean; veoPrompt?: string; seoContent?: SeoContent; };
type ModelInputMode = 'upload' | 'select';
type ProductInputMode = 'upload' | 'select';
interface AspectRatio { label: string; ratio: number; }

const ALL_POSES: string[] = [
    'Pose fashion dinamis dengan satu tangan di pinggul dan tangan lainnya diangkat ke atas',
    'Pose klasik dengan tangan di saku celana',
    'Menyender ke dinding dengan santai, satu kaki ditekuk',
    'Pose fashion dinamis membentuk huruf S dengan tubuh',
    'Berdiri tegak dengan tatapan kuat, tangan menyilang di dada',
    'Pose contrapposto, berat badan pada satu kaki, pinggul miring',
    'Berdiri dengan kaki terbuka lebar, pose yang kuat dan percaya diri',
    'Pose dari belakang (standing backpose), menoleh sedikit ke kamera',
    'Pose dari samping (side profile), menatap lurus ke depan',
    'Satu tangan di pinggul, tangan lain memegang kerah baju atau aksesori',
    'Pose asimetris, satu bahu lebih tinggi dari yang lain',
    'Pose minimalis, berdiri lurus menatap kamera dengan ekspresi netral',
    'Pose berjalan, seolah-olah tertangkap kamera sedang melangkah',
    'Pose melompat kecil dengan ekspresi ceria',
    'Pose berputar (spinning), dengan gaun atau rambut yang bergerak',
    'Pose berlari kecil dengan gaya candid',
    'Duduk di kursi dengan elegan, satu kaki menyilang di atas yang lain',
    'Duduk di lantai dengan santai, satu lutut ditekuk ke atas',
    'Duduk di tangga, menatap ke arah atas atau bawah',
    'Duduk di lantai dengan kaki lurus ke depan, menonjolkan sepatu',
    'Beauty shot close-up, fokus pada wajah dan riasan, dengan senyuman lembut',
    'Tangan membingkai wajah atau menyentuh rambut dengan lembut',
    'Pose half-body yang elegan, satu tangan diangkat ke dekat dagu',
    'Menatap tajam ke kamera dengan ekspresi serius (fierce)',
    'Tertawa lepas, candid close-up',
    'Satu tangan di bahu, tubuh sedikit miring ke samping',
    'Melihat ke belakang lewat bahu (over-the-shoulder)',
    'Pose dramatis dengan permainan bayangan yang kuat pada wajah atau tubuh',
    'Berinteraksi dengan properti (misal: memegang topi, kacamata, atau tas)',
    'Pose berbaring di lantai atau sofa dengan gaya high fashion',
];

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
      lastError = error;
      if (attempt < maxRetries) {
        onRetry(attempt, error);
        const delay = delayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
};

const ImageUploader: React.FC<{ onFileUpload: (data: ImageData) => void; children: React.ReactNode; previewUrl?: string; }> = ({ onFileUpload, children, previewUrl }) => {
    const [isDragging, setIsDragging] = useState(false);
    const processFile = (file: File) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const base64 = dataUrl.split(',')[1];
            onFileUpload({ file, dataUrl, base64, mimeType: file.type });
        };
        reader.readAsDataURL(file);
    };
    const handleDragEvents = (e: React.DragEvent<HTMLLabelElement>) => { e.preventDefault(); e.stopPropagation(); };
    const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => { handleDragEvents(e); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => { handleDragEvents(e); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => { handleDragEvents(e); setIsDragging(false); processFile(e.dataTransfer.files[0]); };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { processFile(e.target.files?.[0] as File); };
    return (
        <label className={`upload-box w-full h-64 sm:h-80 flex-grow rounded-lg flex items-center justify-center cursor-pointer relative overflow-hidden ${isDragging ? 'dragging' : ''}`} onDragEnter={handleDragEnter} onDragOver={handleDragEvents} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            {previewUrl ? <img src={previewUrl} className="absolute top-0 left-0 w-full h-full object-contain" alt="Preview" /> : children}
            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
        </label>
    );
};

const FashionManager: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('tryon');
    const [productImage, setProductImage] = useState<ImageData | null>(null);
    const [modelImage, setModelImage] = useState<ImageData | null>(null);
    const [tryonResult, setTryonResult] = useState<string | null>(null);
    const [tryonDbId, setTryonDbId] = useState<number | null>(null);
    const [isTryonLoading, setIsTryonLoading] = useState(false);
    const [tryonError, setTryonError] = useState<string | null>(null);
    const [modelInputMode, setModelInputMode] = useState<ModelInputMode>('upload');
    const [productInputMode, setProductInputMode] = useState<ProductInputMode>('upload');
    const [avatars, setAvatars] = useState<Avatar[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [poseImage, setPoseImage] = useState<ImageData | null>(null);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
    const [isPoseModalOpen, setIsPoseModalOpen] = useState(false);
    const [selectedPoses, setSelectedPoses] = useState<string[]>([]);
    const [poseResults, setPoseResults] = useState<PoseResult[]>([]);
    const [poseGenError, setPoseGenError] = useState<string | null>(null);
    const [copiedPromptId, setCopiedPromptId] = useState<number | null>(null);
    const [editingImage, setEditingImage] = useState<{ image: string; dbId: number } | null>(null);
    const [croppingConfig, setCroppingConfig] = useState<{ src: string; onComplete: (croppedDataUrl: string) => void; aspectRatios: AspectRatio[] } | null>(null);
    const [consolidatedSeoContent, setConsolidatedSeoContent] = useState<SeoContent | null>(null);

    const isTryonCancelledRef = useRef(false);
    const isPoseGenCancelledRef = useRef(false);

    useEffect(() => {
        const fetchData = async () => {
             const [avatarsData, productsData, locationsData] = await Promise.all([
                dbService.getAvatars(),
                dbService.getProducts(),
                dbService.getLocations()
            ]);
            setAvatars(avatarsData);
            setProducts(productsData);
            setLocations(locationsData);
        };
        fetchData();
    }, []);

    const isTryonReady = useMemo(() => productImage && modelImage, [productImage, modelImage]);
    
    const downloadImage = (base64Image: string, fileName: string) => {
        const link = document.createElement('a');
        link.href = base64Image;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleGenerateTryon = async () => {
        if (!isTryonReady) { setTryonError('Harap unggah foto produk dan model.'); return; }
        setIsTryonLoading(true); setTryonError(null); setTryonResult(null); setTryonDbId(null); isTryonCancelledRef.current = false;
        try {
            const resultBase64 = await cancellableRetry(
                () => fashionService.generateTryonImage(productImage.base64, productImage.mimeType, modelImage.base64, modelImage.mimeType),
                {
                    onRetry: (attempt) => setTryonError(`Gagal, mencoba lagi... (${attempt}/5)`),
                    isCancelled: () => isTryonCancelledRef.current
                }
            );
            const resultDataUrl = `data:image/png;base64,${resultBase64}`;
            setTryonResult(resultDataUrl);
            const newId = await dbService.addFashionHistoryItem({ type: 'tryon', inputImage1: productImage.dataUrl, inputImage2: modelImage.dataUrl, outputImage: resultDataUrl, createdAt: new Date().toISOString() });
            setTryonDbId(newId);
        } catch (err: any) { 
            if (err.message.includes("cancelled")) {
                 setTryonError('Proses dihentikan.');
            } else {
                setTryonError(err.message || 'Gagal membuat gambar try-on.');
            }
        } 
        finally { setIsTryonLoading(false); }
    };
    
    const handleUseResultForPosing = () => {
        if (!tryonResult) return;
        const mimeType = tryonResult.split(';')[0].split(':')[1];
        const base64 = tryonResult.split(',')[1];
        setPoseImage({ file: null, dataUrl: tryonResult, base64, mimeType, });
        setPoseResults([]); setActiveTab('poses');
    };

    const handlePoseSelectionChange = (pose: string, isChecked: boolean) => {
        setSelectedPoses(prev => isChecked ? (prev.length < 6 ? [...prev, pose] : prev) : prev.filter(p => p !== pose));
    };

    const handleGeneratePoses = async () => {
        if (!poseImage || selectedPoses.length === 0) { setPoseGenError("Unggah gambar dan pilih minimal 1 pose."); return; }
        setIsPoseModalOpen(false); setPoseGenError(null); setConsolidatedSeoContent(null); isPoseGenCancelledRef.current = false;
        const initialResults: PoseResult[] = selectedPoses.map((pose, id) => ({ id, pose, isLoading: true }));
        setPoseResults(initialResults);

        const location = locations.find(loc => loc.id === selectedLocationId);
        const batchId = `batch_${Date.now()}`;
        const generatedItems: { pose: string, dbId: number }[] = [];

        for (const pose of selectedPoses) {
            if (isPoseGenCancelledRef.current) {
                setPoseResults(prev => prev.map(r => ({ ...r, isLoading: false, error: 'Dibatalkan' })));
                setPoseGenError("Proses pembuatan pose dihentikan.");
                return; // Keluar dari fungsi
            }
            try {
                setPoseResults(prev => prev.map(r => r.pose === pose ? { ...r, error: "Membuat gambar..." } : r));
                const resultBase64 = await cancellableRetry(
                    () => fashionService.generatePoseImage(poseImage.base64, poseImage.mimeType, pose, location?.imageBase64),
                     {
                        onRetry: (attempt, err) => {
                           console.error(`Failed to generate pose (attempt ${attempt}): ${pose}`, err);
                           setPoseResults(prev => prev.map(r => r.pose === pose ? { ...r, error: `Gagal... (${attempt}/5)` } : r));
                        },
                        isCancelled: () => isPoseGenCancelledRef.current,
                    }
                );
                
                const resultDataUrl = `data:image/jpeg;base64,${resultBase64}`;
                
                setPoseResults(prev => prev.map(r => r.pose === pose ? { ...r, isLoading: false, imageUrl: resultDataUrl, error: "Membuat VEO..." } : r));
                const veoPrompt = await fashionService.generateVeoPromptForPose(resultBase64);

                const newItem: Omit<FashionHistoryItem, 'id' | 'seoContent'> = { 
                    type: 'pose', 
                    inputImage1: poseImage.dataUrl, 
                    outputImage: resultDataUrl, 
                    createdAt: new Date().toISOString(), 
                    veoPrompt,
                    batchId
                };
                const newId = await dbService.addFashionHistoryItem(newItem as FashionHistoryItem);
                generatedItems.push({ pose, dbId: newId });

                setPoseResults(prev => prev.map(r => r.pose === pose ? { ...r, isLoading: false, imageUrl: resultDataUrl, veoPrompt, dbId: newId, error: undefined } : r));
            } catch (err: any) {
                console.error(`Failed to generate pose: ${pose}`, err);
                const errorMessage = err.message.includes("cancelled") ? "Dibatalkan" : (err.message || "Gagal");
                setPoseResults(prev => prev.map(r => r.pose === pose ? { ...r, isLoading: false, error: errorMessage } : r));
            }
        }
        
        // Generate consolidated SEO after all poses are done
        const successfulPoses = generatedItems.length;
        if (successfulPoses > 0 && !isPoseGenCancelledRef.current) {
            try {
                 setPoseResults(prev => prev.map(r => r.imageUrl && !r.error ? { ...r, error: "Membuat SEO..." } : r));
                 const seoContext = `Konten media sosial untuk serangkaian foto fashion. Model menampilkan berbagai pose termasuk: ${selectedPoses.join(', ')}.`;
                 // FIX: Added the 'language' argument to the seoService.generateSeoContent call to match its definition.
                 const seoResult = await seoService.generateSeoContent(seoContext, 'Bahasa Indonesia');
                 setConsolidatedSeoContent(seoResult);

                 // Update all saved items with the same SEO content
                 const allItemsToUpdate = await dbService.getFashionHistoryItems();
                 const updatePromises = generatedItems.map(item => {
                     const historyItem = allItemsToUpdate.find(h => h.id === item.dbId);
                     if(historyItem) {
                        return dbService.updateFashionHistoryItem({ ...historyItem, seoContent: seoResult });
                     }
                     return Promise.resolve();
                 });
                 await Promise.all(updatePromises);
                 setPoseResults(prev => prev.map(r => ({ ...r, error: undefined })));

            } catch(err) {
                console.error("Failed to generate or save consolidated SEO", err);
                setPoseGenError("Gagal membuat SEO untuk pose.");
            }
        }

    };

    const handleAvatarSelect = (avatar: Avatar) => {
        setModelImage({ file: null, dataUrl: `data:image/jpeg;base64,${avatar.imageBase64}`, base64: avatar.imageBase64, mimeType: 'image/jpeg'});
    };

    const handleProductSelect = (product: Product) => {
        const dataUrl = `data:image/jpeg;base64,${product.imageBase64}`;
        setProductImage({
            file: null,
            dataUrl: dataUrl,
            base64: product.imageBase64,
            mimeType: 'image/jpeg'
        });
    };
    
    const handleImageEditSave = async (newImage: string) => {
        if (!editingImage) return;
        
        try {
            const itemToUpdate = await dbService.getFashionHistoryItems().then(items => items.find(i => i.id === editingImage.dbId));
            if (itemToUpdate) {
                await dbService.updateFashionHistoryItem({ ...itemToUpdate, outputImage: newImage });
            }
            
            if (tryonDbId === editingImage.dbId) {
                setTryonResult(newImage);
            } else {
                setPoseResults(prev => prev.map(r => r.dbId === editingImage.dbId ? { ...r, imageUrl: newImage } : r));
            }
            setEditingImage(null);
        } catch (err) {
            console.error("Failed to save edited image:", err);
            const errorSetter = tryonDbId === editingImage.dbId ? setTryonError : setPoseGenError;
            errorSetter("Gagal menyimpan gambar yang diedit.");
        }
    };

    const handleCopyToClipboard = (text: string, id: number) => {
        navigator.clipboard.writeText(text);
        setCopiedPromptId(id);
        setTimeout(() => setCopiedPromptId(null), 2000);
    };
    
    const imageUploadHandler = (data: ImageData, setter: (imageData: ImageData) => void) => {
        setCroppingConfig({
            src: data.dataUrl,
            onComplete: (croppedDataUrl) => {
                const base64 = croppedDataUrl.split(',')[1];
                setter({ file: data.file, dataUrl: croppedDataUrl, base64, mimeType: 'image/png' });
                setCroppingConfig(null);
            },
            aspectRatios: [
                { label: '9:16', ratio: 9 / 16 },
                { label: '3:4', ratio: 3 / 4 }
            ]
        });
    };

    const renderProductInput = () => (
        <div className="fashion-card p-4 flex flex-col">
            <h2 className="text-xl font-semibold mb-3 text-center text-gray-200">1. Pilih Produk</h2>
            <div className="flex justify-center mb-2 border border-gray-600 rounded-lg p-1 w-full">
                <button onClick={() => setProductInputMode('upload')} className={`w-1/2 py-1 rounded-md text-sm transition-colors ${productInputMode === 'upload' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>Unggah Baru</button>
                <button onClick={() => setProductInputMode('select')} className={`w-1/2 py-1 rounded-md text-sm transition-colors ${productInputMode === 'select' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>Pilih Tersimpan</button>
            </div>
            {productInputMode === 'upload' ? (
                <ImageUploader 
                    onFileUpload={(data) => imageUploadHandler(data, setProductImage)} 
                    previewUrl={productImage?.dataUrl}
                >
                    <div className="text-center text-gray-500"><p className="mt-2">Seret & lepas atau klik</p></div>
                </ImageUploader>
            ) : (
                <div className="w-full h-64 sm:h-80 flex-grow rounded-lg bg-gray-800/50 overflow-y-auto p-2">
                    {products.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                            {products.map(product => (
                                <div key={product.id} onClick={() => handleProductSelect(product)} className={`cursor-pointer rounded-md overflow-hidden border-2 ${productImage?.base64 === product.imageBase64 ? 'border-indigo-500' : 'border-transparent'}`}>
                                    <div className="relative aspect-square w-full overflow-hidden rounded-md bg-gray-900">
                                        <img src={`data:image/jpeg;base64,${product.imageBase64}`} alt="" className="absolute inset-0 h-full w-full object-cover blur-md scale-110" aria-hidden="true" />
                                        <img src={`data:image/jpeg;base64,${product.imageBase64}`} alt={product.name} className="relative h-full w-full object-contain" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-center text-gray-500 mt-4">Tidak ada produk tersimpan.</p>}
                </div>
            )}
        </div>
    );

    const renderModelInput = () => (
         <div className="fashion-card p-4 flex flex-col">
            <h2 className="text-xl font-semibold mb-3 text-center text-gray-200">2. Pilih Model</h2>
            <div className="flex justify-center mb-2 border border-gray-600 rounded-lg p-1 w-full">
                <button onClick={() => setModelInputMode('upload')} className={`w-1/2 py-1 rounded-md text-sm transition-colors ${modelInputMode === 'upload' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>Unggah Foto</button>
                <button onClick={() => setModelInputMode('select')} className={`w-1/2 py-1 rounded-md text-sm transition-colors ${modelInputMode === 'select' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>Pilih Avatar</button>
            </div>
            {modelInputMode === 'upload' ? (
                 <ImageUploader 
                    onFileUpload={(data) => imageUploadHandler(data, setModelImage)} 
                    previewUrl={modelImage?.dataUrl}
                >
                    <div className="text-center text-gray-500"><p className="mt-2">Seret & lepas atau klik</p></div>
                </ImageUploader>
            ) : (
                <div className="w-full h-64 sm:h-80 flex-grow rounded-lg bg-gray-800/50 overflow-y-auto p-2">
                    {avatars.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                            {avatars.map(avatar => (
                                <div key={avatar.id} onClick={() => handleAvatarSelect(avatar)} className={`cursor-pointer rounded-md overflow-hidden border-2 ${modelImage?.base64 === avatar.imageBase64 ? 'border-indigo-500' : 'border-transparent'}`}>
                                    <div className="relative aspect-square w-full overflow-hidden rounded-md bg-gray-900">
                                        <img src={`data:image/jpeg;base64,${avatar.imageBase64}`} alt="" className="absolute inset-0 h-full w-full object-cover blur-md scale-110" aria-hidden="true" />
                                        <img src={`data:image/jpeg;base64,${avatar.imageBase64}`} alt={avatar.name} className="relative h-full w-full object-contain" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-center text-gray-500 mt-4">Tidak ada avatar.</p>}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-8">
            <header className="text-center">
                <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500">Affiliate TryOn</h1>
                <p className="text-lg text-gray-400 mt-2">Solusi AI untuk mencoba pakaian secara virtual.</p>
            </header>
            <nav className="flex justify-center border-b-2 border-gray-700">
                <button onClick={() => setActiveTab('tryon')} className={`tab-btn px-6 py-3 font-semibold ${activeTab === 'tryon' ? 'active' : ''}`}>👗 Virtual Try-On</button>
                <button onClick={() => setActiveTab('poses')} className={`tab-btn px-6 py-3 font-semibold ${activeTab === 'poses' ? 'active' : ''}`}>💃 Pose Fashion</button>
            </nav>

            {activeTab === 'tryon' && (
                <div>
                    <main className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {renderProductInput()}
                            {renderModelInput()}
                        </div>
                        <div className="lg:col-span-1 fashion-card p-4 flex flex-col">
                            <h2 className="text-xl font-semibold mb-3 text-center text-gray-200">3. Hasil Generate AI</h2>
                            <div className="w-full flex-grow rounded-lg bg-gray-900/50 flex flex-col items-center justify-center">
                                {isTryonLoading && <div className="text-center p-4"><div className="tryon-loader mx-auto"></div><p className="mt-4 text-gray-400">AI bekerja...</p><button onClick={() => isTryonCancelledRef.current = true} className="mt-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-lg text-sm">Hentikan</button></div>}
                                {!isTryonLoading && tryonResult && (
                                    <div className="w-full h-full flex flex-col">
                                        <div className="flex-grow flex items-center justify-center overflow-hidden p-2">
                                            <img src={tryonResult} className="w-full h-full object-contain" alt="Hasil" />
                                        </div>
                                        <div className="p-2 bg-gray-800/70 flex justify-center gap-2 flex-wrap">
                                             <button onClick={() => tryonResult && tryonDbId && setEditingImage({image: tryonResult, dbId: tryonDbId})} className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold py-1.5 px-3 rounded-md transition-colors"><SparklesIcon className="w-4 h-4"/> Edit AI</button>
                                             <button onClick={handleUseResultForPosing} className="flex items-center gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold py-1.5 px-3 rounded-md transition-colors">💃 Gunakan untuk Pose</button>
                                             <button onClick={() => downloadImage(tryonResult, 'tryon_result.png')} className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white font-semibold py-1.5 px-3 rounded-md transition-colors"><DownloadIcon className="w-4 h-4" /> Unduh</button>
                                        </div>
                                    </div>
                                )}
                                {!isTryonLoading && !tryonResult && <p className="text-center text-gray-500">Hasil di sini</p>}
                            </div>
                        </div>
                    </main>
                    <footer className="w-full mt-6 text-center"><button onClick={handleGenerateTryon} disabled={!isTryonReady || isTryonLoading} className="btn-primary font-bold py-3 px-12 rounded-full shadow-lg text-lg">{isTryonLoading ? 'Memproses...' : 'Generate Gambar'}</button>{tryonError && <p className="text-red-500 mt-4 h-6">{tryonError}</p>}</footer>
                </div>
            )}

            {activeTab === 'poses' && (
                <div className="fashion-card p-6 md:p-10 w-full max-w-6xl mx-auto space-y-6">
                    {poseGenError && <p className="text-red-500 mb-4 text-center">{poseGenError}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                           <h3 className="text-lg font-semibold text-center mb-2">1. Unggah Model</h3>
                            <ImageUploader 
                                onFileUpload={(data) => imageUploadHandler(data, setPoseImage)} 
                                previewUrl={poseImage?.dataUrl}
                            >
                               <div className="text-center text-gray-500"><p className="font-semibold text-lg">Klik/seret gambar</p><p className="text-sm text-gray-500 mt-1">PNG, JPG</p></div>
                            </ImageUploader>
                           {poseImage && <p className="text-center text-sm text-gray-500 mt-2">{poseImage.file?.name || 'Gambar dari Try-On'}</p>}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-center mb-2">2. Pilih Lokasi (Opsional)</h3>
                            <div className="w-full h-64 sm:h-80 flex-grow rounded-lg bg-gray-800/50 overflow-y-auto p-2">
                                {locations.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {locations.map(loc => (
                                            <div key={loc.id} onClick={() => setSelectedLocationId(selectedLocationId === loc.id ? null : loc.id)} className={`cursor-pointer rounded-md overflow-hidden border-2 ${selectedLocationId === loc.id ? 'border-indigo-500' : 'border-transparent'}`}>
                                                <div className="relative aspect-square w-full overflow-hidden rounded-md bg-gray-900">
                                                    <img src={`data:image/jpeg;base64,${loc.imageBase64}`} alt="" className="absolute inset-0 h-full w-full object-cover blur-md scale-110" aria-hidden="true" />
                                                    <img src={`data:image/jpeg;base64,${loc.imageBase64}`} alt={loc.name} className="relative h-full w-full object-contain" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-center text-gray-500 mt-4">Tidak ada lokasi tersimpan.</p>}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                         {poseResults.some(r => r.isLoading) ? (
                            <button onClick={() => isPoseGenCancelledRef.current = true} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg">
                                Hentikan Proses
                            </button>
                        ) : (
                            <button onClick={() => setIsPoseModalOpen(true)} disabled={!poseImage} className="btn-primary font-bold py-3 px-8 rounded-lg">
                                Pilih Hingga 6 Pose
                            </button>
                        )}
                    </div>
                    {poseResults.length > 0 && (
                        <div className="mt-10">
                            <h2 className="text-2xl font-bold text-center mb-6">Hasil Pose</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                                {poseResults.map(r => (
                                    <div key={r.id} className="bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700 flex flex-col">
                                        <div className="w-full aspect-[9/16] flex items-center justify-center relative bg-gray-900">
                                            {r.isLoading && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>}
                                            {r.imageUrl && <img src={r.imageUrl} alt={r.pose} className="w-full h-full object-cover"/>}
                                            {r.error && <p className="p-2 text-center text-red-400 text-xs">{r.error}</p>}
                                        </div>
                                        <div className='p-2 space-y-2 mt-auto'>
                                            <p className="text-xs text-gray-400 leading-tight h-10">{r.pose}</p>
                                            {r.imageUrl && (
                                                <div className="flex gap-2">
                                                    <button onClick={() => downloadImage(r.imageUrl!, `pose_${r.id}.png`)} className="flex-1 text-xs flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-bold p-2 rounded-md"><DownloadIcon className="w-4 h-4 mr-1" /> Unduh</button>
                                                    <button onClick={() => r.imageUrl && r.dbId && setEditingImage({image: r.imageUrl, dbId: r.dbId})} className="flex-1 text-xs flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-bold p-2 rounded-md"><SparklesIcon className="w-4 h-4 mr-1"/> Edit</button>
                                                </div>
                                            )}
                                            {r.veoPrompt && (
                                                <button onClick={() => handleCopyToClipboard(r.veoPrompt as string, r.id)} className="w-full text-xs flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white font-bold p-2 rounded-md">
                                                    {copiedPromptId === r.id ? (<><CheckIcon className="w-4 h-4 mr-1 text-green-400"/> Disalin!</>) : (<><ClipboardIcon className="w-4 h-4 mr-1"/> Salin Prompt VEO</>)}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-center gap-4 mt-8">
                                <a href="https://labs.google/fx/tools/flow" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 btn-primary font-semibold py-2 px-4 rounded-lg">
                                    <ExternalLinkIcon className="w-5 h-5"/>
                                    Buat Di Flow AI
                                </a>
                                <a href="https://gemini.google.com/?hl=id" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 btn-primary font-semibold py-2 px-4 rounded-lg">
                                    <ExternalLinkIcon className="w-5 h-5"/>
                                    Buat Di Gemini
                                </a>
                            </div>
                            {consolidatedSeoContent && (
                                <div className="mt-8">
                                    <h2 className="text-2xl font-bold text-center mb-4">Judul, Deskripsi & Tagar (Untuk Semua Pose)</h2>
                                    <SeoDisplay content={consolidatedSeoContent} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
             {isPoseModalOpen && (<div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"><div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh]"><div className="p-6 border-b border-gray-700"><h3 className="text-2xl font-bold">Pilih Hingga 6 Pose</h3><p className="text-gray-400">Terpilih: <span className="font-bold">{selectedPoses.length}</span>/6</p></div><div className="p-6 overflow-y-auto pose-list-container">{ALL_POSES.map(pose => (<div key={pose} className="flex items-center p-3 rounded-lg hover:bg-gray-700"><input type="checkbox" id={pose} value={pose} checked={selectedPoses.includes(pose)} disabled={selectedPoses.length >= 6 && !selectedPoses.includes(pose)} onChange={(e) => handlePoseSelectionChange(pose, e.target.checked)} className="w-5 h-5 bg-gray-600 border-gray-500 rounded text-purple-500 focus:ring-purple-500 cursor-pointer" /><label htmlFor={pose} className="ml-3 text-gray-300 cursor-pointer">{pose}</label></div>))}</div><div className="p-6 border-t border-gray-700 flex justify-end gap-4"><button onClick={() => setIsPoseModalOpen(false)} className="bg-gray-600 text-gray-200 font-semibold py-2 px-6 rounded-lg hover:bg-gray-500">Batal</button><button onClick={handleGeneratePoses} disabled={selectedPoses.length === 0} className="btn-primary font-bold py-2 px-6 rounded-lg">Buat Pose</button></div></div></div>)}
            {editingImage && (
                <ImageEditor
                    src={editingImage.image}
                    onSave={handleImageEditSave}
                    onClose={() => setEditingImage(null)}
                />
            )}
             {croppingConfig && (
                <ImageCropper
                    src={croppingConfig.src}
                    onCrop={croppingConfig.onComplete}
                    onClose={() => setCroppingConfig(null)}
                    aspectRatios={croppingConfig.aspectRatios}
                    defaultAspectRatio={9 / 16}
                />
            )}
        </div>
    );
};

export default FashionManager;