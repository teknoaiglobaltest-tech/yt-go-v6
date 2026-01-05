import { Modality, GenerateContentResponse } from "@google/genai";
import { performGeminiAction } from "./aiService";

// Based on user's prompt, this model is used for TTS.
const TTS_MODEL = "gemini-2.5-flash-preview-tts";

export const generateSpeech = async (text: string, voice: string, speakingRate: number): Promise<string> => {
  try {
    // FIX: Add GenerateContentResponse type to the response from performGeminiAction.
    const response: GenerateContentResponse = await performGeminiAction(client => client.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
          // FIX: The 'speakingRate' property is part of 'speechConfig'.
          speakingRate: speakingRate,
        },
      },
    }));

    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (data) {
      return data;
    } else {
      const candidate = response.candidates?.[0];
      const reason = candidate?.finishReason || 'Unknown reason';
      const message = candidate?.finishMessage || 'No specific message.';
      throw new Error(`Audio data not found in response. Reason: ${reason}. Message: ${message}`);
    }
  } catch (error) {
    console.error("Error generating speech:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to generate speech: ${error.message}`);
    }
    throw new Error("An unknown error occurred while generating speech.");
  }
};