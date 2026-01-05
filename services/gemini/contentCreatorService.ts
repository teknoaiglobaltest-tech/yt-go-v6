// services/gemini/contentCreatorService.ts
import { VeoPromptData } from "../../types";
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


interface StoryboardSceneData {
    description: string;
    script: string;
    characters_in_scene: string[];
}

interface CharacterData {
    name: string;
    description: string;
}

interface StoryGenerationResponse {
    storyboard: StoryboardSceneData[];
    characters: CharacterData[];
}

export const generateFullStoryPlan = async (
    storyIdea: string, 
    visualStyle: string, 
    language: string, 
    sceneCount: number,
    genre: string,
    location?: { name: string }
): Promise<StoryGenerationResponse> => {
  const systemPrompt = `You are a creative director and screenwriter for viral short-form videos (TikTok, Reels) for the Indonesian market. Your goal is to create a pure, engaging, story-driven narrative. This is for creative content, NOT for advertising or selling anything. There should be absolutely no mention of products, sales, or calls to action.

**CRITICAL INSTRUCTIONS:**
1.  **Pure Storytelling:** Craft a compelling mini-story based on the user's idea, strictly following the specified **Genre** and **Story Structure**. The narrative must be a self-contained, engaging story. Do NOT include any product placements, calls to action, or selling elements.
2.  **Characters:** Identify all characters. For each, create a unique name and a detailed, photorealistic 'description' for an AI image generator.
3.  **Storyboard:** Create a storyboard with the requested number of scenes. For each scene:
    *   'description': A vivid visual description. Describe the setting, character actions, camera angle, and mood.
    *   'script': A short voiceover script (22-30 syllables / suku kata)). **Crucially, the script must be in a narrative, storytelling style, as if one person is telling the story to the audience. The tone MUST be casual and engaging ('gaya narasi/bercerita, santai dan menarik').**
    *   'characters_in_scene': A list of character names in the scene.
4.  **Output Format:** Respond ONLY with a valid JSON object matching this schema: { "characters": [ { "name": "string", "description": "string" } ], "storyboard": [ { "description": "string", "script": "string", "characters_in_scene": ["string"] } ] }`;

  const userPrompt = `**User's Request:**
*   **Story Idea:** "${storyIdea}"
*   **Genre:** ${genre}
*   **Visual Style:** ${visualStyle}
*   **Language:** ${language}
*   **Number of Scenes:** ${sceneCount}
${location ? `*   **Setting / Location:** The story MUST take place at this location: "${location.name}"` : ''}

**Story Structure & Narrative Elements:**
You must structure the story across the ${sceneCount} scenes following this classic narrative arc. Distribute these phases logically.
1.  **Hook / Pembuka:** The first scene MUST grab attention immediately with a strong hook (a powerful sentence, a surprising situation, or an intriguing question).
2.  **Pengenalan Tokoh & Dunia:** Introduce the main characters and their initial situation.
3.  **Pemicu Konflik:** An event that changes everything for the characters.
4.  **Konflik & Perjuangan:** The characters' struggle, showing their ups and downs.
5.  **Klimaks:** The peak of the story's emotion or action.
6.  **Resolusi / Akhir:** The conclusion of the struggle. The final scene should have a reflective sentence that leaves an impression.

To make the story more memorable, incorporate these elements:
*   **Narator:** The script should be from the perspective of a narrator telling the story.
*   **Konflik Batin:** Show the characters' internal struggles.
*   **Simbolisme:** Use simple symbols to represent deeper meanings.
*   **Twist Kecil:** Consider adding a small, unexpected twist if it fits the genre.`;

  const jsonString = await generateText({ systemPrompt, userPrompt, isJsonOutput: true });

  return JSON.parse(jsonString);
};

