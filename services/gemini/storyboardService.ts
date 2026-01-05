import { Product, Scene, VeoPromptData } from "../../types";
import { uploadImage, generateImage } from "./sandboxImageService";
import { generateText } from "../chutesTextService";

// Helper to convert data URL to File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error('Invalid data URL');
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}


export const generateStoryboard = async (product: Product, sceneCount: number, language: string, promotionStyle: string, hookStyle: string): Promise<{ description: string; script: string; }[]> => {
  const systemPrompt = `You are an expert viral video scriptwriter for the Indonesian market, specializing in TikTok & Shopee Video. Your task is to create a high-converting, engaging storyboard.

Respond ONLY with a valid JSON object with a single key "storyboard" which is an array of objects. Each object in the array must have two keys: "description" (a vivid visual description for the scene) and "script" (the voiceover script following all rules below). Do not include any other text or explanations.
Example: { "storyboard": [ { "description": "...", "script": "..." } ] }`;

  const userPrompt = `Create a storyboard for a short video ad for the product: "${product.name}".
Product Description: "${product.description}".

**CRITICAL INSTRUCTIONS:**

1.  **Ad Style:** The required promotion style is: "**${promotionStyle}**". You MUST strictly adhere to the characteristics described in this style. For example, if it says "Soft Selling" with a description of telling a story, you must craft a narrative. If it says "Hard Selling" with scarcity, you must be direct and create urgency. If it mentions "Drama", create a mini-story with high emotional stakes. If it mentions "Humor", make it funny. If it says "News Presenter", be formal and professional.

2.  **Hook/Opening:** The hook for the very first scene is critical. The instruction for the hook is: "**${hookStyle}**".
    *   If the instruction is a specific phrase (e.g., "kenapa ya", "kalian tahu gak", "sumpah, nyesel baru tahu"), you MUST start the script for the very first scene with that exact phrase.
    *   If the instruction is "sesuaikan gaya promosi", you must create a powerful, original hook that perfectly matches the chosen **Ad Style**. For example, a "Drama" style might start with a mysterious question, while "Humor" might start with a funny observation.
    *   If the instruction is a custom user-provided hook, you MUST start the script with that exact text.

3.  **Script Length:** Each scene's "script" (for voiceover/dialogue) must be extremely concise, strictly between **18 and 20 syllables (suku kata)**. This is perfect for a short video clip per scene.

4.  **Language:** The entire "script" must be in **${language}**.

5.  **CTA (Call to Action):** DO NOT add the final Call to Action (like 'Cek keranjang kuning'). The application will add it automatically. Your script should naturally lead up to a CTA.

6.  **Structure:** Create a storyboard with exactly ${sceneCount} scenes.`;

  const jsonString = await generateText({ systemPrompt, userPrompt, isJsonOutput: true });

  const result = JSON.parse(jsonString);
  // The prompt asks for { "storyboard": [...] }, so extract it.
  if (result.storyboard && Array.isArray(result.storyboard)) {
    return result.storyboard;
  }
  // Fallback if it returns an array directly
  if (Array.isArray(result)) {
    return result;
  }
  throw new Error("Invalid storyboard format from AI.");
};

export const composeSceneImage = async (avatarDataUrl: string, productDataUrl: string, sceneDescription: string, token: string, locationDataUrl?: string): Promise<string> => {
  const prompt = `
Create a 9:16 portrait aspect ratio, ultra-photorealistic advertising image that looks exactly like a real human photograph, not CGI or 3D render. The scene description is: "${sceneDescription}"

CRITICAL RULES:
1. **AVATAR LIKENESS:** Replicate the exact same person from the reference avatar image with 100% likeness — identical face, body, clothing, hair, and expression.
2. **PRODUCT INTEGRATION:** Naturally integrate the provided product into the scene with realistic scale, lighting, and shadows.
3. **BACKGROUND:** If a location image is provided, use it as the background. Otherwise, create a suitable background based on the scene description.
4. **PHOTOREALISM:** The final result must look like a professional lifestyle photo, indistinguishable from reality.
5. **CLEAN IMAGE:** The image MUST be clean. No text, subtitles, logos, watermarks.
`;

    const avatarFile = dataURLtoFile(avatarDataUrl, 'avatar.jpg');
    const productFile = dataURLtoFile(productDataUrl, 'product.png');
    
    const uploadPromises = [
        uploadImage(avatarFile, avatarDataUrl, token),
        uploadImage(productFile, productDataUrl, token)
    ];

    if (locationDataUrl) {
        const locationFile = dataURLtoFile(locationDataUrl, 'location.jpg');
        uploadPromises.push(uploadImage(locationFile, locationDataUrl, token));
    }
    
    const mediaIds = await Promise.all(uploadPromises);
  
    return await generateImage(mediaIds, prompt, 'PORTRAIT_9_16', token);
};


