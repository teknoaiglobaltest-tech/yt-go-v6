import { fetchWithChutesFallbacks } from '../chutesKeyService';
import { generateText } from '../chutesTextService';

/**
 * Takes a scene description and optimizes it for two different 5-second, action-focused video prompts.
 * @param sceneDescription The detailed description of a scene.
 * @returns A promise that resolves with an array of two concise, action-oriented prompts in English.
 */
export const optimizeScenesForVideo = async (sceneDescription: string): Promise<string[]> => {
    const systemPrompt = `You are an expert prompt engineer for AI image-to-video models. Your task is to take a scene description for a static image and generate a JSON array containing two distinct, dynamic prompts. Each prompt should focus on a different visual action for a 5-second video clip.

    **CRITICAL RULES:**
    1.  **Language:** The output prompts MUST be in English.
    2.  **Two Variations:** Create two DIFFERENT prompts. Each should describe a unique, plausible action related to the scene. For example, if the scene is "a person drinking coffee," one prompt could be "slowly sipping coffee and looking thoughtfully out a window," and the other could be "laughing while talking to someone off-camera, gesturing with the coffee cup."
    3.  **Focus on Action:** Distill the description into its core visual action. Describe movement.
    4.  **Remove Narrative:** Eliminate all dialogue, narration, and abstract plot points. Focus only on what is visually happening.
    5.  **Concise:** Keep each prompt brief and powerful.
    6.  **Output Format:** Respond ONLY with a valid JSON object with a single key "prompts" which is an array of two strings. Example: { "prompts": ["first action prompt", "second action prompt"] }. Do not add any other text or explanations.`;
    
    const userPrompt = `**Scene Description:** "${sceneDescription}"`;
    
    const jsonString = await generateText({ systemPrompt, userPrompt, isJsonOutput: true });

    const result = JSON.parse(jsonString);
    if (result.prompts && Array.isArray(result.prompts) && result.prompts.length >= 2) {
        return result.prompts.slice(0, 2);
    }
    // Fallback if it returns a direct array
    if (Array.isArray(result) && result.length >= 2) {
      return result.slice(0, 2);
    }

    throw new Error("AI gagal membuat dua prompt video yang berbeda.");
};

/**
 * Generates a video from a source image and a prompt using the Chutes.ai API.
 * @param imageBase64 The base64-encoded source image.
 * @param prompt The prompt describing the video's action.
 * @param onRetry Callback function for retry attempts.
 * @param signal AbortSignal to cancel the request.
 * @returns A promise that resolves with the generated video as a Blob.
 */
export const generateVideoFromImage = async (
    imageBase64: string, 
    prompt: string,
    onRetry: (attempt: number, maxRetries: number) => void,
    signal?: AbortSignal
): Promise<Blob> => {
    const response = await fetchWithChutesFallbacks(
        "https://chutes-wan-2-2-i2v-14b-fast.chutes.ai/generate", 
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                image: imageBase64,
                prompt: prompt,
                negative_prompt: "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走",
                fps: 16,
                fast: true,
                frames: 81, // ~5 seconds at 16fps
                resolution: "480p",
                guidance_scale: 1,
                guidance_scale_2: 1
            })
        },
        (attempt, max, serverName) => onRetry(attempt, max),
        signal
    );

    return await response.blob();
};


/**
 * Generates a video from a text prompt.
 * @param prompt The prompt describing the video.
 * @param aspectRatio The desired aspect ratio.
 * @param onRetry Callback for retry attempts.
 * @param signal AbortSignal to cancel.
 * @returns A promise that resolves with the generated video as a Blob.
 */
export const generateVideoFromText = async (
    prompt: string,
    negativePrompt: string,
    aspectRatio: '9:16' | '16:9',
    onRetry: (attempt: number, maxRetries: number) => void,
    signal?: AbortSignal
): Promise<Blob> => {
    const response = await fetchWithChutesFallbacks(
        'https://chutes-wan2-1-14b.chutes.ai/text2video', 
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                negative_prompt: negativePrompt,
                fps: 24,
                seed: 42,
                steps: 25,
                frames: 81,
                sample_shift: null,
                single_frame: false,
                aspect_ratio: aspectRatio,
            })
        },
        (attempt, max, serverName) => onRetry(attempt, max),
        signal
    );

    return await response.blob();
};