export const generateHybridStoryPlan = async (
    storyIdea: string,
    visualStyle: string,
    language: string,
    sceneCount: number,
    genre: string,
    existingCharacters: { name: string; imageBase64: string }[],
    location?: { name: string }
): Promise<StoryGenerationResponse> => {
    // The Chutes text API is text-only. We cannot send images.
    // We will rely on character names instead.
    const characterInstructions = existingCharacters.map((char) => {
        return `- Pre-existing Character: "${char.name}". You must include this character in the story.`;
    }).join('\n');

    const systemPrompt = `You are a creative storyteller for the Indonesian market. Your task is to take a user's story idea and a list of PRE-EXISTING characters and create a pure story. This is for creative content, NOT for advertising. The narrative must not contain any product placements, calls to action, or selling elements.

**CRITICAL INSTRUCTIONS:**
1.  **Story & Script:** Create an engaging mini-story that fits the specified **Genre** and **Story Structure**. The 'script' for each scene must be in a narrative, storytelling style, as if one person is telling the story to the audience. The tone MUST be casual and engaging ('gaya narasi/bercerita, santai dan menarik'), and the length must be strictly between 22-30 syllables (suku kata).
2.  **Analyze and Augment:** Use the pre-existing characters. Determine if the story REQUIRES *additional* characters to fit the narrative.
3.  **Generate NEW Characters Only:** If new characters are needed, create definitions for THEM ONLY (name and detailed description). If not, the 'characters' list in the JSON must be an empty array [].
4.  **Create Storyboard:** Create a storyboard with the requested number of scenes, including 'description', 'script', and 'characters_in_scene'.
5.  **Output Format:** Respond ONLY with a valid JSON object matching this schema: { "characters": [ { "name": "string", "description": "string" } ], "storyboard": [ { "description": "string", "script": "string", "characters_in_scene": ["string"] } ] }`;
        
    const userPrompt = `**Pre-existing Characters to Use:**
${characterInstructions}

**User's Request:**
*   **Story Idea:** "${storyIdea}"
*   **Genre:** ${genre}
*   **Visual Style:** ${visualStyle}
*   **Language:** ${language}
*   **Number of Scenes:** ${sceneCount}
${location ? `*   **Setting / Location:** The story MUST take place here: "${location.name}"` : ''}

**Story Structure & Narrative Elements:**
You must structure the story across the ${sceneCount} scenes following this classic narrative arc. Distribute these phases logically.
1.  **Hook / Pembuka:** The first scene MUST grab attention immediately.
2.  **Pengenalan Tokoh & Dunia:** Re-introduce the pre-existing characters in their current situation.
3.  **Pemicu Konflik:** An event that changes everything.
4.  **Konflik & Perjuangan:** The characters' struggle.
5.  **Klimaks:** The peak of the story's emotion or action.
6.  **Resolusi / Akhir:** The conclusion, ending with a reflective sentence.

To make the story more memorable, incorporate:
*   **Narator:** The script should be from a narrator's perspective.
*   **Konflik Batin:** Show the characters' internal struggles.
*   **Simbolisme & Twist Kecil:** Use symbols or small twists where appropriate.`;
    
    const jsonString = await generateText({ systemPrompt, userPrompt, isJsonOutput: true });

    return JSON.parse(jsonString);
};


export const composeMultiCharacterSceneImage = async (
    characterImages: { name: string; imageBase64: string }[], 
    sceneDescription: string, 
    visualStyle: string,
    token: string,
    locationBase64?: string
): Promise<string> => {
    
    const prompt = `
Create a 9:16 portrait aspect ratio image in a **${visualStyle}** style.

**Scene Description:** "${sceneDescription}"

**CRITICAL RULES:**
1.  **CHARACTER LIKENESS:** Replicate the exact likeness of each character from their respective reference images. Identity consistency is the #1 priority.
2.  **SCENE COMPOSITION:** Arrange the characters and background according to the **Scene Description**.
3.  **BACKGROUND:** If a location image is provided, use it as the background. Otherwise, create a suitable background.
4.  **STYLE ADHERENCE:** The entire image must conform to the specified **Visual Style**.
5.  **CLEAN IMAGE:** No text, subtitles, logos, or watermarks.
`;
    const dataUrlPrefix = 'data:image/jpeg;base64,';

    const uploadPromises = characterImages.map(char => {
        const dataUrl = `${dataUrlPrefix}${char.imageBase64}`;
        const file = dataURLtoFile(dataUrl, `${char.name}.jpg`);
        return uploadImage(file, dataUrl, token);
    });

    if (locationBase64) {
        const dataUrl = `${dataUrlPrefix}${locationBase64}`;
        const file = dataURLtoFile(dataUrl, `location.jpg`);
        uploadPromises.push(uploadImage(file, dataUrl, token));
    }
    
    const mediaIds = await Promise.all(uploadPromises);

    return await generateImage(mediaIds, prompt, 'PORTRAIT_9_16', token);
};

