import { GoogleGenAI } from "@google/genai";
import { dbService } from '../db';
import { ApiKey } from '../../types';

let allKeys: ApiKey[] = [];
let activeKeyId: number | null = null;
let lastKeysFetch = 0;

// Function to get keys and cache them lightly to avoid DB hits on every single call
const getKeys = async (forceRefresh = false): Promise<ApiKey[]> => {
    const now = Date.now();
    // Refresh cache if older than 1 minute or forced
    if (allKeys.length === 0 || forceRefresh || (now - lastKeysFetch > 60000)) {
        allKeys = await dbService.getApiKeys();
        const activeIdSetting = await dbService.getSetting('activeApiKeyId');
        activeKeyId = activeIdSetting?.value as number | null;
        lastKeysFetch = now;
    }
    if (allKeys.length === 0) {
        throw new Error("No Gemini API keys found in the database. Please add one in Settings.");
    }
    return allKeys;
};

/**
 * Executes a Gemini AI action with automatic API key rotation on failure.
 * It tries the currently active key first, then cycles through other available keys.
 * If an action is successful with a new key, that key is set as the new active key.
 * @param action A function that takes a GoogleGenAI client instance and returns a Promise with the result.
 * @returns The result of the AI action.
 * @throws Throws an error if the action fails with all available API keys.
 */
export const performGeminiAction = async <T>(action: (client: GoogleGenAI) => Promise<T>): Promise<T> => {
    const keys = await getKeys();
    
    // Sort keys to prioritize the active one
    const sortedKeys = [...keys].sort((a, b) => {
        if (a.id === activeKeyId) return -1;
        if (b.id === activeKeyId) return 1;
        return (a.id ?? 0) - (b.id ?? 0); // Fallback to a stable sort
    });

    let lastError: any = null;

    for (const key of sortedKeys) {
        try {
            console.log(`Trying Gemini API with key: ${key.name}`);
            const client = new GoogleGenAI({ apiKey: key.key });
            const result = await action(client);

            // If successful, update the active key if it changed, then return
            if (key.id !== activeKeyId) {
                console.log(`Switching active Gemini key to: ${key.name}`);
                await dbService.addSetting({ key: 'activeApiKeyId', value: key.id });
                activeKeyId = key.id; // Update local cache
            }
            return result;
        } catch (error) {
            console.error(`Gemini API call failed for key "${key.name}":`, error);
            lastError = error;
            // Here you could check for specific error types (e.g., auth, quota)
            // For now, we'll just try the next key on any failure.
        }
    }

    // If all keys failed, refresh the key list from DB once and retry the whole process.
    // This handles the case where keys were updated in another tab.
    console.warn("All keys failed. Forcing a refresh of the key list and retrying...");
    const refreshedKeys = await getKeys(true);
    const refreshedSortedKeys = [...refreshedKeys].sort((a, b) => {
        if (a.id === activeKeyId) return -1;
        if (b.id === activeKeyId) return 1;
        return (a.id ?? 0) - (b.id ?? 0);
    });

     for (const key of refreshedSortedKeys) {
        try {
            console.log(`Retrying Gemini API with key: ${key.name}`);
            const client = new GoogleGenAI({ apiKey: key.key });
            const result = await action(client);
            if (key.id !== activeKeyId) {
                await dbService.addSetting({ key: 'activeApiKeyId', value: key.id });
                activeKeyId = key.id;
            }
            return result;
        } catch (error) {
            console.error(`Gemini API retry failed for key "${key.name}":`, error);
            lastError = error;
        }
    }


    throw lastError || new Error("All Gemini API keys failed, even after refreshing the list.");
};
