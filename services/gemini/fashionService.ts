

import { Type, Modality, GenerateContentResponse } from "@google/genai";
import { performGeminiAction } from "./aiService";

export const generateTryonImage = async (productBase64: string, productMimeType: string, modelBase64: string, modelMimeType: string): Promise<string> => {
  const prompt = `
Create a 9:16 portrait aspect ratio, ultra-photorealistic advertising image.

**Task:** The person from the second provided image (the model) must be shown wearing the clothing item from the first provided image (the product).

**CRITICAL RULES:**
1.  **MODEL LIKENESS:** Replicate the exact same person from the reference model image with 100% likeness — identical face, body shape, hair, and expression. Identity consistency is the #1 priority.
2.  **PRODUCT INTEGRATION:** The clothing product must be worn naturally by the model, conforming to their body shape with realistic folds, lighting, and shadows. The product's original details, color, and texture must be perfectly preserved.
3.  **PHOTOREALISM:** The final result must look like a professional studio photoshoot taken with a real camera (e.g., Canon EOS R5, 85mm lens, f/1.8), with realistic lighting and soft shadows.
4.  **BACKGROUND:** Create a simple, neutral studio background (like a light gray or off-white wall) that does not distract from the model and product.
5.  **ASPECT RATIO:** The final output image MUST be a 9:16 portrait.
6.  **CLEAN IMAGE:** The image must be clean. No text, subtitles, logos, watermarks, or graphic overlays.
`;
  
  const parts = [
    { text: prompt },
    { inlineData: { data: productBase64, mimeType: productMimeType } },
    { inlineData: { data: modelBase64, mimeType: modelMimeType } },
  ];

  // FIX: Explicitly type the response to resolve 'unknown' type errors.
  const response: GenerateContentResponse = await performGeminiAction(client => client.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: parts.reverse() },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  }));

  const candidate = response.candidates?.[0];
  if (!candidate) throw new Error("API did not return a candidate.");
  
  const part = candidate.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData) {
    return part.inlineData.data;
  }
  
  throw new Error(`Generation failed: ${candidate.finishReason}. ${candidate.finishMessage || ''}`);
};

export const generatePoseImage = async (imageBase64: string, imageMimeType: string, posePrompt: string, locationBase64?: string): Promise<string> => {
  const parts: any[] = [{ inlineData: { data: imageBase64, mimeType: imageMimeType } }];
  let prompt: string;

  if (locationBase64) {
      parts.push({ inlineData: { data: locationBase64, mimeType: 'image/jpeg' } });
      prompt = `
Create a 9:16 portrait aspect ratio, ultra-photorealistic image.

**Task:** Place the model from the first image into the background from the second image, and change the model's pose.

**CRITICAL RULES:**
1.  **MODEL LIKENESS:** Replicate the exact same person from the first image with 100% likeness — identical face, body, clothing, hair, and expression. Identity and outfit consistency are the #1 priority.
2.  **POSE CHANGE:** The model's pose must be changed to match this exact description: '${posePrompt}'.
3.  **SEAMLESS INTEGRATION:** The model must be seamlessly and realistically integrated into the background, with correct lighting, shadows, and perspective.
4.  **PHOTOREALISM:** The final result must look like a professional photograph taken with a real camera, indistinguishable from reality.
5.  **ASPECT RATIO:** The final output image MUST be a 9:16 portrait. Reframe the scene or extend the background naturally if needed to fit this format.
6.  **CLEAN IMAGE:** No text, subtitles, logos, or watermarks.
`;
  } else {
      prompt = `
Create a 9:16 portrait aspect ratio, ultra-photorealistic image.

**Task:** Change the pose of the model in the provided image.

**CRITICAL RULES:**
1.  **MODEL LIKENESS:** Replicate the exact same person from the image with 100% likeness — identical face and body. Identity consistency is the #1 priority.
2.  **POSE CHANGE:** The model's pose must be changed to match this exact description: '${posePrompt}'.
3.  **NO OTHER CHANGES:** The model's clothing, the background, and the original photo's style/lighting must remain exactly the same. Only change the model's pose.
4.  **PHOTOREALISM:** The final result must look like a real photograph, not a render.
5.  **ASPECT RATIO:** The final output image MUST be a 9:16 portrait. Reframe the scene or extend the background naturally if needed to fit this format.
6.  **CLEAN IMAGE:** No text, subtitles, logos, or watermarks.
`;
  }

  parts.push({ text: prompt });

  // FIX: Explicitly type the response to resolve 'unknown' type errors.
  const response: GenerateContentResponse = await performGeminiAction(client => client.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: parts.reverse() }, // Text prompt often works best last
    config: {
      responseModalities: [Modality.IMAGE],
    },
  }));

  const candidate = response.candidates?.[0];
  if (!candidate) throw new Error("API did not return a candidate.");
  
  const part = candidate.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData) {
    return part.inlineData.data;
  }
  
  throw new Error(`Generation failed: ${candidate.finishReason}. ${candidate.finishMessage || ''}`);
};

