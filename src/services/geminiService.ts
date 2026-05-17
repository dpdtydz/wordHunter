import { Rarity } from "../types";

export interface GeneratedWord {
  word: string;
  wordKorean: string;
  wordDefinition: string;
  wordHint: string;
  visualKeywords: string;  // 3 art-direction keywords separated by " / "
  /** @deprecated kept for Firestore backwards-compat, same value as visualKeywords */
  visualEmoji: string;
  category: '생명체' | '유물' | '현상' | '공간' | '추상' | '상황' | '관계';
  characterName: string;
  charDescription: string;
  rarity: Rarity;
  imageUrl?: string;
}

const imageInFlight = new Map<string, Promise<string | null>>();

export async function generateWordData(
  difficulty: string,
  specificWord?: string,
  forceRefresh: boolean = false
): Promise<GeneratedWord> {
  const response = await fetch("/api/generate-word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ difficulty, specificWord, forceRefresh }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to generate word data");
  }

  return response.json();
}

export function generateAndStoreCharacterImage(
  word: string,
  name: string,
  description: string,
  rarity: Rarity,
  visualKeywords: string = "",
  wordKorean: string = "",
  forceRefresh: boolean = false
): Promise<string | null> {
  const key = `${word.toUpperCase()}${forceRefresh ? "_refresh" : ""}`;

  if (imageInFlight.has(key)) {
    return imageInFlight.get(key)!;
  }

  const promise = (async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, name, description, rarity, visualKeywords, wordKorean, forceRefresh }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate image");
      }

      const { imageUrl } = await response.json();
      return imageUrl;
    } catch (err: any) {
      console.error("[Nexus Client] Image pipeline failed:", err.message || err);
      return null;
    }
  })().finally(() => imageInFlight.delete(key));

  imageInFlight.set(key, promise);
  return promise;
}
