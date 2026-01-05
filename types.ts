// FIX: Define and export all necessary types for the application.

export type Page = 'home' | 'general-product' | 'asset' | 'fashion' | 'history' | 'content-creator' | 'video' | 'autostory';

// Add Mode enum for distinguishing between image and video generation in history.
export enum Mode { Image, Video }

// FIX: Add ApiKey type to support API key management in settings.
export interface ApiKey {
  id?: number;
  name: string;
  key: string;
  createdAt: string;
}

export interface SeoContent {
  judul_clickbait: string;
  tiktok: {
    deskripsi: string;
    tagar: string;
  };
  shopee: {
    deskripsi: string;
    tagar: string;
  };
  reels_youtube: {
    deskripsi: string;
    tagar: string;
  };
  facebook_pro: {
    deskripsi: string;
    tagar: string;
  };
  whatsapp: {
    deskripsi: string;
    tagar:string;
  };
}

export interface Avatar {
  id?: number;
  name: string;
  imageBase64: string;
  gender?: 'Pria' | 'Wanita';
}

export interface Product {
  id?: number;
  name: string;
  description: string;
  imageBase64: string;
}

export interface Location {
  id?: number;
  name: string;
  imageBase64: string;
}

export interface VeoPromptData {
  dialogueInstruction: string;
  mainPrompt: string;
  negativePrompt: string;
}

export interface Scene {
  sceneNumber: number;
  description: string;
  script: string;
  image: string;
  veoPrompt?: VeoPromptData;
  isRegenerating?: boolean;
  characters_in_scene?: string[];
}

export interface Character {
  id?: number;
  projectId?: number;
  name: string;
  description: string; // The prompt used to generate the image
  imageBase64: string;
  isRegenerating?: boolean;
}

export interface Project {
  id?: number;
  // Fields for general product ads (optional for content creator)
  avatarId?: number;
  productId?: number;
  avatarName?: string;
  // Use productName as a generic project title
  productName: string;
  // Fields for content creator
  contentType?: 'general-product' | 'content-creator';
  storyIdea?: string;
  characters?: Character[]; // For runtime use, not stored directly in the project object in DB
  // Common fields
  storyboard: Scene[];
  createdAt: string;
  seoContent?: SeoContent;
}

export interface FashionHistoryItem {
    id?: number;
    type: 'tryon' | 'pose';
    inputImage1: string;
    inputImage2?: string;
    outputImage: string;
    createdAt: string;
    veoPrompt?: string;
    seoContent?: SeoContent;
    batchId?: string;
}

export interface VideoHistoryItem {
    id?: number;
    mode: Mode;
    prompt: string;
    output: Blob;
    createdAt: string;
    projectId?: number;
    sceneNumber?: number;
    variation?: 1 | 2;
}

// FIX: Added TTSHistoryItem type for storing text-to-speech history.
export interface TTSHistoryItem {
    id?: number;
    text: string;
    voice: string;
    style: string;
    audioBase64: string;
    createdAt: string;
    speakingRate: number;
}

export type ImageAspectRatioKey = 'PORTRAIT_9_16' | 'LANDSCAPE_16_9' | 'SQUARE_1_1';