export const generateVeoPrompts = async (storyboard: Scene[], language: string, voiceOverStyle: 'narasi' | 'lypsing', avatarGender: 'Pria' | 'Wanita'): Promise<VeoPromptData[]> => {
    const voiceName = avatarGender === 'Pria' ? 'Charon' : 'Kore';

    const systemPrompt = `You are a world-class VEO-3 prompt engineer. Your task is to create a JSON array of powerful and detailed VEO-3 video prompt objects, one for each scene in the provided storyboard.

**CRITICAL INSTRUCTIONS:**
1.  **JSON Array Output:** Your entire response MUST be a single, valid JSON object with a key "prompts" which is an array of objects. Each object in the array represents a scene and must match the provided schema. Example: { "prompts": [ { "dialogueInstruction": "...", "mainPrompt": "...", "negativePrompt": "..." } ] }
2.  **Style Adherence:** The user has specified a voice over style of **'${voiceOverStyle}'**. You MUST generate the prompts strictly following the logic of the corresponding style.
    *   **Narasi (Narration):** The character does not speak. \`dialogueInstruction\` should be for a narrator. \`mainPrompt\` should describe character actions without speaking.
    *   **Lypsing (Lip-sync):** The character speaks to the camera. \`dialogueInstruction\` must mention lip-syncing. \`mainPrompt\` should describe the character speaking.
3.  **JSON Schema Breakdown for each object:**
    *   \`dialogueInstruction\` (string): A clear instruction for the audio. It must specify the language ('${language}'), the voice name ('${voiceName}'), and the delivery style based on the **'${voiceOverStyle}'**. It must include the scene's script verbatim.
    *   \`mainPrompt\` (string): The core animation instruction. It must describe an 8-second video clip composed of 2-3 dynamic, smoothly-cut sub-scenes based on the scene's 'description'. Describe character actions, subtle movements, environment animations, and cinematic camera work.
    *   \`negativePrompt\` (string): A comprehensive list of negative keywords to avoid common AI video artifacts.
4.  **Language:** The descriptive parts (\`mainPrompt\`, \`negativePrompt\`) MUST be in **English**. The voiceover script inside \`dialogueInstruction\` MUST be in **${language}**.
5.  **Quality:** The prompts should aim for a hyperrealistic, 8K, cinematic video.

Respond ONLY with a valid JSON object. Do not add any other text or explanations.`;
    
    const userPrompt = `**Storyboard Data:**
- Target Language: ${language}
- Voice Name: ${voiceName}
- Avatar Gender: ${avatarGender}
- Voice Over Style: ${voiceOverStyle}
- Storyboard Scenes:
${storyboard.map((s, i) => `  Scene ${i + 1}:\n    Description: ${s.description}\n    Script: "${s.script.replace(/"/g, '\\"')}"`).join('\n\n')}`;
    
    const jsonString = await generateText({ systemPrompt, userPrompt, isJsonOutput: true });

    const result = JSON.parse(jsonString);
    if (result.prompts && Array.isArray(result.prompts)) {
      return result.prompts;
    }
    // Fallback
    if (Array.isArray(result)) {
      return result;
    }
    throw new Error("Invalid VEO prompts format from AI.");
};
