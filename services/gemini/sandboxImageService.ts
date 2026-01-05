import { ImageAspectRatioKey } from '../../types';

// Custom error for authentication issues
export class ImageGenerationAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageGenerationAuthError';
  }
}

// FIX: Add a mapping from the app's internal aspect ratio keys to the API's expected values.
const aspectRatioMap: Record<ImageAspectRatioKey, string> = {
    'SQUARE_1_1': 'IMAGE_ASPECT_RATIO_SQUARE',
    'PORTRAIT_9_16': 'IMAGE_ASPECT_RATIO_PORTRAIT',
    'LANDSCAPE_16_9': 'IMAGE_ASPECT_RATIO_LANDSCAPE',
};


export const uploadImage = async (file: File, dataUrl: string, token: string): Promise<string> => {
    const base64Data = dataUrl.split(',')[1];
    const payload = {
        clientContext: { sessionId: crypto.randomUUID(), tool: "ASSET_MANAGER" },
        imageInput: { isUserUploaded: true, mimeType: file.type, rawImageBytes: base64Data }
    };

    const response = await fetch('https://aisandbox-pa.googleapis.com/v1:uploadUserImage', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status}. ${errorText}`);
    }

    const data: any = await response.json();
    const extractedMediaId = data.mediaId 
        || data.userImage?.mediaId 
        || data.image?.mediaId 
        || data?.mediaGenerationId?.mediaGenerationId;

    if (!extractedMediaId) {
        console.error("Unexpected upload response structure:", data);
        throw new Error("Could not find mediaGenerationId in the upload response.");
    }
    
    console.log("✅ Upload successful, mediaId:", extractedMediaId);
    return extractedMediaId;
};


interface GenerateImagesParams {
    prompt: string;
    aspectRatio: ImageAspectRatioKey;
    seed: string;
    token: string;
    candidatesCount?: number;
}

export const generateImagesFromText = async ({ 
    prompt, 
    aspectRatio, 
    seed, 
    token,
    candidatesCount = 4,
}: GenerateImagesParams): Promise<string[]> => {
    
    const parsedSeed = seed.trim() && !isNaN(parseInt(seed)) 
        ? parseInt(seed, 10) 
        : Math.floor(Math.random() * 1000000);

    const payload = {
        // FIX: Use the aspectRatioMap to send the correct value to the API.
        aspectRatio: aspectRatioMap[aspectRatio],
        clientContext: {
            sessionId: `;${Date.now()}`,
            tool: "PINHOLE",
            projectId: "eeebbf69-2115-4cad-a52b-726a38b1b835"
        },
        modelInput: { modelNameType: "IMAGEN_3_5" },
        userInput: {
            candidatesCount: candidatesCount,
            seed: parsedSeed,
            prompts: [prompt],
            referenceImageInput: { referenceImages: [] }
        }
    };

    const response = await fetch('https://aisandbox-pa.googleapis.com/v1:runImageFx', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    
    if (response.status === 401 || response.status === 403) {
        throw new ImageGenerationAuthError('Authentication failed. Please check your Bearer Token.');
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Generation failed: ${response.status}. ${errorText}`);
    }
    
    const data = await response.json();
    let images: string[] = [];
    
    if (Array.isArray(data?.imagePanels) && data.imagePanels[0]?.generatedImages?.length > 0) {
        images = data.imagePanels[0].generatedImages.map((img: any) => img.encodedImage).filter(Boolean);
    } 
    else if (Array.isArray(data?.predictions) && data.predictions.length > 0) {
        images = data.predictions.map((pred: any) => pred?.bytesBase64Encoded).filter(Boolean);
    } 
    else if (Array.isArray(data?.generatedImages) && data.generatedImages.length > 0) {
        images = data.generatedImages.map((imgData: any) => imgData.image?.imageBytes || imgData.imageBytes).filter(Boolean);
    }

    if (images.length > 0) {
        return images;
    } else {
        console.warn("Async generation response or empty result:", data);
        throw new Error('Image generation did not return any images.');
    }
};

export const generateImage = async (mediaId: string | string[], prompt: string, aspectRatio: ImageAspectRatioKey, token: string): Promise<string> => {
    const referenceImages = Array.isArray(mediaId)
        ? mediaId.map(id => ({ mediaId: id }))
        : [{ mediaId: mediaId }];

    const payload = {
        // FIX: Use the aspectRatioMap to send the correct value to the API.
        aspectRatio: aspectRatioMap[aspectRatio],
        clientContext: {
            sessionId: crypto.randomUUID(),
            tool: "PINHOLE",
            projectId: "936c0440-9e71-47ce-a098-0bcc6c96f39b" 
        },
        modelInput: { modelNameType: "GEM_PIX" },
        userInput: {
            candidatesCount: 1,
            seed: Math.floor(Math.random() * 100000),
            prompts: [prompt],
            referenceImageInput: {
                referenceImages: referenceImages
            }
        }
    };

    const response = await fetch('https://aisandbox-pa.googleapis.com/v1:runImageFx', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    
    if (response.status === 401 || response.status === 403) {
        throw new ImageGenerationAuthError('Authentication failed. Please check your Bearer Token.');
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Generation failed: ${response.status}. ${errorText}`);
    }
    
    const data = await response.json();
    let image: string | undefined;

    if (Array.isArray(data?.imagePanels) && data.imagePanels[0]?.generatedImages?.length > 0) {
        image = data.imagePanels[0].generatedImages[0].encodedImage;
    } 
    else if (Array.isArray(data?.predictions) && data.predictions.length > 0) {
        image = data.predictions[0]?.bytesBase64Encoded;
    } 
    else if (Array.isArray(data?.generatedImages) && data.generatedImages.length > 0) {
        const imgData = data.generatedImages[0];
        image = imgData.image?.imageBytes || imgData.imageBytes;
    }

    if (image) {
        return image;
    } else {
        console.warn("Async generation response or empty result:", data);
        throw new Error('Image generation did not return any images.');
    }
};
