import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { dbService } from '../services/db';
import { Project, FashionHistoryItem, SeoContent, Avatar, Page, VideoHistoryItem, Mode } from '../types';
import Card from './Card';
import { DownloadIcon, ClipboardIcon, CheckIcon, SparklesIcon, ImageIcon, VideoIcon, VideoCameraIcon } from './icons/Icons';
import ImageCropper from './ImageCropper';
import SeoDisplay from './SeoDisplay';
import ImageEditor from './ImageEditor';
import Loader from './Loader';

type Tab = 'ads' | 'video';
type SceneTab = 'image' | 'video1' | 'video2';

interface HistoryProps {
  setCurrentPage: (page: Page) => void;
}


const VideoPlayer: React.FC<{ item: VideoHistoryItem }> = ({ item }) => {
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    useEffect(() => {
        if (item.output) {
            const url = URL.createObjectURL(item.output);
            setVideoUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [item.output]);

    if (!videoUrl) return <div className="aspect-video bg-gray-700 rounded-md animate-pulse w-full"></div>;
    return <video controls loop src={videoUrl} className="w-full rounded-md" />;
};


const History: React.FC<HistoryProps> = ({ setCurrentPage }) => {
  const [activeTab, setActiveTab] = useState<Tab>('ads');
  const [projects, setProjects] = useState<Project[]>([]);
  const [fashionHistory, setFashionHistory] = useState<FashionHistoryItem[]>([]);
  const [videoHistory, setVideoHistory] = useState<VideoHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [copiedFashionPromptId, setCopiedFashionPromptId] = useState<number | null>(null);
  const [croppingImage, setCroppingImage] = useState<{ image: string; id: number } | null>(null);
  const [editingImage, setEditingImage] = useState<{ image: string; type: 'projectScene' | 'fashion'; id: number; sceneIndex?: number } | null>(null);
  const [openVeoAccordion, setOpenVeoAccordion] = useState<number | null>(null);
  const [activeSceneTabs, setActiveSceneTabs] = useState<Record<number, SceneTab>>({});
  const [isFullScriptCopied, setFullScriptCopied] = useState<boolean>(false);


  // FIX: Define a type for the grouped fashion history items to resolve type errors.
  type FashionHistoryGroup = {
    items: FashionHistoryItem[];
    seoContent: SeoContent | null;
    createdAt: string;
  };


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [savedProjects, savedFashionHistory, savedVideoHistory] = await Promise.all([
        dbService.getProjects(),
        dbService.getFashionHistoryItems(),
        dbService.getVideoHistoryItems(),
      ]);

       const projectsWithCharacters = await Promise.all(
          savedProjects.map(async (proj) => {
              if (proj.contentType === 'content-creator' && proj.id) {
                  const characters = await dbService.getCharactersByProjectId(proj.id);
                  return { ...proj, characters };
              }
              return proj;
          })
      );

      setProjects(projectsWithCharacters.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setFashionHistory(savedFashionHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setVideoHistory(savedVideoHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err) {
      console.error("Failed to fetch history:", err);
      setError("Gagal memuat riwayat.");
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteProject = async (id: number) => {
    try {
        await dbService.deleteProject(id);
        setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err) {
        console.error("Failed to delete project:", err);
        setError("Gagal menghapus proyek.");
    }
  };

  const handleDeleteFashionItem = async (id: number) => {
    try {
        await dbService.deleteFashionHistoryItem(id);
        setFashionHistory(prev => prev.filter(item => item.id !== id));
    } catch (err) {
        console.error("Failed to delete fashion history item:", err);
        setError("Gagal menghapus item fashion.");
    }
  };
  
  const handleDeleteVideoItem = async (id: number) => {
    try {
        await dbService.deleteVideoHistoryItem(id);
        setVideoHistory(prev => prev.filter(item => item.id !== id));
    } catch (err) {
        console.error("Failed to delete video history item:", err);
        setError("Gagal menghapus item video.");
    }
  };

  const downloadAsset = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };
  
  const handleCopyFashionPrompt = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedFashionPromptId(id);
    setTimeout(() => setCopiedFashionPromptId(null), 2000);
  };
  
  const handleCreateVideoFromImage = (imageDataUrl: string) => {
    sessionStorage.setItem('videoViewInitialImage', imageDataUrl);
    setCurrentPage('video');
  };

  const handleCropComplete = (croppedImageUrl: string) => {
    if (!croppingImage) return;
    setFashionHistory(prev => 
        prev.map(item => 
            item.id === croppingImage.id 
                ? { ...item, outputImage: croppedImageUrl } 
                : item
        )
    );
    setCroppingImage(null);
  };
  
  const handleImageEditSave = async (newImage: string) => {
    if (!editingImage) return;

    try {
        if (editingImage.type === 'projectScene') {
            const project = projects.find(p => p.id === editingImage.id);
            if (project && editingImage.sceneIndex !== undefined) {
                const updatedStoryboard = [...project.storyboard];
                updatedStoryboard[editingImage.sceneIndex].image = newImage;
                const updatedProject = { ...project, storyboard: updatedStoryboard };
                await dbService.updateProject(updatedProject);
                // Update local state for immediate feedback
                setProjects(prev => prev.map(p => p.id === editingImage.id ? updatedProject : p));
                if (selectedProject?.id === editingImage.id) {
                    setSelectedProject(updatedProject);
                }
            }
        } else if (editingImage.type === 'fashion') {
            const item = fashionHistory.find(i => i.id === editingImage.id);
            if (item) {
                const updatedItem = { ...item, outputImage: newImage };
                await dbService.updateFashionHistoryItem(updatedItem);
                // Update local state
                setFashionHistory(prev => prev.map(i => i.id === editingImage.id ? updatedItem : i));
            }
        }
        setEditingImage(null);
    } catch (err) {
        setError("Gagal menyimpan gambar yang diedit.");
    }
  };

  const renderProjectDetailsModal = () => {
    if (!selectedProject) return null;

    const projectVideos = videoHistory.filter(v => v.projectId === selectedProject.id);

    const handleDownload = (sceneIndex: number) => {
        const activeTab = activeSceneTabs[sceneIndex] || 'image';
        const scene = selectedProject.storyboard[sceneIndex];
        if (activeTab === 'image') {
            downloadAsset(scene.image, `scene_${scene.sceneNumber}.jpg`);
            return;
        }

        const variation = activeTab === 'video1' ? 1 : 2;
        const videoItem = projectVideos.find(v => v.sceneNumber === scene.sceneNumber && v.variation === variation);
        if (videoItem) {
            const url = URL.createObjectURL(videoItem.output);
            downloadAsset(url, `scene_${scene.sceneNumber}_video${variation}.mp4`);
            URL.revokeObjectURL(url);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedProject(null)}>
            <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-indigo-400">{selectedProject.productName}</h2>
                    <button onClick={() => setSelectedProject(null)} className="text-gray-400 hover:text-white text-3xl">&times;</button>
                </div>
                <p className="text-sm text-gray-400 mb-4">Dibuat pada: {new Date(selectedProject.createdAt).toLocaleString()}</p>
                
                {selectedProject.contentType === 'content-creator' && selectedProject.characters && (
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-purple-400 mb-3">Karakter dalam Cerita</h3>
                         <div className="flex flex-wrap justify-center gap-4 p-2 bg-gray-900/50 rounded-lg">
                            {selectedProject.characters.map((char, index) => (
                                <div key={index} className="text-center w-28">
                                    <img src={`data:image/jpeg;base64,${char.imageBase64}`} alt={char.name} className="w-24 h-24 rounded-full object-cover mx-auto border-2 border-indigo-500" />
                                    <p className="font-semibold mt-2 text-sm truncate">{char.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {selectedProject.storyboard.map((scene, index) => {
                        const activeTab = activeSceneTabs[index] || 'image';
                        const video1 = projectVideos.find(v => v.sceneNumber === scene.sceneNumber && v.variation === 1);
                        const video2 = projectVideos.find(v => v.sceneNumber === scene.sceneNumber && v.variation === 2);

                        return (
                        <Card key={index} className="p-3 flex flex-col bg-gray-900/50">
                            <div className="relative">
                                <div className="flex justify-center p-1 bg-gray-800 rounded-t-lg text-xs">
                                    <button onClick={() => setActiveSceneTabs(prev => ({ ...prev, [index]: 'image' }))} className={`px-3 py-1 rounded-md flex items-center gap-1 ${activeTab === 'image' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}><ImageIcon className="w-4 h-4" /> Gambar</button>
                                    <button onClick={() => setActiveSceneTabs(prev => ({ ...prev, [index]: 'video1' }))} disabled={!video1} className={`px-3 py-1 rounded-md flex items-center gap-1 ${activeTab === 'video1' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'} disabled:text-gray-500 disabled:hover:bg-transparent`}><VideoIcon className="w-4 h-4" /> Video 1</button>
                                    <button onClick={() => setActiveSceneTabs(prev => ({ ...prev, [index]: 'video2' }))} disabled={!video2} className={`px-3 py-1 rounded-md flex items-center gap-1 ${activeTab === 'video2' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'} disabled:text-gray-500 disabled:hover:bg-transparent`}><VideoIcon className="w-4 h-4" /> Video 2</button>
                                </div>
                                <div className="relative aspect-[9/16] w-full bg-gray-800 rounded-b-lg overflow-hidden">
                                    {activeTab === 'image' && <img src={scene.image} alt={`Scene ${scene.sceneNumber}`} className="w-full h-full object-cover" />}
                                    {activeTab === 'video1' && video1 && <VideoPlayer item={video1} />}
                                    {activeTab === 'video2' && video2 && <VideoPlayer item={video2} />}
                                    {((activeTab === 'video1' && !video1) || (activeTab === 'video2' && !video2)) && <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">Video tidak tersedia.</div>}
                                </div>
                            </div>
                            <div className="py-2 flex justify-center gap-2 flex-wrap">
                                <button onClick={() => handleDownload(index)} className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-green-600 text-white font-semibold py-1.5 px-3 rounded-md transition-colors" title="Unduh Aset"><DownloadIcon className="w-4 h-4"/><span>Unduh</span></button>
                                {activeTab === 'image' && <button onClick={() => setEditingImage({ image: scene.image, type: 'projectScene', id: selectedProject.id!, sceneIndex: index })} className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-purple-600 text-white font-semibold py-1.5 px-3 rounded-md transition-colors" title="Edit dengan AI"><SparklesIcon className="w-4 h-4"/><span>Edit</span></button>}
                                {activeTab === 'image' && (
                                    <button
                                        onClick={() => handleCreateVideoFromImage(scene.image)}
                                        className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-pink-600 text-white font-semibold py-1.5 px-3 rounded-md transition-colors"
                                        title="Buat Video dari Gambar"
                                    >
                                        <VideoCameraIcon className="w-4 h-4" />
                                        <span>Buat Video</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 space-y-3 pt-2 border-t border-gray-700">
                                <h3 className="font-bold text-lg text-indigo-400">Adegan {scene.sceneNumber}</h3>
                                <div>
                                    <h4 className="font-semibold text-gray-300">Naskah</h4>
                                    <p className="text-gray-300 bg-gray-900 p-2 rounded text-sm">{scene.script}</p>
                                </div>
                                {scene.veoPrompt && (
                                    <div className="border border-gray-700 rounded-lg overflow-hidden">
                                        <div className="flex justify-between items-center p-3 bg-gray-800 hover:bg-gray-700">
                                            <button onClick={() => setOpenVeoAccordion(openVeoAccordion === index ? null : index)} className="flex-grow flex items-center justify-between text-left focus:outline-none"><h4 className="font-semibold text-gray-300">Prompt VEO</h4><svg className={`w-5 h-5 transform transition-transform ${openVeoAccordion === index ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                                            <button onClick={(e) => { e.stopPropagation(); if(scene.veoPrompt) { const fullPrompt = `DIALOGUE INSTRUCTION:\n${scene.veoPrompt.dialogueInstruction}\n\nMAIN PROMPT:\n${scene.veoPrompt.mainPrompt}\n\nNEGATIVE PROMPT:\n${scene.veoPrompt.negativePrompt}`; handleCopyToClipboard(fullPrompt, `${selectedProject.id}-${scene.sceneNumber}`); } }} className="ml-4 flex items-center gap-1 text-sm bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded shrink-0">{copiedPromptId === `${selectedProject.id}-${scene.sceneNumber}` ? <CheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />} {copiedPromptId === `${selectedProject.id}-${scene.sceneNumber}` ? 'Disalin' : 'Salin'}</button>
                                        </div>
                                        {openVeoAccordion === index && scene.veoPrompt && (
                                            <div className="p-4 bg-gray-900/50 space-y-3">
                                                <div><h5 className="font-semibold text-sm text-gray-400 mb-1">Instruksi Dialog</h5><p className="text-sm whitespace-pre-wrap text-indigo-300">{scene.veoPrompt.dialogueInstruction}</p></div>
                                                <div><h5 className="font-semibold text-sm text-gray-400 mb-1">Prompt Utama (Animasi)</h5><p className="text-sm whitespace-pre-wrap text-gray-200">{scene.veoPrompt.mainPrompt}</p></div>
                                                <div><h5 className="font-semibold text-sm text-gray-400 mb-1">Prompt Negatif</h5><p className="text-xs whitespace-pre-wrap text-gray-500">{scene.veoPrompt.negativePrompt}</p></div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Card>
                    )})}
                </div>
                
                {selectedProject.seoContent && <SeoDisplay content={selectedProject.seoContent} />}

                <Card className="p-4 sm:p-6 mt-6 bg-gray-900/50">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xl font-bold text-purple-400">Naskah Lengkap</h3>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const fullScript = selectedProject.storyboard.map(s => s.script).join('\n\n');
                                navigator.clipboard.writeText(fullScript);
                                setFullScriptCopied(true);
                                setTimeout(() => setFullScriptCopied(false), 2000);
                            }}
                            className="flex items-center gap-1 text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded"
                        >
                            {isFullScriptCopied ? <CheckIcon className="w-3 h-3 text-green-400" /> : <ClipboardIcon className="w-3 h-3" />}
                            {isFullScriptCopied ? 'Disalin' : 'Salin Naskah'}
                        </button>
                    </div>
                    <textarea
                        readOnly
                        value={selectedProject.storyboard.map(s => s.script).join('\n\n')}
                        rows={8}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-300"
                    />
                </Card>
            </Card>
        </div>
    )
  }

  const renderContent = () => {
    if (isLoading) return <p>Memuat riwayat...</p>;
    if (error) return <p className="text-red-400">{error}</p>;

    if (activeTab === 'ads') {
        if (projects.length === 0) return <Card className="p-6 text-center"><p className="text-gray-400">Belum ada konten shorts yang disimpan.</p></Card>;
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => (
                <Card key={project.id} className="p-4 flex flex-col justify-between hover:border-indigo-500 transition-colors group">
                    <button 
                        onClick={() => handleDeleteProject(project.id!)}
                        className="absolute top-3 right-3 z-10 bg-red-600/70 p-1.5 rounded-full text-white hover:bg-red-700 transition-all opacity-0 group-hover:opacity-100"
                        aria-label="Hapus proyek"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div onClick={() => setSelectedProject(project)} className="cursor-pointer h-full flex flex-col flex-grow">
                        <div className="flex-grow">
                            <h2 className="text-xl font-bold truncate">{project.productName}</h2>
                            {project.contentType === 'content-creator' ? (
                                <p className="text-sm text-gray-400 mb-2 truncate">Ide: {project.storyIdea}</p>
                            ) : (
                                <p className="text-sm text-gray-400 mb-2">Avatar: {project.avatarName}</p>
                            )}
                            <p className="text-xs text-gray-500 mb-4">Dibuat pada: {new Date(project.createdAt).toLocaleDateString()}</p>
                            <div className="flex -space-x-4 mb-4">
                                {(project.characters && project.characters.length > 0 ? project.characters : project.storyboard).slice(0, 4).map((item, index) => (
                                    <img key={index} src={project.characters ? `data:image/jpeg;base64,${(item as any).imageBase64}` : (item as any).image} alt={`Item ${index+1}`} className="w-12 h-12 rounded-full border-2 border-gray-900 object-cover"/>
                                ))}
                                {project.storyboard.length > 4 && <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold border-2 border-gray-900">+{project.storyboard.length - 4}</div>}
                            </div>
                        </div>
                        <div className="w-full text-center mt-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                            Lihat Detail
                        </div>
                    </div>
                </Card>
                ))}
            </div>
        );
    }
    
    if (activeTab === 'video') {
        if (videoHistory.length === 0) return <Card className="p-6 text-center"><p className="text-gray-400">Belum ada riwayat video yang disimpan.</p></Card>;
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videoHistory.map((item) => (
                    <Card key={item.id} className="p-4 space-y-3 flex flex-col group">
                        <button 
                            onClick={() => handleDeleteVideoItem(item.id!)}
                            className="absolute top-3 right-3 z-10 bg-red-600/70 p-1.5 rounded-full text-white hover:bg-red-700 transition-all opacity-0 group-hover:opacity-100"
                            aria-label="Hapus item"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="flex-grow space-y-3">
                            <VideoPlayer item={item} />
                            <p className="text-gray-300 bg-gray-900 p-2 rounded text-sm h-20 overflow-y-auto">{item.prompt}</p>
                        </div>
                         <p className="text-xs text-gray-500 text-center">Dibuat pada: {new Date(item.createdAt).toLocaleString()}</p>
                    </Card>
                ))}
            </div>
        );
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500">Riwayat Proyek</h1>
      
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button onClick={() => setActiveTab('ads')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'ads' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>
                Konten Shorts
            </button>
            <button onClick={() => setActiveTab('video')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'video' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>
                Video
            </button>
        </nav>
      </div>

      {renderContent()}
      {renderProjectDetailsModal()}
      {croppingImage && (
        <ImageCropper
            src={croppingImage.image}
            onCrop={handleCropComplete}
            onClose={() => setCroppingImage(null)}
        />
       )}
        {editingImage && (
            <ImageEditor
                src={editingImage.image}
                onSave={handleImageEditSave}
                onClose={() => setEditingImage(null)}
            />
        )}
    </div>
  );
};

export default History;