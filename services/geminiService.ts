import { GoogleGenAI } from "@google/genai";

// Ensure the API key is available from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generatePlayerAvatar = async (color: string): Promise<string | null> => {
  try {
    // Using gemini-2.5-flash-image for avatar generation
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
            { 
                text: `A retro sci-fi pilot avatar, 8-bit pixel art style, glowing neon lines, primary color ${color}, on a black background, minimalist, face portrait.` 
            }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: '1:1',
        },
      },
    });
    
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            return `data:${mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating player avatar:", error);
    // Return a fallback placeholder if generation fails (optional but good for UX)
    return null;
  }
};
