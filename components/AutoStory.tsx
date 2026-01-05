import React, { useState } from 'react';
import { ExpandVideoView, InitialAction } from './autostory/ExpandVideoView';
import { MainMenu } from './autostory/MainMenu';
import { AutoStoryForm } from './autostory/AutoStoryForm';
import { ManualStoryForm } from './autostory/ManualStoryForm';

// Type for params from AutoStoryForm
type AutoStoryParams = {
    initialImageBlob: Blob;
    prompts: string[];
    quality: '480p' | '720p';
    duration: '5s' | '8s';
};

// New Type for params from ManualStoryForm
type ManualStoryParams = {
    initialImageBlob: Blob;
    quality: '480p' | '720p';
    duration: '5s' | '8s';
};


const AutoStory: React.FC = () => {
    const [view, setView] = useState<'menu' | 'editor' | 'form' | 'manual_form'>('menu');
    const [initialAction, setInitialAction] = useState<InitialAction | null>(null);

    const t = (key: string, params?: { [key: string]: string | number }): string => {
        const translations: {[key: string]: string} = {
            expandVideoStart: "Start Your Story",
            expandVideoUploadReference: "Upload an image or video to begin the first scene.",
            videoUpload: "Upload Media",
            expandVideoErrorInvalidFile: "Invalid file type. Please upload an image or video.",
            confirmDelete: "Are you sure you want to delete this scene?",
            confirmDeleteHistory: "Are you sure you want to permanently delete this item from your history?",
            confirmDeleteSession: "Are you sure you want to delete this entire session? This action is permanent.",
            confirmStartNew: "Apakah Anda yakin ingin memulai cerita baru? Progres saat ini akan hilang.",
            expandVideoScene: "Scene {count}",
            expandVideoRecreateScene: "Recreate",
            edit: "Edit Prompt",
            delete: "Delete Scene",
            prompt: "Prompt",
            imageOptimizePrompt: "Optimize",
            cancel: "Cancel",
            expandVideoGenerateScene: "Generate Scene",
            expandVideoAddScene: "Add New Scene",
            expandVideoFrameSelectorTitle: "Select Reference Frame",
            expandVideoFrameSelectorInstructions: "Use the controls to find the perfect moment, then click “Select Frame”.",
            expandVideoSelectFrame: "Select Frame",
            expandVideoSelectReference: "Select Reference for New Scene",
            expandVideoUploadNew: "Upload New Media",
            expandVideoReferenceFromScene: "From Scene {count}",
            combineAndDownload: "Combine & Download Story",
            combineModalTitle: "Combine & Download Story",
            combineModalDescription: "Your generated scenes will be stitched together into a single video file. The final video will be in WebM format.",
            combineModalStart: "Start Combination",
            combineModalRecording: "Combining scenes...",
            combineModalDownload: "Download Dan Convert Ke MP4",
            combineModalAgain: "Combine Again",
            addBackgroundMusic: "Add Background Music",
            backgroundMusicVolume: "Background Music Volume",
            removeMusic: "Remove Music",
            historyButton: "History",
            backButton: "Back",
            historyTitle: "History",
            historyEmpty: "Your generated videos will appear here.",
            historyTypeScene: "Scene",
            historyTypeStory: "Story",
            historySessionTitle: "Session from {timestamp}",
            historyScenes: "{count} Scenes",
            viewSession: "View Session",
            sessionDetails: "Session Details",
            combinedStoryVideo: "Combined Story Video",
            download: "Download",
            generateWithAI: "Generate with AI",
            imageGeneratorTitle: "Generate Image with AI",
            negativePrompt: "Negative Prompt (optional)",
            aspectRatio: "Aspect Ratio",
            generate: "Generate",
            useImage: "Use This Image",
            generateAgain: "Generate Again",
            generating: "Generating...",
            autoStory: "Auto Story",
            autoStoryModalTitle: "Create Story Automatically with AI",
            storyIdea: "Story Idea",
            numScenes: "Number of Scenes",
            generateStory: "Generate Story Plan",
            generatingStoryPlan: "Generating story plan...",
            generatingInitialImage: "Generating initial reference image...",
            sceneStatusWaiting: "Waiting for previous scene...",
            aspectRatioLandscape: "Landscape (16:9)",
            aspectRatioPortrait: "Portrait (9:16)",
            useImageAndStart: "Use Image & Start Story",
            sceneStatusOptimizing: "Optimizing prompt...",
            autoStoryUploadImage: "Upload Your Own Image",
            autoStoryGenerateImage: "Generate with AI",
            autoStoryDropImage: "Drop image here or click to upload",
            autoStoryPreviewTitle: "Review Your Story Plan",
            autoStoryRegenerateImage: "Regenerate Image",
            autoStoryInitialImagePrompt: "Initial Image Prompt",
            autoStoryScenePrompt: "Scene {count} Prompt",
            confirmAndStart: "Confirm & Start Story",
            autoStoryGenerateScenes: "Use Image & Generate Scenes",
            generatingInitialImagePrompt: "Generating initial image prompt...",
            newStory: "Buat Konten Baru",
            autoStoryImageFidelity: "Image Fidelity",
            autoStoryImageFidelityExact: "Exactly the Same",
            autoStoryImageFidelityCreative: "AI Creative Freedom",
        };

        let translation = translations[key] || key;

        if (params) {
            Object.keys(params).forEach(paramKey => {
                const regex = new RegExp(`{${paramKey}}`, 'g');
                translation = translation.replace(regex, String(params[paramKey]));
            });
        }

        return translation;
    };

    const handleAutoStoryClick = () => {
        setView('form');
    };
    
    const handleManualStoryClick = () => {
        setView('manual_form');
    };
    
    const handleHistoryClick = () => {
        setInitialAction({ type: 'history' });
        setView('editor');
    };

    const handleGoToMenu = () => {
        setInitialAction(null);
        setView('menu');
    }

    const handleAutoStoryGenerated = (params: AutoStoryParams) => {
        setInitialAction({
            type: 'auto-story',
            imageBlob: params.initialImageBlob,
            prompts: params.prompts,
            quality: params.quality,
            duration: params.duration,
        });
        setView('editor');
    };
    
    const handleManualStoryStarted = (params: ManualStoryParams) => {
        setInitialAction({
            type: 'manual-story',
            imageBlob: params.initialImageBlob,
            quality: params.quality,
            duration: params.duration,
        });
        setView('editor');
    };
    
    const renderCurrentView = () => {
        switch(view) {
            case 'form':
                return <AutoStoryForm t={t} onBack={handleGoToMenu} onGenerate={handleAutoStoryGenerated} />;
            case 'manual_form':
                return <ManualStoryForm t={t} onBack={handleGoToMenu} onStart={handleManualStoryStarted} />;
            case 'editor':
                return <ExpandVideoView t={t} initialAction={initialAction} onGoToMenu={handleGoToMenu} />;
            case 'menu':
            default:
                return <MainMenu 
                    t={t}
                    onManualStoryClick={handleManualStoryClick}
                    onAutoStoryClick={handleAutoStoryClick}
                    onHistoryClick={handleHistoryClick}
                />;
        }
    };

    return (
        <div className="-m-4 sm:-m-6 lg:-m-10">
            <div className="min-h-screen text-white font-sans h-screen bg-gray-900">
               {renderCurrentView()}
            </div>
        </div>
    );
};

export default AutoStory;