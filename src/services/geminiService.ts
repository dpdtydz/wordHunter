import { GoogleGenAI, Type } from "@google/genai";
import { Rarity } from "../types";
import { db, storage } from "../lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadString, getDownloadURL, uploadBytes } from "firebase/storage";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `당신은 세계적인 수집형 판타지 RPG "워드 넥서스"의 수석 세계관 설계자입니다.
단어 하나하나가 살아있는 존재로 실체화되는 이 세계에서, 당신은 각 단어의 본질을 가장 극적이고 매력적인 캐릭터로 빚어냅니다.
이모지나 이모티콘은 절대 사용하지 마세요. 모든 텍스트는 순수한 한국어/영어 문자로만 작성하세요.`;

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

// Prevents duplicate concurrent image generation for the same word
const imageInFlight = new Map<string, Promise<string | null>>();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const msg = err.message || JSON.stringify(err);
      const isQuota =
        msg.includes("429") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("quota") ||
        err.status === "RESOURCE_EXHAUSTED";

      if (isQuota && i < maxRetries) {
        const delay = Math.pow(2, i) * 5000;
        console.warn(`[Gemini] Quota hit (${i + 1}/${maxRetries + 1}), retrying in ${delay}ms…`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

const RARITY_LORE: Record<Rarity, string> = {
  Common:    "흔하게 목격되는 존재. 평범하지만 세계의 근간을 이루는 힘을 지닌다.",
  Uncommon:  "일반인의 눈에는 잘 보이지 않는 존재. 숨겨진 가능성을 품고 있다.",
  Rare:      "극히 드문 확률로만 실체화되는 존재. 강렬한 에너지 파장을 발한다.",
  Unique:    "동일한 형태가 세상에 하나뿐인 고유한 존재. 독자적인 법칙 아래 움직인다.",
  Epic:      "넥서스의 역사를 바꾼 전설적 존재. 그 이름만으로도 현실이 흔들린다.",
  Legendary: "신화 속에서만 존재한다고 여겨졌던 초월적 존재. 세계의 근본 법칙 그 자체다.",
};

const RARITY_ART_DIRECTION: Record<Rarity, string> = {
  Common:
    "Clean, grounded illustration with a warm natural color palette. Approachable and relatable character design. Soft ambient lighting.",
  Uncommon:
    "Polished character design with vibrant accent colors. Dynamic confident pose. Subtle magical shimmer around the silhouette.",
  Rare:
    "Premium illustration with intricate costume details. Dramatic cinematic side-lighting. Elegant particle or elemental effects tied to the word's theme.",
  Unique:
    "Striking iconic design with a distinctive color signature no other card shares. Powerful stance. Complex patterns or motifs etched into armor/clothing that reference the word's meaning.",
  Epic:
    "High-drama composition. Intense magical storm or world-scale elemental effects. The character radiates overwhelming presence; background reality warps slightly around them.",
  Legendary:
    "Transcendent masterpiece. Cosmic or divine scale. Reality fractures behind the character. Every pixel must feel inevitable and awe-inspiring. This is the pinnacle visual expression of the concept.",
};

export async function generateWordData(
  difficulty: string,
  specificWord?: string,
  forceRefresh: boolean = false
): Promise<GeneratedWord> {
  return callWithRetry(async () => {
    const model = "gemini-2.5-flash";

    let targetWord = specificWord?.toUpperCase().replace(/[^A-Z]/g, "");

    // Check vault first — avoids any API call for known words
    if (targetWord && !forceRefresh) {
      try {
        const snap = await getDoc(doc(db, "global_vault", targetWord));
        if (snap.exists()) {
          console.log(`[Nexus] Vault hit: ${targetWord}`);
          const d = snap.data();
          const vk = d.visualKeywords || d.visualEmoji || "";
          return {
            word: d.word,
            wordKorean: d.wordKorean,
            wordDefinition: d.wordDefinition,
            wordHint: d.wordHint,
            visualKeywords: vk,
            visualEmoji: vk,
            category: d.category,
            characterName: d.characterName,
            charDescription: d.charDescription || d.description,
            rarity: d.rarity,
            imageUrl: d.imageUrl || "",
          } as GeneratedWord;
        }
      } catch (err) {
        console.warn("[Nexus] Vault check failed", err);
      }
    }

    const basePrompt = targetWord
      ? `대상 단어: "${targetWord}" (난이도: ${difficulty})`
      : `영단어 학습 게임용 ${difficulty} 난이도의 흥미로운 영단어 1개를 직접 선정하라.`;

    const instructions = `
