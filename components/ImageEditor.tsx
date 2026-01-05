import React, { useState, useRef } from 'react';
import * as fashionService from '../services/gemini/fashionService';
import Loader from './Loader';

interface ImageEditorProps {
    src: string; // data URL
    onSave: (newImage: string) => void;
    onClose: () => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ src, onSave, onClose }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const isCancelledRef = useRef(false);

    const handleGenerate = async () => {
        if (!prompt) {
            setError('Silakan masukkan instruksi edit.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setEditedImage(null);
        isCancelledRef.current = false;

        try {
            const base64 = src.split(',')[1];
            const mimeType = src.split(';')[0].split(':')[1];
            
            const resultBase64 = await fashionService.editImageWithPrompt(base64, mimeType, prompt);
            
            if (isCancelledRef.current) {
                throw new Error("Operation cancelled by user.");
            }
            
            setEditedImage(`data:image/jpeg;base64,${resultBase64}`);
        } catch (err: any) {
            console.error(err);
            if (err.message.includes("cancelled")) {
                setError("Proses dihentikan oleh pengguna.");
            } else {
                setError("Gagal mengedit gambar. Coba lagi.");
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSave = () => {
        if (editedImage) {
            onSave(editedImage);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="w-full max-w-md md:max-w-4xl max-h-[90vh] overflow-y-auto mx-auto bg-gray-800 text-white rounded-xl shadow-lg p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-center text-indigo-400">Edit Gambar dengan AI</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="text-center">
                        <h3 className="text-lg font-semibold mb-2">Sebelum</h3>
                        <img src={src} alt="Original" className="rounded-lg max-h-60 md:max-h-80 mx-auto" />
                    </div>
                     <div className="text-center flex flex-col items-center justify-center bg-gray-900/50 rounded-lg min-h-[256px] md:min-h-0">
                        <h3 className="text-lg font-semibold mb-2">Sesudah</h3>
                        {isLoading && <Loader text="AI sedang mengedit..." onCancel={() => isCancelledRef.current = true} />}
                        {error && !isLoading && <p className="text-red-400 p-4">{error}</p>}
                        {editedImage && !isLoading && <img src={editedImage} alt="Edited" className="rounded-lg max-h-60 md:max-h-80 mx-auto" />}
                        {!editedImage && !isLoading && !error && <p className="text-gray-500">Hasil editan akan muncul di sini</p>}
                    </div>
                </div>

                <div className="space-y-3">
                    <label htmlFor="edit-prompt" className="block text-sm font-medium text-gray-300">Instruksi Edit</label>
                    <textarea
                        id="edit-prompt"
                        rows={2}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-white"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Contoh: ubah warna baju menjadi merah, buat latar belakang lebih cerah"
                    />
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                     <button onClick={onClose} className="bg-gray-600 text-gray-200 font-semibold py-2 px-6 rounded-lg hover:bg-gray-500 w-full sm:w-auto order-2 sm:order-1">
                        Batal
                    </button>
                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto order-1 sm:order-2">
                        <button onClick={handleGenerate} disabled={isLoading} className="btn-primary font-bold py-2 px-6 rounded-lg w-full">
                            {isLoading ? 'Memproses...' : 'Generate Edit'}
                        </button>
                        <button onClick={handleSave} disabled={!editedImage || isLoading} className="bg-green-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-600 w-full">
                            Simpan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageEditor;
