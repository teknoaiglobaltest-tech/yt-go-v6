import { performGeminiAction } from './aiService';
import { Modality, GenerateContentResponse } from '@google/genai';

/**
 * Preprocesses an image from a data URL to a 9:16 aspect ratio using AI outpainting.
 * The AI extends the background to fill the frame while keeping the original subject centered.
 * @param imageDataUrl The original image as a data URL.
 * @returns A promise that resolves with the new 9:16 image as a JPEG data URL.
 */
export const preprocessImageTo916 = async (imageDataUrl: string): Promise<string> => {
  const base64Data = imageDataUrl.split(',')[1];
  const mimeType = imageDataUrl.split(';')[0].split(':')[1];

  if (!base64Data || !mimeType) {
    throw new Error('Invalid image data URL provided for preprocessing.');
  }

  const prompt = `
Take the provided image and extend its background to create a new image with a 9:16 portrait aspect ratio.

CRITICAL RULES:
1.  The original image content, subject, and quality must be perfectly preserved and centered within the new frame. Do NOT alter the subject.
2.  The newly generated background must seamlessly and realistically blend with the original image's environment, lighting, and style.
3.  For example, if it's a person in a park, extend the park scenery naturally. If it's a product on a wooden table, extend the table and its surroundings.
4.  The final result must be a photorealistic, high-quality 9:16 image.
5.  Do not add any text, watermarks, logos, or frames.
`;

  // FIX: Add GenerateContentResponse type to the response from performGeminiAction.
  const response: GenerateContentResponse = await performGeminiAction(client => client.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { data: base64Data, mimeType: mimeType } },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  }));

  const candidate = response.candidates?.[0];
  if (!candidate) {
    throw new Error("AI did not return a candidate for image processing.");
  }
  
  const part = candidate.content?.parts?.find(p => p.inlineData);
  if (part?.inlineData?.data) {
    // Gemini often returns JPEG, so we standardize the output mime type.
    return `data:image/jpeg;base64,${part.inlineData.data}`;
  }
  
  throw new Error(`Image processing failed: ${candidate.finishReason}. ${candidate.finishMessage || ''}`);
};