워드 넥서스 세계관 데이터 생성 — 최고 품질 수집형 RPG 기준.

${basePrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[SECTION 1] 영단어 학습 데이터
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• word: 대상 단어 (영문 대문자)
• wordKorean: 핵심 한국어 뜻 (1~3단어, 간결하게)
• wordDefinition: 사전적 정의를 기반으로 한 한국어 설명 (1~2문장)
• wordHint: 단어를 직접 언급하지 않고 맥락·유래·연상으로 추측 가능한 힌트 (1문장)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[SECTION 2] 넥서스 실체화 존재 프로필
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
이 단어의 개념과 의미가 "살아있는 존재"로 실체화된다면 어떤 모습일지 설계하라.
캐릭터의 외형, 능력, 성격 모두가 단어의 본질에서 비롯되어야 한다.

• characterName: 단어의 본질을 담은 존재의 고유한 이름 (한국어 또는 한자어 기반, 2~6자)
  예시 패턴: "침묵의 집행자", "폭풍의 대변인", "망각의 수호자" 등
  — 절대 영단어를 그대로 사용하지 말 것

• visualKeywords: AI 이미지 생성에 최적화된 영문 시각 키워드 3개를 " / " 로 구분
  반드시 다음 형식을 따를 것: [주요 시각적 요소] / [분위기·조명] / [환경·배경]
  예시(HARVEST): golden wheat fields / warm harvest moon glow / mythic scythe and falling leaves
  예시(SILENCE): void-black robes / absolute darkness with a single candle / shattered soundwaves frozen mid-air

• charDescription: 존재의 기원, 능력, 세계관 속 역할 (3~4문장, 문학적 표현 사용)
  — 단어의 뜻이 자연스럽게 녹아들어야 함
  — 단순 나열 금지, 서사적으로 작성

• category: '생명체' | '유물' | '현상' | '공간' | '추상' | '상황' | '관계' 중 단어의 본질에 가장 맞는 것

• rarity: 단어의 희귀성, 난이도, 개념적 깊이를 종합 판단하여 결정
  Common(쉽고 일상적) → Uncommon → Rare → Unique(고급 어휘) → Epic → Legendary(심오하고 복합적)

모든 필드는 한국어로 작성 (visualKeywords는 영문). JSON 형식으로 반환.
    `.trim();

    const response = await ai.models.generateContent({
      model,
      contents: instructions,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word:           { type: Type.STRING },
            wordKorean:     { type: Type.STRING },
            wordDefinition: { type: Type.STRING },
            wordHint:       { type: Type.STRING },
            visualKeywords: { type: Type.STRING },
            category:       { type: Type.STRING, enum: ["생명체","유물","현상","공간","추상","상황","관계"] },
            characterName:  { type: Type.STRING },
            charDescription:{ type: Type.STRING },
            rarity:         { type: Type.STRING, enum: ["Common","Uncommon","Rare","Unique","Epic","Legendary"] },
          },
          required: ["word","wordKorean","wordDefinition","wordHint","visualKeywords","category","characterName","charDescription","rarity"],
        },
      },
    });

    const raw = JSON.parse(response.text) as Omit<GeneratedWord, "visualEmoji" | "imageUrl"> & { visualKeywords: string };
    const result: GeneratedWord = {
      ...raw,
      word: raw.word.toUpperCase().replace(/[^A-Z]/g, ""),
      visualEmoji: raw.visualKeywords, // backward-compat alias
      imageUrl: "",
    };

    console.log(`[Nexus] Generated: ${result.word} → ${result.characterName} (${result.rarity})`);

    // Persist to global vault
    try {
      const vid = result.word;
      await setDoc(doc(db, "global_vault", vid), {
        ...result,
        id: vid,
        characterId: vid,
        name: result.characterName,
        description: result.charDescription,
        capturedAt: serverTimestamp(),
        count: 1,
        level: 1,
        isShiny: false,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err: any) {
      console.warn("[Nexus] Vault save skipped:", err.message);
    }

    return result;
  });
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
    console.log(`[Nexus] Joining in-flight generation: ${word}`);
    return imageInFlight.get(key)!;
  }

  const storageRef = ref(storage, `characters/${word.toUpperCase()}.png`);

  const promise = (async (): Promise<string | null> => {
    if (!forceRefresh) {
      try {
        const url = await getDownloadURL(storageRef);
        console.log(`[Nexus] Reusing stored image: ${word}`);
        return url;
      } catch {
        // Not yet stored — proceed to generate
      }
    }

    const rarityArt = RARITY_ART_DIRECTION[rarity];
    const rarityLore = RARITY_LORE[rarity];
    const keywordLine = visualKeywords ? `VISUAL ESSENCE: ${visualKeywords}` : "";
    const koreanLine  = wordKorean    ? `Korean meaning: "${wordKorean}"` : "";

    const imagePrompt = `
Professional digital artwork for a premium fantasy collectible card game (quality benchmark: Arknights, Fate/Grand Order, Genshin Impact character art).

═══════════════════════════════════════
SUBJECT
═══════════════════════════════════════
Character name: ${name}
Concept embodied: "${word}" ${koreanLine}
${keywordLine}
Lore: ${description}
Rarity tier: ${rarity} — ${rarityLore}

═══════════════════════════════════════
ARTISTIC DIRECTION
═══════════════════════════════════════
${rarityArt}

CRITICAL RULE — Word-Visual Fusion:
Every visual element must unmistakably reflect the meaning of "${word}".
The character's silhouette, costume details, weapon or tool, expression, pose, and surrounding environment should all echo the word's concept.
A viewer should be able to intuit the word's meaning just from seeing this artwork.

═══════════════════════════════════════
TECHNICAL REQUIREMENTS
═══════════════════════════════════════
• Full-body or 3/4 portrait, optimized for a 3:4 card format
• Painterly digital art with precise linework and professional shading
• Cohesive color palette tied thematically to "${word}"
• Rich atmospheric background that reinforces the character's concept
• Dramatic, studio-quality lighting
• Absolute requirement: NO text, NO watermarks, NO UI elements, NO card frames, NO borders
    `.trim();

    const fetchImageData = async (): Promise<string | Uint8Array | null> => {
      // Primary: Gemini 2.0 Flash image generation
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash-exp",
          contents: imagePrompt,
          config: { responseModalities: ["IMAGE", "TEXT"] },
        });
        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
          if (part.inlineData?.data) {
            console.log("[Nexus] Gemini image success.");
            return part.inlineData.data;
          }
        }
        throw new Error("No image data in Gemini response");
      } catch (err: any) {
        console.warn(`[Nexus] Gemini image failed: ${err.message}. Falling back to Imagen 3.`);
      }

      // Fallback: Imagen 3
      const imagenRes = await ai.models.generateImages({
        model: "imagen-3.0-generate-001",
        prompt: imagePrompt,
        config: { numberOfImages: 1, outputMimeType: "image/png", aspectRatio: "3:4" },
      });
      const bytes = imagenRes.generatedImages?.[0]?.image?.imageBytes;
      if (!bytes) throw new Error("Imagen 3 returned no images");
      console.log("[Nexus] Imagen 3 success.");
      return bytes;
    };

    try {
      const imageData = await callWithRetry(fetchImageData);
      if (!imageData) return null;

      if (typeof imageData !== "string") {
        await uploadBytes(storageRef, imageData as Uint8Array, { contentType: "image/png" });
      } else {
        await uploadString(storageRef, imageData, "base64", { contentType: "image/png" });
      }

      const downloadUrl = await getDownloadURL(storageRef);
      console.log(`[Nexus] Image stored: ${word.toUpperCase()}`);

      setDoc(doc(db, "global_vault", word.toUpperCase()), {
        imageUrl: downloadUrl,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch((e: unknown) => console.warn("[Nexus] Vault imageUrl update failed", e));

      return downloadUrl;
    } catch (err: any) {
      console.error("[Nexus] Image pipeline failed:", err.message || err);
      return null;
    }
  })().finally(() => imageInFlight.delete(key));

  imageInFlight.set(key, promise);
  return promise;
}
