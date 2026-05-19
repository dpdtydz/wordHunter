import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import sharp from "sharp";

const PORT = 3000;

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
    Common:    "Simple gradient background. Clean cel-shaded 2D anime character, soft rim lighting, modest fantasy outfit. Warm color palette. Half-body portrait.",
    Uncommon:  "Dark gradient background with subtle glow. Cel-shaded 2D art, vibrant color accents, flowing cape or hair movement. Glowing eyes, dynamic confident pose. Half-body portrait.",
    Rare:      "Deep atmospheric background (single dominant color gradient). Highly detailed cel-shaded fantasy outfit with layered armor and glowing rune accents. Strong rim lighting, magical particle orbs floating around the character. Sharp intense gaze. Half-body portrait.",
    Unique:    "Dark dramatic background with signature color aura radiating behind character. Intricate layered fantasy costume, ornate crown or weapon. Glowing eyes and glowing weapon or artifact. Complex magical circle or energy wings. Half-body portrait.",
    Epic:      "Dramatic dark background, massive radiant aura explosion behind the character. Cel-shaded 2D art at peak quality. Elaborate ornate armor with golden or silver engravings, large glowing wings or energy mantle. Overwhelming godlike presence, blinding light emission from body. Half-body portrait.",
    Legendary: "Pure white or cosmic void background. Transcendent cel-shaded 2D masterpiece. Character in pure white or black ethereal attire, silver hair flowing, crystalline or divine accessories. Intense glowing eyes piercing the viewer. Calm yet absolute divine aura — no explosions, only pure overwhelming elegance and power. Half-body portrait.",
  };

  const TEXT_MODELS = [
    "gemini-3-flash-preview",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
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
        continue;
      }
    }
    throw lastError || new Error("All text models failed");
  }

  // API Routes
  expressApp.get("/api/health", async (req, res) => {
    try {
      res.json({ status: "ok", initializedAt: new Date().toISOString() });
    } catch (e: any) {
      console.error("[Health Check] Failure:", e);
      res.status(500).json({ status: "error", error: e.message, code: e.code });
    }
  });

  expressApp.post("/api/generate-word", async (req, res) => {
    try {
      const { difficulty, specificWord } = req.body;
      let targetWord = specificWord?.toUpperCase().replace(/[^A-Z]/g, "");

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
• visualKeywords: 이 단어만의 고유한 시각적 정체성을 표현하는 영문 키워드 3개 (" / " 구분). 반드시 단어의 사전적 의미와 뉘앙스를 반영하며, 유사한 의미의 다른 단어와 겹치지 않는 독자적 키워드여야 한다. 소재보다 분위기·감정·추상 개념 중심으로 작성.
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

      res.json(result);
    } catch (error: any) {
      console.error("[Nexus Server] Word gen failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  expressApp.post("/api/generate-image", async (req, res) => {
    try {
      const { word, name, description, rarity, visualKeywords } = req.body;

      const rarityArt = (RARITY_ART_DIRECTION as any)[rarity] || RARITY_ART_DIRECTION.Common;
      const rarityLore = (RARITY_LORE as any)[rarity] || RARITY_LORE.Common;

      const imagePrompt = `A character that visually embodies the concept of "${word}" (meaning: ${visualKeywords}). ${rarityArt} The character's entire appearance, color palette, costume motifs, and accessories must directly reflect the essence of "${word}" — not generic fantasy. Character name: ${name}. ${description} 2D anime illustration, cel shading, korean mobile RPG style, clean ink outlines, half-body portrait. Simple gradient background, strong rim lighting.`;

      const negativePrompt = "text, watermark, signature, logo, letters, words, typography, glyphs, subtitles, UI, HUD, frames, borders, bad anatomy, deformed, ugly, blurry, low quality";

      const HF_PROVIDERS = [
        {
          // FLUX.1-schnell — hf-inference provider 공식 지원 유일 모델 (2025-05 기준)
          url: "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
          body: () => JSON.stringify({ inputs: imagePrompt, parameters: { negative_prompt: negativePrompt, width: 512, height: 768, num_inference_steps: 4, guidance_scale: 0 } }),
          parseB64: async (r: Response) => { const buf = await r.arrayBuffer(); return Buffer.from(buf).toString("base64"); },
        },
        {
          // SD3 Medium — hf-inference 두 번째 공식 지원 모델
          url: "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-3-medium-diffusers",
          body: () => JSON.stringify({ inputs: imagePrompt, parameters: { negative_prompt: negativePrompt, width: 512, height: 768, num_inference_steps: 30, guidance_scale: 7.5 } }),
          parseB64: async (r: Response) => { const buf = await r.arrayBuffer(); return Buffer.from(buf).toString("base64"); },
        },
      ];

      let b64: string | null = null;
      let lastErr = "";
      for (const provider of HF_PROVIDERS) {
        console.log(`[Nexus Server] Requesting image from ${provider.url}`);
        const hfResponse = await fetch(provider.url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: provider.body(),
        });

        if (!hfResponse.ok) {
          lastErr = `${hfResponse.status}: ${await hfResponse.text()}`;
          console.warn(`[Nexus Server] Provider failed: ${lastErr}`);
          continue;
        }

        b64 = await provider.parseB64(hfResponse);
        if (b64) break;
      }

      if (!b64) throw new Error(`All HuggingFace providers failed. Last error: ${lastErr}`);
      const inputBuffer = Buffer.from(b64, "base64");

      // 하단 8% 크롭으로 워터마크 제거
      const meta = await sharp(inputBuffer).metadata();
      const cropHeight = Math.floor((meta.height || 768) * 0.92);
      const croppedBuffer = await sharp(inputBuffer)
        .extract({ left: 0, top: 0, width: meta.width || 512, height: cropHeight })
        .png()
        .toBuffer();

      const base64Data = croppedBuffer.toString("base64");
      console.log(`[Nexus Server] Sending base64 image back for ${word}`);
      res.json({ base64: base64Data });
    } catch (error: any) {
      console.error("[Nexus Server] Image gen failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
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
  console.error("Critical server failure:", err);
  process.exit(1);
});
