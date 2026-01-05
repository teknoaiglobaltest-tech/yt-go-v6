// services/gemini/avatarService.ts
import { generateImagesFromText } from './sandboxImageService';

/**
 * Generates an avatar image using a specified prompt and visual style.
 * This function now dynamically constructs the prompt to match the desired style.
 * @param prompt A detailed description of the desired avatar.
 * @param visualStyle The artistic style for the avatar (e.g., 'Photorealistic', '3D Cartoon').
 * @param token The bearer token for authentication.
 * @returns A promise that resolves with the base64 encoded string of the generated avatar image.
 */
export const generateAvatarImage = async (prompt: string, visualStyle: string, token: string): Promise<string> => {
  let styleInstruction = '';
  
  switch (visualStyle) {
    case 'Photorealistic':
      styleInstruction = `Ultra-photorealistic portrait photo, indistinguishable from a real human photograph. Commercial photography style, Canon EOS R5, 85mm lens, f/1.8. Natural depth of field, realistic soft lighting, visible skin pores. 8K ultra-detailed, sharp focus.`;
      break;
    case '3D Cartoon (Gaya Pixar)':
      styleInstruction = `Charming 3D character in the style of modern Pixar animation. Expressive, oversized eyes, stylized proportions, soft rounded shapes. Soft, cinematic lighting. Whimsical and friendly.`;
      break;
    case '3D Render (Gaya Final Fantasy)':
      styleInstruction = `Highly detailed, realistic 3D character render, style of Final Fantasy VII Remake. Blend of realism and stylized beauty. Intricately detailed hair, flawless CGI skin, complex high-fidelity textures on clothing. Dramatic cinematic lighting. 8K resolution.`;
      break;
    case 'Anime Shounen':
        styleInstruction = `Dynamic 2D anime character, modern Shounen style (Naruto, Jujutsu Kaisen). Sharp line art, cel-shading, intense emotive eyes. Dynamic, action-oriented pose.`;
        break;
    default:
       styleInstruction = `High-quality, professional digital art in a ${visualStyle} style. 8K ultra-detailed resolution, sharp focus.`;
      break;
  }

  const finalPrompt = `
    9:16 portrait. Full-body or three-quarters view, facing forward, looking at camera.
    Style: ${styleInstruction}.
    Character: ${prompt}.
    Clean image: No text, no logos, no watermarks.
  `;
  
  const images = await generateImagesFromText({
    prompt: finalPrompt,
    aspectRatio: 'PORTRAIT_9_16',
    seed: '', // Let the service generate a random seed
    token: token,
    candidatesCount: 1,
  });

  if (images.length === 0) {
    throw new Error("Image generation returned no images.");
  }
  return images[0];
};