import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { dbService } from '../services/db';
import * as avatarService from '../services/gemini/avatarService';
import * as locationService from '../services/gemini/locationService';
import * as productService from '../services/gemini/productService';
import { Avatar, Product, Location } from '../types';
import Loader from './Loader';
import Card from './Card';
import { SparklesIcon, DownloadIcon, PencilIcon, TrashIcon } from './icons/Icons';
import ImageCropper from './ImageCropper';
import ImageEditor from './ImageEditor';
import { AuthContext, AuthContextType } from '../contexts/AuthContext';
import { ImageGenerationAuthError } from '../services/gemini/sandboxImageService';

type Tab = 'avatar' | 'location';
type AvatarMode = 'generate' | 'upload';
type LocationMode = 'upload' | 'generate';

// FIX: Add visual style options for avatar generation.
const VISUAL_STYLES = [
    { value: 'Photorealistic', label: 'Fotorealistik (Mirip Manusia)' },
    { value: '3D Cartoon (Gaya Pixar)', label: 'Anomali / Disney / Pixar' },
    { value: 'Anime Shounen', label: 'Anime Shounen (Gaya Naruto/Bleach)' },
    { value: 'abstract', label: 'Abstrak' },
    { value: 'anime', label: 'Anime' },
    { value: 'art deco', label: 'Art Deco' },
    { value: 'art nouveau', label: 'Art Nouveau' },
    { value: 'comic book', label: 'Buku Komik' },
    { value: 'watercolor', label: 'Cat Air' },
    { value: 'blueprint', label: 'Cetak Biru' },
    { value: 'claymation', label: 'Claymation' },
    { value: 'cyberpunk', label: 'Cyberpunk' },
    { value: 'enhance', label: 'Detail Tinggi' },
    { value: 'dark fantasy', label: 'Fantasi Gelap' },
    { value: 'analog film', label: 'Film Analog' },
    { value: 'photographic', label: 'Fotografis' },
    { value: 'futuristic', label: 'Futuristik' },
    { value: 'graffiti', label: 'Grafiti' },
    { value: 'dark cartoon horror illustration, cinematic comic style', label: 'Horor Kartun Sinematik' },
    { value: 'illustration', label: 'Ilustrasi' },
    { value: 'impressionism', label: 'Impresionisme' },
    { value: 'isometric', label: 'Isometrik' },
    { value: 'stained glass', label: 'Kaca Patri' },
    { value: 'low poly', label: 'Low Poly' },
    { value: 'minimalist', label: 'Minimalis' },
    { value: '3d model', label: 'Model 3D' },
    { value: '3D Render', label: 'Model 3D (Gaya Final Fantasy)' },
    { value: 'national geographic', label: 'National Geographic' },
    { value: 'neon punk', label: 'Neon Punk' },
    { value: 'origami', label: 'Origami' },
    { value: 'retro', label: 'Retro' },
    { value: 'concept art', label: 'Seni Konsep' },
    { value: 'digital art', label: 'Seni Digital' },
    { value: 'fantasy art', label: 'Seni Fantasi' },
    { value: 'line art', label: 'Seni Garis' },
    { value: 'pixel art', label: 'Seni Piksel' },
    { value: 'pop art', label: 'Seni Pop' },
    { value: 'vector art', label: 'Seni Vektor' },
    { value: 'cinematic', label: 'Sinematik' },
    { value: 'charcoal sketch', label: 'Sketsa Arang' },
    { value: 'steampunk', label: 'Steampunk' },
    { value: 'surrealism', label: 'Surealisme' },
    { value: 'synthwave', label: 'Synthwave' },
    { value: 'ukiyo-e', label: 'Ukiyo-e' },
    { value: 'vaporwave', label: 'Vaporwave' },
    { value: 'vintage', label: 'Vintage' },
];

