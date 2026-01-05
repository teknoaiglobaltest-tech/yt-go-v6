import { fetchWithChutesFallbacks } from './chutesKeyService';

const API_URL = "https://llm.chutes.ai/v1/chat/completions";
const MODEL = "deepseek-ai/DeepSeek-V3-0324";

interface GenerateTextParams {
    systemPrompt?: string;
    userPrompt: string;
    isJsonOutput?: boolean;
}

export const generateText = async ({ systemPrompt, userPrompt, isJsonOutput = false }: GenerateTextParams): Promise<string> => {
    const messages = [];
    if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: userPrompt });

    const payload: any = {
        model: MODEL,
        messages,
        max_tokens: 4096,
        temperature: 0.5,
    };
    
    // The model supports json_object format.
    if (isJsonOutput) {
        payload.response_format = { type: "json_object" };
    }

    const response = await fetchWithChutesFallbacks(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
        console.error("Chutes.ai unexpected response:", data);
        throw new Error("Chutes.ai did not return any content.");
    }

    // The API might wrap JSON in markdown, so let's strip it.
    const cleanedContent = content.trim().replace(/^```json|```$/g, '');
    return cleanedContent;
};
