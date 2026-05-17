import { GoogleGenAI, Type } from "@google/genai";
import { Rarity } from "../types";
import { db, storage } from "../lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadString, getDownloadURL, uploadBytes } from "firebase/storage";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = "당신은 고퀄리티 수집형 판타지 RPG 캐릭터 도감 작가입니다. 이모지(🔥⚔️ 등)와 이모티콘을 절대로 사용하지 마세요. 모든 텍스트는 순수한 한국어/영어 문자로만 작성하세요.";

export interface GeneratedWord {
  word: string;
  wordKorean: string;
  wordDefinition: string;
  wordHint: string;
  visualEmoji: string;
  category: '생명체' | '유물' | '현상' | '공간' | '추상' | '상황' | '관계';
  characterName: string;
  charDescription: string;
  rarity: Rarity;
  imageUrl?: string;
}

const RARITIES: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Unique', 'Epic', 'Legendary'];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const errorMessage = err.message || JSON.stringify(err);
      const isQuotaError = errorMessage.includes("429") || 
                          errorMessage.includes("RESOURCE_EXHAUSTED") || 
                          errorMessage.includes("quota") ||
                          err.status === "RESOURCE_EXHAUSTED";

      if (isQuotaError && i < maxRetries) {
        const delay = Math.pow(2, i) * 5000; // More aggressive backoff: 5s, 10s, 20s
        console.warn(`[Gemini] Quota hit (Attempt ${i + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export async function generateWordData(
  difficulty: string, 
  specificWord?: string, 
  forceRefresh: boolean = false
): Promise<GeneratedWord> {
  return callWithRetry(async () => {
    const model = "gemini-3-flash-preview"; // Recommended for Basic Text Tasks in Gemini API skill
    
    let targetWord = specificWord?.toUpperCase().replace(/[^A-Z]/g, '');

    // If we have a specific word, check vault first to avoid ANY API call
    if (targetWord && !forceRefresh) {
      try {
        const vaultRef = doc(db, 'global_vault', targetWord);
        const vaultSnap = await getDoc(vaultRef);
        if (vaultSnap.exists()) {
          console.log(`[Nexus] Reusing global archive for: ${targetWord}`);
          const data = vaultSnap.data();
          return {
            word: data.word,
            wordKorean: data.wordKorean,
            wordDefinition: data.wordDefinition,
            wordHint: data.wordHint,
            visualEmoji: data.visualEmoji,
            category: data.category,
            characterName: data.characterName,
            charDescription: data.charDescription || data.description,
            rarity: data.rarity,
            imageUrl: data.imageUrl || ""
          } as GeneratedWord;
        }
      } catch (err) {
        console.warn("Vault check failed", err);
      }
    }

    // Generate text meta (and pick word if needed) in one single request
    console.log(`[Nexus] Manifesting new character meta... Target: ${targetWord || 'Random'}`);
    
    const prompt = targetWord 
      ? `대상 단어 "${targetWord}"(${difficulty} 난이도)에 대한 데이터를 생성해줘.`
      : `영단어 학습 게임을 위한 ${difficulty} 난이도의 매력적인 영단어 1개를 직접 선정하고 그에 대한 데이터를 생성해줘.`;

    console.log(`[Nexus] Text Prompt: ${prompt}`);

    const instructions = `
    실체화된 단어들의 도서관 "워드 넥서스"를 위한 단어 데이터를 생성해줘.
    
    데이터 구성 가이드 (초고품질 수집형 RPG 스타일):
    1. 단어 정보 (Educational):
       - word: 대상 단어 (Uppercase).
       - wordKorean: 한국어 뜻.
       - wordDefinition: 영영사전을 요약한듯한 정확한 한국어 정의.
       - wordHint: 단어를 직접적으로 말하지 않으면서 추측할 수 있게 도와주는 사전적 힌트.
    
    2. 넥서스 실체화 캐릭터 (Nexus Lore):
       - characterName: 단어의 본질이 현신한 존재의 이름.
       - visualEmoji: 캐릭터의 분위기를 표현하는 키워드 3개를 "/"로 구분 (이모지 금지).
       - charDescription: 존재의 기원과 서사 (2-3문장).
       - category: '생명체' | '유물' | '현상' | '공간' | '추상' | '상황' | '관계' 중 택 1.
       - rarity: Common|Uncommon|Rare|Unique|Epic|Legendary
    
    반드시 한국어로 작성하고 JSON 형식으로 반환해.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt + instructions,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            wordKorean: { type: Type.STRING },
            wordDefinition: { type: Type.STRING },
            wordHint: { type: Type.STRING },
            visualEmoji: { type: Type.STRING },
            category: { type: Type.STRING, enum: ['생명체', '유물', '현상', '공간', '추상', '상황', '관계'] },
            characterName: { type: Type.STRING },
            charDescription: { type: Type.STRING },
            rarity: { type: Type.STRING, enum: ['Common', 'Uncommon', 'Rare', 'Unique', 'Epic', 'Legendary'] },
          },
          required: ["word", "wordKorean", "wordDefinition", "wordHint", "visualEmoji", "category", "characterName", "charDescription", "rarity"],
        },
      },
    });

    const result = JSON.parse(response.text) as GeneratedWord;
    console.log(`[Nexus] Meta generation success: ${result.word} (${result.characterName})`);
    result.word = result.word.toUpperCase().replace(/[^A-Z]/g, '');
    result.imageUrl = "";
    
    // Save to Vault
    try {
      const vid = result.word;
      const vaultData = {
        ...result,
        id: vid,
        characterId: vid,
        name: result.characterName,
        description: result.charDescription,
        capturedAt: serverTimestamp(),
        count: 1,
        level: 1,
        isShiny: false,
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'global_vault', vid), vaultData, { merge: true });
    } catch (err: any) {
      console.warn("Vault update skipped or failed", err.message);
    }

    return result;
  });
}