const AssetManager: React.FC = () => {
    const { token, refreshToken } = useContext(AuthContext) as AuthContextType;
    const [activeTab, setActiveTab] = useState<Tab>('avatar');

    // Generic states
    const [editingAsset, setEditingAsset] = useState<{ type: Tab, id: number } | null>(null);
    const [editedName, setEditedName] = useState('');
    const [editedDesc, setEditedDesc] = useState('');
    const [editingAssetImage, setEditingAssetImage] = useState<{ image: string; type: Tab; id: number } | null>(null);

    // Avatar State
    const [avatarMode, setAvatarMode] = useState<AvatarMode>('generate');
    const [generatePrompt, setGeneratePrompt] = useState<string>('A beautiful Indonesian woman, 25 years old, smiling warmly');
    // FIX: Add state for the selected avatar visual style.
    const [avatarVisualStyle, setAvatarVisualStyle] = useState(VISUAL_STYLES[0].value);
    const [avatarName, setAvatarName] = useState<string>('');
    const [avatarGender, setAvatarGender] = useState<'Pria' | 'Wanita'>('Wanita');
    const [editedAvatarGender, setEditedAvatarGender] = useState<'Pria' | 'Wanita'>('Wanita');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isAvatarLoading, setIsAvatarLoading] = useState<boolean>(false);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [avatars, setAvatars] = useState<Avatar[]>([]);
    const [croppingModelImage, setCroppingModelImage] = useState<string | null>(null);
    const isAvatarCancelledRef = useRef(false);

    // Product State
    const [productName, setProductName] = useState('');
    const [productDesc, setProductDesc] = useState('');
    const [productImage, setProductImage] = useState<string | null>(null);
    const [productError, setProductError] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [isProductDragging, setIsProductDragging] = useState(false);
    const [croppingProductImage, setCroppingProductImage] = useState<string | null>(null);
    const [isOptimizingDesc, setIsOptimizingDesc] = useState(false);

    // Location State
    const [locationMode, setLocationMode] = useState<LocationMode>('upload');
    const [locationName, setLocationName] = useState('');
    const [locationImage, setLocationImage] = useState<string | null>(null); // For upload flow
    const [locationError, setLocationError] = useState<string | null>(null);
    const [locations, setLocations] = useState<Location[]>([]);
    const [croppingLocationImage, setCroppingLocationImage] = useState<string | null>(null);
    const [isLocationLoading, setIsLocationLoading] = useState<boolean>(false);
    const [locationGeneratePrompt, setLocationGeneratePrompt] = useState<string>('A modern, minimalist living room with a large window and natural light');
    const [generatedLocationImage, setGeneratedLocationImage] = useState<string | null>(null);
    const isLocationCancelledRef = useRef(false);


    // --- Data Fetching ---
    const fetchAllAssets = useCallback(async () => {
        try {
            const [savedAvatars, savedProducts, savedLocations] = await Promise.all([
                dbService.getAvatars(),
                dbService.getProducts(),
                dbService.getLocations()
            ]);
            setAvatars(savedAvatars);
            setProducts(savedProducts);
            setLocations(savedLocations);
        } catch (err) {
            console.error("Failed to fetch assets:", err);
            setAvatarError("Gagal memuat aset dari database.");
        }
    }, []);

    useEffect(() => {
        fetchAllAssets();
    }, [fetchAllAssets]);
    
    // --- Generic Functions ---
    const handleStartEdit = (item: Avatar | Product | Location, type: Tab) => {
        setEditingAsset({ type, id: item.id! });
        setEditedName(item.name);
        if (type === 'avatar' && 'gender' in item) {
            setEditedAvatarGender(item.gender || 'Wanita');
        }
    };

    const handleCancelEdit = () => {
        setEditingAsset(null);
        setEditedName('');
        setEditedDesc('');
    };

    const handleSaveEdit = async () => {
        if (!editingAsset) return;

        try {
            switch (editingAsset.type) {
                case 'avatar':
                    const avatarToUpdate = avatars.find(a => a.id === editingAsset.id);
                    if (avatarToUpdate) {
                        await dbService.updateAvatar({ ...avatarToUpdate, name: editedName, gender: editedAvatarGender });
                    }
                    break;
                case 'location':
                    const locationToUpdate = locations.find(l => l.id === editingAsset.id);
                    if (locationToUpdate) {
                        await dbService.updateLocation({ ...locationToUpdate, name: editedName });
                    }
                    break;
            }
            await fetchAllAssets();
            handleCancelEdit();
        } catch (err) {
            console.error("Failed to save asset:", err);
            // Optionally set an error state for the specific tab
        }
    };
    
    const handleImageEditSave = async (newImage: string) => {
        if (!editingAssetImage) return;

        const base64 = newImage.split(',')[1];

        try {
            if (editingAssetImage.type === 'avatar') {
                const avatarToUpdate = avatars.find(a => a.id === editingAssetImage.id);
                if (avatarToUpdate) {
                    await dbService.updateAvatar({ ...avatarToUpdate, imageBase64: base64 });
                }
            } else if (editingAssetImage.type === 'location') {
                const locationToUpdate = locations.find(l => l.id === editingAssetImage.id);
                if (locationToUpdate) {
                    await dbService.updateLocation({ ...locationToUpdate, imageBase64: base64 });
                }
            }
            await fetchAllAssets(); // Re-fetch to update UI
            setEditingAssetImage(null);
        } catch (err) {
            const errorSetter = editingAssetImage.type === 'avatar' ? setAvatarError : setLocationError;
            errorSetter("Gagal menyimpan gambar yang telah diedit.");
        }
    };
    
    const downloadImage = (base64Image: string, fileName: string) => {
        const link = document.createElement('a');
        link.href = `data:image/jpeg;base64,${base64Image}`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Avatar Logic ---
    const handleDeleteAvatar = async (id: number) => {
        try {
            await dbService.deleteAvatar(id);
            setAvatars(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            setAvatarError("Gagal menghapus avatar.");
        }
    };
    const handleGenerateAvatar = async () => {
        if (!generatePrompt) { setAvatarError('Prompt tidak boleh kosong.'); return; }
        if (!token) { setAvatarError('Token otentikasi tidak ditemukan. Coba perbarui di Pengaturan.'); return; }
        setIsAvatarLoading(true); setAvatarError(null); setGeneratedImage(null);
        isAvatarCancelledRef.current = false;

        try {
            const imageBase64 = await avatarService.generateAvatarImage(generatePrompt, avatarVisualStyle, token);
             if (isAvatarCancelledRef.current) throw new Error("Operation cancelled by user.");
            setGeneratedImage(imageBase64);
        } catch (error: any) {
             if (error instanceof ImageGenerationAuthError) {
                setAvatarError("Token tidak valid. Memperbarui token...");
                try {
                    await refreshToken();
                    setAvatarError("Token telah diperbarui. Silakan coba buat avatar lagi.");
                } catch (refreshError: any) {
                     setAvatarError(`Gagal memperbarui token: ${refreshError.message}`);
                }
            } else if (error.message.includes("cancelled")) {
                setAvatarError('Proses dihentikan.');
            } else {
                setAvatarError(`Gagal membuat avatar: ${error.message}`);
            }
        } finally {
            setIsAvatarLoading(false);
        }
    };
    
    const handleModelImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
            setAvatarError(null);
            const reader = new FileReader();
            reader.onloadend = () => {
                setCroppingModelImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleModelCropComplete = (croppedImageUrl: string) => {
        // We expect a data URL, get the base64 part
        setGeneratedImage(croppedImageUrl.split(',')[1]);
        setCroppingModelImage(null);
    };

    const handleSaveAvatar = async () => {
        if (!generatedImage || !avatarName) { setAvatarError('Nama avatar dan gambar harus ada untuk menyimpan.'); return; }
        const newAvatar: Avatar = { name: avatarName, imageBase64: generatedImage, gender: avatarGender };
        try {
            await dbService.addAvatar(newAvatar);
            setGeneratedImage(null);
            setAvatarName('');
            setGeneratePrompt('A handsome man from Europe, 30s, professional look');
            setAvatarGender('Wanita');
            fetchAllAssets();
        } catch (err) { console.error(err); setAvatarError('Gagal menyimpan avatar.'); }
    };

    // --- Product Logic ---
    const handleOptimizeDesc = async () => {
        if (!productName) {
            setProductError("Nama produk harus diisi terlebih dahulu.");
            return;
        }
        setProductError(null);
        setIsOptimizingDesc(true);
        try {
            const optimizedDesc = await productService.optimizeDescription(productName, productDesc);
            setProductDesc(optimizedDesc);
        } catch (err) {
            console.error("Failed to optimize description:", err);
            setProductError("Gagal mengoptimalkan deskripsi.");
        } finally {
            setIsOptimizingDesc(false);
        }
    };
    const handleDeleteProduct = async (id: number) => {
        try {
            await dbService.deleteProduct(id);
            setProducts(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            setProductError("Gagal menghapus produk.");
        }
    };
    const processProductFile = (file: File) => {
        if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
            setProductError(null);
            const reader = new FileReader();
            reader.onloadend = async () => {
                setCroppingProductImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else { setProductError("Silakan unggah file PNG atau JPG."); }
    };

    const handleProductCropComplete = (croppedImageUrl: string) => {
        setProductImage(croppedImageUrl);
        setCroppingProductImage(null);
    };

    const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) processProductFile(e.target.files[0]); };
    const handleProductDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsProductDragging(false);
        if (e.dataTransfer.files?.[0]) processProductFile(e.dataTransfer.files[0]);
    };
    const handleSaveProduct = async () => {
        if (!productName || !productImage) { setProductError('Nama produk dan gambar harus diisi.'); return; }
        setProductError(null);
        const newProduct: Product = { name: productName, description: productDesc, imageBase64: productImage.split(',')[1] };
        try {
            await dbService.addProduct(newProduct);
            setProductName(''); setProductDesc(''); setProductImage(null);
            fetchAllAssets();
        } catch (err) { console.error(err); setProductError('Gagal menyimpan produk.'); }
    };

    // --- Location Logic ---
    const handleDeleteLocation = async (id: number) => {
        try {
            await dbService.deleteLocation(id);
            setLocations(prev => prev.filter(l => l.id !== id));
        } catch (err) {
            setLocationError("Gagal menghapus lokasi.");
        }
    };
    const handleLocationImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
            setLocationError(null);
            const reader = new FileReader();
            reader.onloadend = () => setCroppingLocationImage(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setLocationError("Silakan unggah file PNG atau JPG.");
        }
    };

    const handleLocationCropComplete = (croppedImageUrl: string) => {
        setLocationImage(croppedImageUrl);
        setCroppingLocationImage(null);
    };

    const handleSaveLocation = async () => {
        if (!locationName || !locationImage) { setLocationError('Nama dan gambar lokasi harus diisi.'); return; }
        setLocationError(null);
        const newLocation: Location = { name: locationName, imageBase64: locationImage.split(',')[1] };
        try {
            await dbService.addLocation(newLocation);
            setLocationName(''); setLocationImage(null);
            fetchAllAssets();
        } catch (err) { console.error(err); setLocationError('Gagal menyimpan lokasi.'); }
    };
    
    const handleGenerateLocation = async () => {
        if (!locationGeneratePrompt) { setLocationError('Prompt tidak boleh kosong.'); return; }
        if (!token) { setLocationError('Token otentikasi tidak ditemukan. Coba perbarui di Pengaturan.'); return; }
        setIsLocationLoading(true); setLocationError(null); setGeneratedLocationImage(null);
        isLocationCancelledRef.current = false;

        try {
            const imageBase64 = await locationService.generateLocationImage(locationGeneratePrompt, token);
            if (isLocationCancelledRef.current) throw new Error("Operation cancelled by user.");
            setGeneratedLocationImage(imageBase64);
        } catch (error: any) {
            if (error instanceof ImageGenerationAuthError) {
                setLocationError("Token tidak valid. Memperbarui token...");
                 try {
                    await refreshToken();
                    setLocationError("Token telah diperbarui. Silakan coba buat lokasi lagi.");
                } catch (refreshError: any) {
                     setLocationError(`Gagal memperbarui token: ${refreshError.message}`);
                }
            } else if (error.message.includes("cancelled")) {
                 setLocationError('Proses dihentikan.');
            } else {
                setLocationError(`Gagal membuat lokasi: ${error.message}`);
            }
        } finally {
            setIsLocationLoading(false);
        }
    };

    const handleSaveGeneratedLocation = async () => {
        if (!generatedLocationImage || !locationName) { setLocationError('Nama lokasi dan gambar harus ada untuk menyimpan.'); return; }
        const newLocation: Location = { name: locationName, imageBase64: generatedLocationImage };
        try {
            await dbService.addLocation(newLocation);
            setGeneratedLocationImage(null);
            setLocationName('');
            fetchAllAssets();
        } catch (err) { console.error(err); setLocationError('Gagal menyimpan lokasi.'); }
    };
    
    const renderAvatarTab = () => (
        <div className="space-y-8">
            <Card className="p-6">
                <div className="flex justify-center mb-4 border border-gray-600 rounded-lg p-1 w-full max-w-sm mx-auto">
                    <button onClick={() => { setAvatarMode('generate'); setGeneratedImage(null); setAvatarError(null); }} className={`w-1/2 py-2 rounded-md text-sm font-semibold transition-colors ${avatarMode === 'generate' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>Generate AI</button>
                    <button onClick={() => { setAvatarMode('upload'); setGeneratedImage(null); setAvatarError(null); }} className={`w-1/2 py-2 rounded-md text-sm font-semibold transition-colors ${avatarMode === 'upload' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>Upload Model</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {avatarMode === 'generate' ? (
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-indigo-400">Generate Avatar Baru</h2>
                            <div>
                                <label htmlFor="prompt" className="block mb-2 text-sm font-medium text-gray-300">Deskripsi Avatar (Prompt)</label>
                                <textarea id="prompt" rows={4} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white" value={generatePrompt} onChange={(e) => setGeneratePrompt(e.target.value)} />
                            </div>
                            {/* FIX: Add a selector for the visual style. */}
                            <div>
                                <label htmlFor="visualStyle" className="block mb-2 text-sm font-medium text-gray-300">Gaya Visual</label>
                                <select id="visualStyle" value={avatarVisualStyle} onChange={(e) => setAvatarVisualStyle(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white">
                                    {VISUAL_STYLES.map(style => <option key={style.value} value={style.value}>{style.label}</option>)}
                                </select>
                            </div>
                            <button onClick={handleGenerateAvatar} disabled={isAvatarLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 text-white font-bold py-3 px-4 rounded-lg">
                                {isAvatarLoading ? 'Membuat...' : 'Buat Gambar Avatar'}
                            </button>
                        </div>
                    ) : (
                         <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-indigo-400">Upload Foto Model</h2>
                            <p className="text-sm text-gray-400">Unggah foto model Anda. Anda akan diminta untuk memotong gambar ke rasio 3:4 atau 9:16.</p>
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-300">File Gambar</label>
                                <div className="flex items-center justify-center w-full">
                                    <label htmlFor="model-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700/50 hover:bg-gray-700">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <p className="text-sm text-gray-400">Klik atau seret file</p>
                                        </div>
                                        <input id="model-upload" type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleModelImageUpload} />
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col items-center justify-center bg-gray-700/50 rounded-lg p-4 min-h-[250px]">
                        {isAvatarLoading && <Loader text="AI sedang bekerja..." onCancel={() => isAvatarCancelledRef.current = true} />}
                        {avatarError && !isAvatarLoading && <p className="text-red-400">{avatarError}</p>}
                        {generatedImage && (
                            <div className="text-center space-y-4 w-full">
                                 <img src={`data:image/jpeg;base64,${generatedImage}`} alt="Generated Avatar" className="rounded-lg max-w-xs mx-auto shadow-lg" />
                                <div>
                                    <label htmlFor="avatarName" className="block mb-2 text-sm font-medium text-gray-300">Nama Avatar/Model</label>
                                    <input type="text" id="avatarName" className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white" value={avatarName} onChange={(e) => setAvatarName(e.target.value)} placeholder="e.g., Model Pria Profesional" />
                                </div>
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-gray-300">Jenis Kelamin</label>
                                    <div className="flex justify-center gap-6 bg-gray-700 border border-gray-600 rounded-lg p-2">
                                        <label className="flex items-center cursor-pointer">
                                            <input type="radio" name="gender" value="Wanita" checked={avatarGender === 'Wanita'} onChange={() => setAvatarGender('Wanita')} className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-500 focus:ring-indigo-600 ring-offset-gray-800 focus:ring-2"/>
                                            <span className="ml-2 text-sm font-medium text-gray-300">Wanita</span>
                                        </label>
                                        <label className="flex items-center cursor-pointer">
                                            <input type="radio" name="gender" value="Pria" checked={avatarGender === 'Pria'} onChange={() => setAvatarGender('Pria')} className="w-4 h-4 text-indigo-600 bg-gray-900 border-gray-500 focus:ring-indigo-600 ring-offset-gray-800 focus:ring-2"/>
                                            <span className="ml-2 text-sm font-medium text-gray-300">Pria</span>
                                        </label>
                                    </div>
                                </div>
                                <button onClick={handleSaveAvatar} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg">Simpan Avatar</button>
                            </div>
                        )}
                        {!isAvatarLoading && !generatedImage && <p className="text-gray-400">Hasil akan muncul di sini.</p>}
                    </div>
                </div>
            </Card>
            <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Avatar Tersimpan</h2>
                {avatars.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {avatars.map((avatar) => (
                             (editingAsset && editingAsset.type === 'avatar' && editingAsset.id === avatar.id) ? (
                                <Card key={avatar.id} className="p-2 space-y-2 flex flex-col justify-between">
                                    <input type="text" value={editedName} onChange={(e) => setEditedName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded p-1 text-xs" />
                                    <div className="flex justify-around gap-1 bg-gray-700 border border-gray-600 rounded p-1">
                                        <label className="flex items-center cursor-pointer text-xs">
                                            <input type="radio" name={`gender-edit-${avatar.id}`} value="Wanita" checked={editedAvatarGender === 'Wanita'} onChange={() => setEditedAvatarGender('Wanita')} className="w-3 h-3 text-indigo-600 bg-gray-900 border-gray-500 focus:ring-indigo-600"/>
                                            <span className="ml-1">W</span>
                                        </label>
                                        <label className="flex items-center cursor-pointer text-xs">
                                            <input type="radio" name={`gender-edit-${avatar.id}`} value="Pria" checked={editedAvatarGender === 'Pria'} onChange={() => setEditedAvatarGender('Pria')} className="w-3 h-3 text-indigo-600 bg-gray-900 border-gray-500 focus:ring-indigo-600"/>
                                            <span className="ml-1">P</span>
                                        </label>
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        <button onClick={handleSaveEdit} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-xs">Simpan</button>
                                        <button onClick={handleCancelEdit} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-1 px-2 rounded text-xs">Batal</button>
                                    </div>
                                </Card>
                             ) : (
                                <Card key={avatar.id} className="p-2 text-center flex flex-col">
                                    <div className="relative aspect-square w-full overflow-hidden rounded-md bg-gray-900">
                                        <img src={`data:image/jpeg;base64,${avatar.imageBase64}`} alt="" className="absolute inset-0 h-full w-full object-cover blur-md scale-110" aria-hidden="true" />
                                        <img src={`data:image/jpeg;base64,${avatar.imageBase64}`} alt={avatar.name} className="relative h-full w-full object-contain" />
                                    </div>
                                    <div className="flex-grow flex flex-col justify-between">
                                        <p className="text-sm font-medium truncate mt-2">{avatar.name}</p>
                                        <div className="grid grid-cols-2 gap-1.5 mt-2">
                                            <button onClick={() => downloadImage(avatar.imageBase64, `${avatar.name.replace(/\s+/g, '_')}.jpg`)} className="flex items-center justify-center gap-1 text-xs bg-gray-700 hover:bg-green-600 text-white font-semibold py-1.5 px-2 rounded-md transition-colors">
                                                <DownloadIcon className="w-3 h-3" />
                                                <span>Unduh</span>
                                            </button>
                                            <button onClick={() => handleStartEdit(avatar, 'avatar')} className="flex items-center justify-center gap-1 text-xs bg-gray-700 hover:bg-blue-600 text-white font-semibold py-1.5 px-2 rounded-md transition-colors">
                                                <PencilIcon className="w-3 h-3" />
                                                <span>Edit</span>
                                            </button>
                                            <button onClick={() => setEditingAssetImage({ image: `data:image/jpeg;base64,${avatar.imageBase64}`, type: 'avatar', id: avatar.id! })} className="flex items-center justify-center gap-1 text-xs bg-gray-700 hover:bg-purple-600 text-white font-semibold py-1.5 px-2 rounded-md transition-colors">
                                                <SparklesIcon className="w-3 h-3" />
                                                <span>Ulang (AI)</span>
                                            </button>
                                            <button onClick={() => handleDeleteAvatar(avatar.id!)} className="flex items-center justify-center gap-1 text-xs bg-gray-700 hover:bg-red-600 text-white font-semibold py-1.5 px-2 rounded-md transition-colors">
                                                <TrashIcon className="w-3 h-3" />
                                                <span>Hapus</span>
                                            </button>
                                        </div>
                                    </div>
                                </Card>
                            )
                        ))}
                    </div>
                ) : <p className="text-gray-400">Belum ada avatar yang disimpan.</p>}
            </div>
        </div>
    );
    
    const renderLocationTab = () => (
        <div className="space-y-8">
            <Card className="p-6">
                <div className="flex justify-center mb-6 border border-gray-600 rounded-lg p-1 w-full max-w-sm mx-auto">
                    <button onClick={() => { setLocationMode('upload'); setLocationError(null); }} className={`w-1/2 py-2 rounded-md text-sm font-semibold transition-colors ${locationMode === 'upload' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>Upload Lokasi</button>
                    <button onClick={() => { setLocationMode('generate'); setLocationError(null); }} className={`w-1/2 py-2 rounded-md text-sm font-semibold transition-colors ${locationMode === 'generate' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>Generate AI</button>
                </div>
                {locationMode === 'upload' ? (
                    <div>
                        <h2 className="text-xl font-semibold text-indigo-400 mb-4 text-center">Tambah Lokasi dari File</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">1. Upload Gambar</label>
                                    <label htmlFor="location-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700/50 hover:bg-gray-700">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            {locationImage ? <img src={locationImage} alt="Preview" className="max-h-40 rounded-lg"/> : <p className="text-sm text-gray-400">Klik atau seret file</p>}
                                        </div>
                                        <input id="location-upload" type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleLocationImageUpload} />
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="locationNameUpload" className="block mb-2 text-sm font-medium text-gray-300">2. Beri Nama Lokasi</label>
                                    <input type="text" id="locationNameUpload" className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="e.g., Kafe Senja"/>
                                </div>
                                <button onClick={handleSaveLocation} disabled={!locationImage || !locationName} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg">
                                    Simpan Lokasi
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-indigo-400">Generate Lokasi Baru</h2>
                            <div>
                                <label htmlFor="locationPrompt" className="block mb-2 text-sm font-medium text-gray-300">Deskripsi Lokasi (Prompt)</label>
                                <textarea id="locationPrompt" rows={4} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white" value={locationGeneratePrompt} onChange={(e) => setLocationGeneratePrompt(e.target.value)} />
                            </div>
                            <button onClick={handleGenerateLocation} disabled={isLocationLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 text-white font-bold py-3 px-4 rounded-lg">
                                {isLocationLoading ? 'Membuat...' : 'Buat Gambar Lokasi'}
                            </button>
                        </div>
                        <div className="flex flex-col items-center justify-center bg-gray-700/50 rounded-lg p-4 min-h-[250px]">
                            {isLocationLoading && <Loader text="AI sedang bekerja..." onCancel={() => isLocationCancelledRef.current = true} />}
                            {locationError && !isLocationLoading && <p className="text-red-400">{locationError}</p>}
                            {generatedLocationImage && (
                                <div className="text-center space-y-4 w-full">
                                    <img src={`data:image/jpeg;base64,${generatedLocationImage}`} alt="Generated Location" className="rounded-lg max-w-xs mx-auto shadow-lg" />
                                    <div>
                                        <label htmlFor="locationName" className="block mb-2 text-sm font-medium text-gray-300">Nama Lokasi</label>
                                        <input type="text" id="locationName" className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="e.g., Ruang Tamu Modern" />
                                    </div>
                                    <button onClick={handleSaveGeneratedLocation} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg">Simpan Lokasi</button>
                                </div>
                            )}
                            {!isLocationLoading && !generatedLocationImage && <p className="text-gray-400">Hasil akan muncul di sini.</p>}
                        </div>
                    </div>
                )}
                 {locationError && <p className="text-red-400 text-center mt-4">{locationError}</p>}
            </Card>

            <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Lokasi Tersimpan</h2>
                {locations.length > 0 ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">{locations.map((l) => (
                    (editingAsset && editingAsset.type === 'location' && editingAsset.id === l.id) ? (
                        <Card key={l.id} className="p-2 space-y-2 flex flex-col justify-between">
                             <input type="text" value={editedName} onChange={(e) => setEditedName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded p-1 text-xs" />
                            <div className="flex gap-2 mt-1">
                                <button onClick={handleSaveEdit} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-xs">Simpan</button>
                                <button onClick={handleCancelEdit} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-1 px-2 rounded text-xs">Batal</button>
                            </div>
                        </Card>
                    ) : (
                     <Card key={l.id} className="p-2 text-center group relative">
                        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleDeleteLocation(l.id!)} className="bg-red-600/80 p-1 rounded-full text-white hover:bg-red-700" title="Hapus">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <button onClick={() => handleStartEdit(l, 'location')} className="bg-blue-600/80 p-1 rounded-full text-white hover:bg-blue-700" title="Edit">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                            </button>
                             <button onClick={() => setEditingAssetImage({ image: `data:image/jpeg;base64,${l.imageBase64}`, type: 'location', id: l.id! })} className="bg-purple-600/80 p-1 rounded-full text-white hover:bg-purple-700" title="Edit dengan AI">
                                <SparklesIcon className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        <div className="relative aspect-square w-full overflow-hidden rounded-md bg-gray-900">
                            <img src={`data:image/jpeg;base64,${l.imageBase64}`} alt="" className="absolute inset-0 h-full w-full object-cover blur-md scale-110" aria-hidden="true" />
                            <img src={`data:image/jpeg;base64,${l.imageBase64}`} alt={l.name} className="relative h-full w-full object-contain" />
                        </div>
                        <p className="text-sm font-medium truncate mt-2">{l.name}</p>
                    </Card>
                    )
                ))}</div> : <p className="text-gray-400">Belum ada lokasi.</p>}
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500">Buat Aset</h1>
            <div className="border-b border-gray-700">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('avatar')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'avatar' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>Avatar</button>
                    <button onClick={() => setActiveTab('location')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'location' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>Lokasi</button>
                </nav>
            </div>
            {activeTab === 'avatar' && renderAvatarTab()}
            {activeTab === 'location' && renderLocationTab()}

            {croppingModelImage && (
                <ImageCropper
                    src={croppingModelImage}
                    onCrop={handleModelCropComplete}
                    onClose={() => setCroppingModelImage(null)}
                    aspectRatios={[
                        { label: '3:4', ratio: 3 / 4 },
                        { label: '9:16', ratio: 9 / 16 },
                    ]}
                    defaultAspectRatio={9 / 16}
                />
            )}
             {croppingProductImage && (
                <ImageCropper
                    src={croppingProductImage}
                    onCrop={handleProductCropComplete}
                    onClose={() => setCroppingProductImage(null)}
                />
            )}
             {croppingLocationImage && (
                <ImageCropper
                    src={croppingLocationImage}
                    onCrop={handleLocationCropComplete}
                    onClose={() => setCroppingLocationImage(null)}
                     aspectRatios={[
                        { label: '9:16', ratio: 9 / 16 },
                        { label: 'Bebas', ratio: null },
                    ]}
                    defaultAspectRatio={9 / 16}
                />
            )}
            {editingAssetImage && (
                <ImageEditor
                    src={editingAssetImage.image}
                    onSave={handleImageEditSave}
                    onClose={() => setEditingAssetImage(null)}
                />
            )}
        </div>
    );
};

export default AssetManager;