export const generateVeoPromptsFromScenes = async (sceneDescription: string, script: string, visualStyle: string): Promise<VeoPromptData> => {
    const systemPrompt = `You are a world-class cinematic director and VEO-3 prompt engineer. Your task is to create a JSON object for a single, hyper-cinematic 8-second video clip based on a scene description, animating it with sophisticated techniques.

**CRITICAL INSTRUCTIONS:**
1.  **JSON Output ONLY:** Your entire response MUST be a single, valid JSON object. No markdown, no explanations.
2.  **Cinematic Multi-Shot Structure:** The 'mainPrompt' MUST describe an 8-second video composed of 2-3 distinct, seamlessly connected sub-scenes (shots). Use professional cinematography terms.
3.  **Detailed Animation:** Describe subtle, realistic animations for characters (micro-expressions like a slight smile, slow blink, thoughtful glance, natural breathing) and the environment (dust motes in light, gentle sway of plants, fabric movement).
4.  **Schema and Content Guidelines:**
    *   **dialogueInstruction (string):** Create a clear audio instruction in Bahasa Indonesia for a narrator. The style MUST be narration ('narasi'), meaning the character in the video should not speak. The instruction must contain the script verbatim.
    *   **mainPrompt (string):**
        *   Start with: "A hyperrealistic 8K cinematic video, 9:16 portrait ratio, in a ${visualStyle} style."
        *   Describe the full scene, characters, and environment in rich detail.
        *   Structure the 8-second clip into 2-3 numbered shots with durations, like this: "Scene 1 (3s): [Description of camera move and action]. Scene 2 (2s): [Description of a different camera angle, like a close-up]. Scene 3 (3s): [Description of the final action and camera move]."
        *   Use cinematic terms: 'slow dolly push', 'rack focus from foreground to character's face', 'extreme close-up on the character's eyes', 'gentle orbital pan', 'subtle lens flare'.
    *   **negativePrompt (string):** Use this exact, comprehensive string: "low quality, jagged, flickering, distorted face, unnatural movement, robotic, stiff, poor lip-sync, CGI, 3D render, cartoon, text, watermark, logo, blurry, mutated hands, extra limbs, bad anatomy, disproportionate, creepy, static background, dead eyes, bad lighting, plastic look"

---
**EXAMPLE of a CINEMATIC OUTPUT:**
\`\`\`json
{
  "dialogueInstruction": "A narrator speaks in a calm, thoughtful tone in Bahasa Indonesia: 'Setiap hari sama, capek, butuh sesuatu yang baru.'",
  "mainPrompt": "A hyperrealistic 8K cinematic video, 9:16 portrait ratio, in a cinematic style. A tired Indonesian programmer in his late 20s sits in a dimly lit, cozy room at night. The 8-second video consists of three seamlessly integrated shots: Scene 1 (3s): A slow tracking shot pushes towards the character as he slumps over an old keyboard, his face illuminated by the monitor's cool glow. He blinks slowly, a sigh visible in his posture. Scene 2 (2s): Extreme close-up rack focus from his fingers hesitating over the keys to his exhausted, emotionless eyes. You can see the reflection of code in his glasses. Scene 3 (3s): A medium shot from the side. He leans back, running a hand through his hair in frustration. Dust motes dance in the single beam of light from a desk lamp.",
  "negativePrompt": "low quality, jagged, flickering, distorted face, unnatural movement, robotic, stiff, poor lip-sync, CGI, 3D render, cartoon, text, watermark, logo, blurry, mutated hands, extra limbs, bad anatomy, disproportionate, creepy, static background, dead eyes, bad lighting, plastic look"
}
\`\`\`
---

Now, based on the provided scene description and script, generate your JSON object.`;

    const userPrompt = `**Scene Context:**
*   **Scene Description:** "${sceneDescription}"
*   **Voiceover Script:** "${script}"
*   **Visual Style:** ${visualStyle}`;

    const jsonString = await generateText({ systemPrompt, userPrompt, isJsonOutput: true });

    try {
        return JSON.parse(jsonString) as VeoPromptData;
    } catch (e) {
        console.error("Failed to parse JSON response from AI:", jsonString);
        throw new Error("AI returned an invalid JSON format for the VEO prompt.");
    }
};
