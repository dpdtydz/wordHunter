import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, existsSync } from "fs";

const PORT = 3000;
const CONFIG_PATH = path.join(process.cwd(), 'firebase-applet-config.json');

// Load Firebase Config
let firebaseConfig: any = {};
if (existsSync(CONFIG_PATH)) {
  firebaseConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

// Initialize Firebase Admin with explicit Project ID to avoid environment mismatch
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
  });
}

const getDatabase = () => {
  const dbId = firebaseConfig.firestoreDatabaseId;
  
  if (!dbId || dbId === "(default)") {
    console.log("[Firebase] Initializing with (default) database.");
    return getFirestore(admin.app());
  }

  try {
    console.log(`[Firebase] Initializing with custom Database ID: ${dbId}`);
    return getFirestore(admin.app(), dbId);
  } catch (e) {
    console.error(`[Firebase] Failed to initialize Firestore with DB ID ${dbId}. Falling back to (default).`, e);
    return getFirestore(admin.app());
  }
};

let currentDb = getDatabase();
const storage = getStorage(admin.app());

// Helper to handle Firestore operations with potential DB fallback
async function runWithDbFallback<T>(op: (db: admin.firestore.Firestore) => Promise<T>): Promise<T> {
  try {
    return await op(currentDb);
  } catch (err: any) {
    const isCustomDb = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)";
    const isPermissionError = err.message?.includes("PERMISSION_DENIED") || err.message?.includes("7");
    const isNotFoundError = err.message?.includes("NOT_FOUND") || err.message?.includes("5");

    if (isCustomDb && (isPermissionError || isNotFoundError)) {
      console.error(`[Firebase] Operation failed on custom DB ${firebaseConfig.firestoreDatabaseId}. One-time fallback to (default)...`, err.message);
      currentDb = getFirestore(admin.app()); // Permanent switch for this process
      return await op(currentDb);
    }
    throw err;
  }
}

