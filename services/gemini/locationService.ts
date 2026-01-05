import { generateImagesFromText } from './sandboxImageService';

export const generateLocationImage = async (prompt: string, token: string): Promise<string> => {
  const finalPrompt = `
Create an ultra-photorealistic background image suitable for a product advertisement. The image must look like a real photograph, not CGI or a 3D render.

**Scene Description:** ${prompt}

**CRITICAL RULES:**
1.  **Aspect Ratio:** The final image MUST be a 9:16 portrait aspect ratio.
2.  **Photorealism:** The result must be indistinguishable from a high-resolution photograph taken with a professional camera. Focus on realistic lighting, textures, and depth of field.
3.  **Composition:** The scene should be visually appealing and composed with a clear area that could serve as a focal point. Unless specified, the scene should not contain prominent people.
4.  **Quality:** The image must be ultra-detailed, 8K, with clean and sharp focus and cinematic color grading.
5.  **Clean Image:** No text, no logos, no watermarks, no frames.
`;

  const images = await generateImagesFromText({
    prompt: finalPrompt,
    aspectRatio: 'PORTRAIT_9_16',
    seed: '',
    token: token,
    candidatesCount: 1,
  });

  if (images.length === 0) {
      throw new Error("Image generation did not return any images.");
  }
  return images[0];
};