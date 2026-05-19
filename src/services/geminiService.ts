import { Rarity } from "../types";
import { db, storage, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";

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
  id?: string;
}

const imageInFlight = new Map<string, Promise<string | null>>();

export async function generateWordData(
  difficulty: string,
  specificWord?: string,
  forceRefresh: boolean = false
): Promise<GeneratedWord> {
  const targetWord = specificWord?.toUpperCase().replace(/[^A-Z]/g, "");
  
  if (targetWord && !forceRefresh) {
    try {
      const docRef = doc(db, "global_vault", targetWord);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        console.log(`[Nexus Client] Vault hit: ${targetWord}`);
        return snapshot.data() as GeneratedWord;
      }
    } catch (e: any) {
      console.warn(`[Nexus Client] Vault check failed for ${targetWord}:`, e);
      // Fall through to generate via server
    }
  }

  const response = await fetch("/api/generate-word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ difficulty, specificWord }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to generate word data");
  }

  const result: GeneratedWord = await response.json();
  const docId = result.word;

  try {
    const docRef = doc(db, "global_vault", docId);
    await setDoc(docRef, {
      ...result,
      id: docId,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log(`[Nexus Client] Persisted ${docId} to Vault`);
  } catch (e: any) {
    console.error(`[Nexus Client] Failed to persist ${docId}:`, e);
    // Don't throw, we still have the valid data
  }

  return result;
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
    const targetWord = word.toUpperCase();
    
    if (!forceRefresh) {
      try {
        const docRef = doc(db, "global_vault", targetWord);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists() && snapshot.data().imageUrl) {
          return snapshot.data().imageUrl;
        }
      } catch (e) {
        console.warn(`[Nexus Client] Image vault check failed:`, e);
      }
    }

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, name, description, rarity, visualKeywords, wordKorean }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate image");
      }

      const { base64 } = await response.json();
      
      const storageRef = ref(storage, `characters/${targetWord}.png`);
      console.log(`[Nexus Client] Uploading generated image to Storage...`);
      await uploadString(storageRef, base64, 'base64', { contentType: 'image/png' });
      const downloadUrl = await getDownloadURL(storageRef);
      
      try {
        const docRef = doc(db, "global_vault", targetWord);
        await setDoc(docRef, {
          imageUrl: downloadUrl,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.error(`[Nexus Client] Failed to update vault with imageUrl for ${targetWord}:`, e);
      }

      return downloadUrl;
    } catch (err: any) {
      console.error("[Nexus Client] Image pipeline failed:", err.message || err);
      return null;
    }
  })().finally(() => imageInFlight.delete(key));

  imageInFlight.set(key, promise);
  return promise;
}