async function startServer() {
  const expressApp = express();
  expressApp.use(express.json());

  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });

  const SYSTEM_INSTRUCTION = `당신은 세계적인 수집형 판타지 RPG "워드 넥서스"의 수석 세계관 설계자입니다.
단어 하나하나가 살아있는 존재로 실체화되는 이 세계에서, 당신은 각 단어의 본질을 가장 극적이고 매력적인 캐릭터로 빚어냅니다.
이모지나 이모티콘은 절대 사용하지 마세요. 모든 텍스트는 순수한 한국어/영어 문자로만 작성하세요.`;

  const RARITY_LORE = {
    Common:    "흔하게 목격되는 존재. 평범하지만 세계의 근간을 이루는 힘을 지닌다.",
    Uncommon:  "일반인의 눈에는 잘 보이지 않는 존재. 숨겨진 가능성을 품고 있다.",
    Rare:      "극히 드문 확률로만 실체화되는 존재. 강렬한 에너지 파장을 발한다.",
    Unique:    "동일한 형태가 세상에 하나뿐인 고유한 존재. 독자적인 법칙 아래 움직인다.",
    Epic:      "넥서스의 역사를 바꾼 전설적 존재. 그 이름만으로도 현실이 흔들린다.",
    Legendary: "신화 속에서만 존재한다고 여겨졌던 초월적 존재. 세계의 근본 법칙 그 자체다.",
  };

  const RARITY_ART_DIRECTION = {
    Common: "Clean, grounded illustration with a warm natural color palette. Approachable and relatable character design. Soft ambient lighting.",
    Uncommon: "Polished character design with vibrant accent colors. Dynamic confident pose. Subtle magical shimmer around the silhouette.",
    Rare: "Premium illustration with intricate costume details. Dramatic cinematic side-lighting. Elegant particle or elemental effects tied to the word's theme.",
    Unique: "Striking iconic design with a distinctive color signature no other card shares. Powerful stance. Complex patterns or motifs etched into armor/clothing that reference the word's meaning.",
    Epic: "High-drama composition. Intense magical storm or world-scale elemental effects. The character radiates overwhelming presence; background reality warps slightly around them.",
    Legendary: "Transcendent masterpiece. Cosmic or divine scale. Reality fractures behind the character. Every pixel must feel inevitable and awe-inspiring. This is the pinnacle visual expression of the concept.",
  };

  // Model fallback chain for text generation
  const TEXT_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash-lite-preview-02-05"
  ];

  async function generateWithFallback(instructions: string, schema: any) {
    let lastError: any;
    for (const modelName of TEXT_MODELS) {
      try {
        console.log(`[Nexus Server] Attempting text gen with ${modelName}`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: instructions,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        });
        return response;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Nexus Server] Model ${modelName} failed: ${err.message}`);
        if (err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED")) {
          continue; // Try next model on quota error
        }
        // If it's a structural error (schema validation etc), maybe don't fallback? 
        // But usually best to try another model anyway.
      }
    }
    throw lastError || new Error("All text models failed");
  }

  // API Routes
  expressApp.get("/api/health", async (req, res) => {
    try {
      // Test read to check connectivity
      const snap = await runWithDbFallback(db => db.collection("global_vault").limit(1).get());
      res.json({ 
        status: "ok", 
        databaseId: firebaseConfig.firestoreDatabaseId || "(default)",
        projectId: firebaseConfig.projectId,
        count: snap.size
      });
    } catch (e: any) {
      console.error("[Health Check] Failure:", e);
      res.status(500).json({ status: "error", error: e.message, details: e.stack });
    }
  });

  expressApp.post("/api/generate-word", async (req, res) => {
    try {
      const { difficulty, specificWord, forceRefresh } = req.body;

      let targetWord = specificWord?.toUpperCase().replace(/[^A-Z]/g, "");

      if (targetWord && !forceRefresh) {
        try {
          const snap = await runWithDbFallback(db => db.collection("global_vault").doc(targetWord).get());
          if (snap.exists) {
            console.log(`[Nexus Server] Vault hit: ${targetWord}`);
            return res.json(snap.data());
          }
        } catch (e: any) {
          console.warn(`[Nexus Server] Vault check error for ${targetWord}: ${e.message}`);
        }
      }

      const basePrompt = targetWord
        ? `대상 단어: "${targetWord}" (난이도: ${difficulty})`
        : `영단어 학습 게임용 ${difficulty} 난이도의 흥미로운 영단어 1개를 직접 선정하라.`;

      const instructions = `
워드 넥서스 세계관 데이터 생성 — 최고 품질 수집형 RPG 기준.
${basePrompt}
[SECTION 1] 영단어 학습 데이터
• word: 대상 단어 (영문 대문자)
• wordKorean: 핵심 한국어 뜻 (1~3단어, 간결하게)
• wordDefinition: 사전적 정의를 기반으로 한 한국어 설명 (1~2문장)
• wordHint: 단어를 직접 언급하지 않고 맥락·유래·연상으로 추측 가능한 힌트 (1장)
[SECTION 2] 넥서스 실체화 존재 프로필
• characterName: 단어의 본질을 담은 존재의 고유한 이름 (한국어 또는 한자어 기반, 2~6자)
• visualKeywords: AI 이미지 생성에 최적화된 영문 시각 키워드 3개를 " / " 로 구분
• charDescription: 존재의 기원, 능력, 세계관 속 역할 (3~4문장, 문학적 표현 사용)
• category: '생명체' | '유물' | '현상' | '공간' | '추상' | '상황' | '관계' 중 선택
• rarity: Common | Uncommon | Rare | Unique | Epic | Legendary 중 선택
모든 필드는 한국어로 작성 (visualKeywords는 영문). JSON 형식으로 반환.
      `.trim();

      const schema = {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          wordKorean: { type: Type.STRING },
          wordDefinition: { type: Type.STRING },
          wordHint: { type: Type.STRING },
          visualKeywords: { type: Type.STRING },
          category: { type: Type.STRING },
          characterName: { type: Type.STRING },
          charDescription: { type: Type.STRING },
          rarity: { type: Type.STRING },
        },
        required: ["word","wordKorean","wordDefinition","wordHint","visualKeywords","category","characterName","charDescription","rarity"],
      };

      const resultText = await generateWithFallback(instructions, schema);

      const result = JSON.parse(resultText.text);
      result.word = result.word.toUpperCase().replace(/[^A-Z]/g, "");
      result.visualEmoji = result.visualKeywords;
      result.imageUrl = "";

      // Persist
      try {
        const docId = result.word;
        console.log(`[Nexus Server] Persisting ${docId} to project ${firebaseConfig.projectId}...`);
        await runWithDbFallback(db => db.collection("global_vault").doc(docId).set({
          ...result,
          id: docId,
          name: result.characterName,
          description: result.charDescription,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }));
        console.log(`[Nexus Server] Persisted ${docId}`);
      } catch (err: any) {
        console.error(`[Nexus Server] Persistence error ${result.word}: ${err.message}`);
      }

      res.json(result);
    } catch (error: any) {
      console.error("[Nexus Server] Word gen failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  expressApp.post("/api/generate-image", async (req, res) => {
    try {
      const { word, name, description, rarity, visualKeywords, wordKorean, forceRefresh } = req.body;
      const bucket = storage.bucket();
      const filename = `characters/${word.toUpperCase()}.png`;
      const file = bucket.file(filename);

      if (!forceRefresh) {
        try {
          const [exists] = await file.exists();
          if (exists) {
            try { await file.makePublic(); } catch (e) {}
            // Use publicUrl() if possible, else construct manually
            const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;
            return res.json({ imageUrl: url });
          }
        } catch (e) {}
      }

      const rarityArt = (RARITY_ART_DIRECTION as any)[rarity] || RARITY_ART_DIRECTION.Common;
      const rarityLore = (RARITY_LORE as any)[rarity] || RARITY_LORE.Common;

      const imagePrompt = `
High-end mobile collector RPG character card art. Portrait format.
Character: ${name} (${word})
Description: ${description}
Visual Essence: ${visualKeywords}
Rarity: ${rarity} - ${rarityLore}
Art Direction: ${rarityArt}
Detailed anime fantasy style, cinematic lighting, 4k resolution. No text, no frames, no watermarks.
      `.trim();

      const IMAGE_MODELS = [
        "gemini-2.0-flash", // 2.0 Flash is generally stable for image gen now
        "gemini-2.5-flash-image",
        "gemini-3.1-flash-image-preview",
        "gemini-2.0-flash-exp"
      ];

      let imageData: Buffer | null = null;
      let lastErr: any;

      for (const modelName of IMAGE_MODELS) {
        try {
          console.log(`[Nexus Server] Trying image gen: ${modelName}`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: imagePrompt,
            config: {
              responseModalities: [Modality.IMAGE]
            }
          });

          const parts = response.candidates?.[0]?.content?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                imageData = Buffer.from(part.inlineData.data, 'base64');
                break;
              }
            }
          }
          if (imageData) break;
        } catch (err: any) {
          lastErr = err;
          console.warn(`[Nexus Server] ${modelName} failed: ${err.message}`);
          if (err.message?.includes("429")) continue;
          // Some models might not support IMAGE modality, continue to next
        }
      }

      if (!imageData) {
        throw lastErr || new Error("Image generation failed");
      }

      console.log(`[Nexus Server] Storing image for ${word}`);
      await file.save(imageData, { contentType: "image/png", metadata: { cacheControl: "public, max-age=31536000" } });
      try { await file.makePublic(); } catch (e) {}
      const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

      try {
        await runWithDbFallback(db => db.collection("global_vault").doc(word.toUpperCase()).set({
          imageUrl: downloadUrl,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }));
      } catch (e: any) {
        console.error(`[Nexus Server] Failed to update vault for ${word} after image gen: ${e.message}`);
      }

      res.json({ imageUrl: downloadUrl });
    } catch (error: any) {
      console.error("[Nexus Server] Image gen failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    expressApp.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    expressApp.use(express.static(distPath));
    expressApp.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  expressApp.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical server startup failure:", err);
  process.exit(1);
});