export async function generateAndStoreCharacterImage(
  word: string, 
  name: string, 
  description: string,
  rarity: Rarity,
  forceRefresh: boolean = false
): Promise<string | null> {
  const storageRef = ref(storage, `characters/${word.toUpperCase()}.png`);

  // 1. Check if image already exists in storage (Only if not forceRefreshing)
  if (!forceRefresh) {
    try {
      const existingUrl = await getDownloadURL(storageRef);
      console.log(`[Nexus] Reusing stored image for: ${word}`);
      return existingUrl;
    } catch (err) {
      // Doesn't exist, proceed to generate
    }
  }

  console.log(`[Nexus] Visualizing with Gemini 2.5 Flash Image: ${name}`);
  const prompt = `
    High-end mobile collector RPG character card art. Portrait format.
    Character: ${name} (${word})
    Description: ${description}
    Rarity: ${rarity}
    Detailed anime fantasy style, cinematic lighting, 4k resolution. No text.
  `.trim();
  console.log(`[Nexus] Image Generation Prompt: ${prompt}`);

  const generateImgData = async () => {
    let base64Data = null;

    try {
      console.log(`[Nexus] Attempting primary model: gemini-2.5-flash-image`);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt,
        config: {
          imageConfig: {
            aspectRatio: "3:4"
          }
        }
      });

      console.log(`[Nexus] Primary model response parts count: ${response.candidates?.[0]?.content?.parts?.length || 0}`);
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          console.log(`[Nexus] Found inlineData in primary model response (modality: ${part.inlineData.mimeType})`);
          base64Data = part.inlineData.data;
          break;
        }
      }
      
      if (!base64Data) {
        console.warn("[Nexus] No inlineData found in 2.5 Flash response candidates.");
        throw new Error("No image data in 2.5 Flash Image response");
      }
      console.log("[Nexus] Primary model generation success.");
    } catch (err: any) {
      console.warn(`[Nexus] Primary image model failed: ${err.message}. Trying Imagen 3.`);
      
      try {
        console.log(`[Nexus] Attempting fallback model: imagen-3.0-generate-001`);
        const imagenResponse = await ai.models.generateImages({
          model: 'imagen-3.0-generate-001',
          prompt,
          config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio: '3:4' },
        });
        
        base64Data = imagenResponse.generatedImages?.[0]?.image?.imageBytes;
        if (base64Data) {
          console.log("[Nexus] Imagen 3 fallback success.");
        } else {
          console.warn("[Nexus] Imagen 3 returned no images.");
        }
      } catch (err2: any) {
        console.error("[Nexus] All image models exhausted:", err2.message);
        throw err; // Re-throw primary error
      }
    }
    return base64Data;
  };

  try {
    const base64Data = await callWithRetry(generateImgData);

    if (base64Data) {
      console.log(`[Nexus] Processing image data for upload... Type: ${typeof base64Data} (${typeof base64Data === 'string' ? base64Data.length : base64Data.length} units)`);
      // 2. Upload to Firebase Storage
      console.log(`[Nexus] Uploading to Firebase Storage: characters/${word.toUpperCase()}.png`);
      
      const uploadStartTime = Date.now();
      try {
        if (typeof base64Data !== 'string') {
          // Use uploadBytes for binary data (Uint8Array)
          console.log(`[Nexus] Binary data detected. Using uploadBytes... Size: ${base64Data.length} bytes`);
          await uploadBytes(storageRef, base64Data as Uint8Array, { contentType: 'image/png' });
        } else {
          // Use uploadString for base64
          console.log(`[Nexus] Base64 string detected. Using uploadString... Length: ${base64Data.length}`);
          await uploadString(storageRef, base64Data, 'base64', { contentType: 'image/png' });
        }
        console.log(`[Nexus] Firebase Storage upload completed in ${Date.now() - uploadStartTime}ms`);
      } catch (uploadErr: any) {
        console.error(`[Nexus] Firebase Storage upload FAILED:`, uploadErr);
        throw uploadErr;
      }

      console.log(`[Nexus] Fetching download URL...`);
      const downloadUrl = await getDownloadURL(storageRef);
      console.log(`[Nexus] Upload success. Download URL: ${downloadUrl.split('?')[0]}...`);

      // 3. Update Firestore Vault
      try {
        await setDoc(doc(db, 'global_vault', word.toUpperCase()), { 
          imageUrl: downloadUrl,
          updatedAt: serverTimestamp() 
        }, { merge: true });
      } catch (err) {
        console.warn("[Nexus] Updating vault with image URL failed", err);
      }

      return downloadUrl;
    } else {
      console.error("[Nexus] All image generation attempts failed (no image data in response)");
    }
  } catch (err: any) {
    console.error("[Nexus] Image generation/storage failed", err.message || err);
  }
  return null;
}

export async function generateCharacterImage(name: string, word: string, description: string): Promise<string | null> {
  // Keeping this for compatibility or simpler use cases, but generateAndStoreCharacterImage is preferred
  return generateAndStoreCharacterImage(word, name, description, 'Common');
}

export async function generateCharacterStory(charName: string, word: string): Promise<string> {
  return callWithRetry(async () => {
    const model = "gemini-3-flash-preview";
    const prompt = `단어 "${word}"의 개념에서 태어난 캐릭터 "${charName}"의 짧은 배경 스토리(1-2문장)를 작성해줘. 귀여우면서도 약간은 어두운 판타지 톤을 유지해줘. 한국어로 작성해.`;
    
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });
    
    return response.text.trim();
  });
}