export const generateVeoPromptForPose = async (imageBase64: string): Promise<string> => {
    const prompt = `You are a creative director for a high-fashion brand, engineering VEO-3 prompts for an international campaign. Your task is to analyze the provided image of a model and generate a single, detailed VEO prompt for an 8-10 second video clip. This clip MUST be composed of 2-3 dynamic, smoothly-cut sub-scenes showcasing the model and the fashion in a sophisticated, cinematic style.

**CRITICAL INSTRUCTIONS:**
1.  **Header:** The prompt MUST start with the exact phrase "NO TEXT, NO SUBTITLES, NO CAPTIONS, NO ON-SCREEN WORDS." on its own line, followed by a blank line.
2.  **Multi-Scene Structure:** The main body of the prompt must describe the 2-3 sub-scenes clearly.
3.  **Cinematic Language:** Use descriptive, professional cinematography terms (e.g., slow-motion, tracking shot, rack focus, extreme close-up, lens flare).
4.  **Content Focus:** The scenes should highlight the model's professional movements, the texture and flow of the clothing, and create an aspirational, elegant mood.
5.  **Likeness:** Emphasize that the model's face, body, and clothing from the original image must be maintained with 100% consistency.

---
**EXAMPLE FASHION PROMPT (MULTI-SCENE):**

NO TEXT, NO SUBTITLES, NO CAPTIONS, NO ON-SCREEN WORDS.

A hyperrealistic 8K cinematic video, 9:16 portrait aspect ratio, featuring a high-fashion model wearing a flowing silk dress. The scene is set in a minimalist architectural setting with dramatic shadows.

The 8-second video consists of three seamlessly integrated shots:

Scene 1 (3s): Slow-motion tracking shot. The model walks gracefully towards the camera with a confident expression, the fabric of her outfit flowing with the movement. The lighting is dramatic, casting soft shadows.

Scene 2 (2s): Extreme close-up. A rack focus shot that transitions from the texture of the garment's fabric to the model's serene face. A subtle, natural lens flare glints across the screen.

Scene 3 (3s): Medium shot. The model strikes the exact pose from the reference image, holding it for a moment before turning and walking away as the scene fades.

Cinematography Details:
Lighting: Dramatic, high-contrast, directional soft light.
Mood: Elegant, powerful, sophisticated, aspirational.
Camera movements: Smooth tracking shots, slow push-ins, rack focus.
Composition: Rule of thirds, shallow depth of field (f/1.4).
Audio: Ambient, minimalist electronic music with a strong, slow beat.

Negative prompt: avoid unnatural motion, distorted faces, robotic movements, cartoonish visuals, text overlays, outfit inconsistencies.
---

Now, based on the provided image, generate a new, unique VEO prompt that follows these instructions and the style of the example.`;
  
    // FIX: Explicitly type the response to resolve 'unknown' type errors.
    const response: GenerateContentResponse = await performGeminiAction(client => client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
        ],
      },
    }));
  
    return response.text.trim();
  };
  
export const editImageWithPrompt = async (base64: string, mimeType: string, prompt: string): Promise<string> => {
  const finalPrompt = `
You are an expert photo editor. Your task is to perform a specific, non-destructive edit on the provided image based *only* on the user's instruction.

**User's Instruction:** "${prompt}"

**CRITICAL DIRECTIVES:**
1.  **EXECUTE THE EDIT:** You MUST apply the change described in the "User's Instruction". The output image should be visibly different from the input image, reflecting the requested edit. This is the highest priority.
2.  **MAINTAIN REALISM:** The edit must be photorealistic and seamlessly integrated. The final image must look like a real, unedited photograph.
3.  **PRESERVE IDENTITY:** If a person is in the image, their identity (face, body, etc.) must remain 100% the same. Do not change the person unless specifically asked to.
4.  **ISOLATE THE CHANGE:** Only change what is requested in the instruction. Preserve all other aspects of the image (e.g., background, lighting, composition) unless the instruction requires them to be changed.
5.  **CLEAN OUTPUT:** The final image must be clean. No text, logos, watermarks, or any other artifacts.
`;
  // FIX: Explicitly type the response to resolve 'unknown' type errors.
  const response: GenerateContentResponse = await performGeminiAction(client => client.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: base64,
            mimeType: mimeType,
          },
        },
        { text: finalPrompt },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  }));

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }
  throw new Error("No edited image was generated.");
};