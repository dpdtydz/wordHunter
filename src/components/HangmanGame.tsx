import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGame } from '../context/GameContext';
import { generateWordData, GeneratedWord } from '../services/geminiService';
import { Rarity, GameCharacter } from '../types';
import { Trophy, RefreshCw, XCircle, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { getRarityBorder, getRarityColor } from '../lib/gameUtils';

interface HangmanGameProps {
  mode: 'Farming' | 'Challenge';
  onExit: () => void;
}

export default function HangmanGame({ mode, onExit }: HangmanGameProps) {
  const { updateProgress, addCharacterToCollection, consumePrefetch, triggerPrefetch } = useGame();
  
  const [loading, setLoading] = useState(true);
  const [wordData, setWordData] = useState<GeneratedWord | null>(null);
  const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [showReward, setShowReward] = useState(false);
  const [hintLevel, setHintLevel] = useState(1); 
  const [captureRate, setCaptureRate] = useState(100);
  const [directGuess, setDirectGuess] = useState("");
  const [lastWord, setLastWord] = useState<string>("");

  const maxMistakes = 6;

  const [showRetry, setShowRetry] = useState(false);

  const [resImgError, setResImgError] = useState(false);

  const initGame = useCallback(async () => {
    setGuessedLetters([]);
    setMistakes(0);
    setGameState('playing');
    setShowReward(false);
    setHintLevel(1);
    setCaptureRate(100);
    setDirectGuess("");
    setShowRetry(false);
    setResImgError(false);
    
    const cachedData = consumePrefetch(mode);
    if (cachedData) {
      setWordData({ ...cachedData, word: cachedData.word.toUpperCase() });
      setLastWord(cachedData.word.toUpperCase());
      setLoading(false);
      triggerPrefetch(mode);
    } else {
      setLoading(true);
      const timeout = setTimeout(() => setShowRetry(true), 8000);
      try {
        const { generateWordData } = await import('../services/geminiService');
        const data = await generateWordData(mode);
        const upperWord = data.word.toUpperCase();
        setWordData({ ...data, word: upperWord });
        setLastWord(upperWord);
        setLoading(false);
        clearTimeout(timeout);
        triggerPrefetch(mode);
      } catch (err) {
        console.error("단어를 불러오지 못했습니다", err);
        setLoading(false);
        clearTimeout(timeout);
      }
    }
  }, [mode, consumePrefetch, triggerPrefetch]);

  useEffect(() => {
    initGame();
  }, []); // Only once on mount or when mode changes manually

  const handleGuess = (letter: string) => {
    if (gameState !== 'playing' || guessedLetters.includes(letter)) return;

    setGuessedLetters(prev => [...prev, letter]);

    if (!wordData?.word.includes(letter)) {
      setMistakes(prev => prev + 1);
      setCaptureRate(prev => Math.max(10, prev - 15));
    } else {
      setCaptureRate(prev => Math.max(10, prev - 2));
    }
  };

  const handleDirectGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wordData || gameState !== 'playing' || !directGuess) return;

    if (directGuess.toUpperCase() === wordData.word) {
      setGameState('won');
      handleWin();
    } else {
      setMistakes(maxMistakes);
      setGameState('lost');
    }
  };

  useEffect(() => {
    if (!wordData) return;

    const isWon = wordData.word.split('').every(char => guessedLetters.includes(char) || char === ' ' || char === '-');
    const isLost = mistakes >= maxMistakes;

    if (isWon && gameState === 'playing') {
      setGameState('won');
      handleWin();
    } else if (isLost && gameState === 'playing') {
      setGameState('lost');
    }
  }, [guessedLetters, mistakes, wordData, gameState]);

  const handleWin = async () => {
    if (!wordData) return;

    const shinyBase = 0.01;
    const isShiny = Math.random() < (shinyBase * (captureRate / 100));

    const char: GameCharacter = {
      id: wordData.word.toLowerCase(),
      characterId: wordData.word.toLowerCase(),
      name: wordData.characterName,
      rarity: wordData.rarity,
      word: wordData.word.toLowerCase(),
      wordKorean: wordData.wordKorean,
      wordDefinition: wordData.wordDefinition,
      wordHint: wordData.wordHint,
      visualEmoji: wordData.visualEmoji,
      category: wordData.category,
      description: wordData.charDescription,
      imageUrl: wordData.imageUrl || "",
      isShiny
    };

    const rarities: Record<Rarity, number> = {
      'Common': 10, 'Uncommon': 25, 'Rare': 50, 'Unique': 100, 'Epic': 200, 'Legendary': 500
    };

    const expBonus = Math.floor(rarities[char.rarity] * (captureRate / 100));
    const coinBonus = char.rarity === 'Common' ? 5 : 20;

    await updateProgress(expBonus, coinBonus);
    await addCharacterToCollection(char);
    setShowReward(true);

    // Generate image after capture (always — all rarities get art)
    if (!char.imageUrl) {
      const { generateAndStoreCharacterImage } = await import('../services/geminiService');
      generateAndStoreCharacterImage(
        wordData.word,
        wordData.characterName,
        wordData.charDescription,
        wordData.rarity,
        (wordData as any).visualKeywords || wordData.visualEmoji,
        wordData.wordKorean,
      ).then(url => {
        if (url) {
          setWordData((prev: GeneratedWord | null) => prev ? { ...prev, imageUrl: url } : null);
          addCharacterToCollection({ ...char, imageUrl: url });
        }
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
          <RefreshCw className="text-brand-purple" size={48} />
        </motion.div>
        <p className="mt-4 text-gray-400 font-mono italic">사냥감을 소환하는 중...</p>
        
        <AnimatePresence>
          {showRetry && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex flex-col items-center">
              <p className="text-xs text-red-400/60 mb-4 text-center">차원 연결이 지연되고 있습니다.<br/>넥서스 에너지를 재조정하십시오.</p>
              <button 
                onClick={initGame}
                className="bg-brand-purple/20 hover:bg-brand-purple/40 border border-brand-purple/50 text-brand-purple px-6 py-2 rounded-xl text-sm font-bold transition-all"
              >
                차원 재연결 시도
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div className="px-4 py-1 rounded-full bg-brand-gray border border-white/10 text-xs font-mono uppercase tracking-widest text-brand-cyan">
          {mode === 'Farming' ? '파밍' : '도전'} 구역
        </div>
        <button onClick={onExit} className="text-gray-500 hover:text-white transition-colors">나가기</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-12">
        <div className="relative flex justify-center items-center h-64 glass-card bg-brand-dark/80 overflow-hidden border-white/20">
          <HangmanFigure mistakes={mistakes} />
          <div className="absolute top-4 left-4 flex flex-col gap-1">
            <span className="text-[10px] font-mono text-gray-500 uppercase">과부하: {mistakes}/{maxMistakes}</span>
            <div className="h-1 w-20 bg-brand-gray overflow-hidden rounded-full">
               <motion.div initial={{ width: 0 }} animate={{ width: `${(mistakes/maxMistakes) * 100}%` }} className="h-full bg-red-500" />
            </div>
          </div>
          <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
            <span className="text-[10px] font-mono text-brand-cyan uppercase">포획 확률</span>
            <div className="flex items-center gap-2">
              <span className={cn("text-xl font-bold font-mono", captureRate > 70 ? "text-brand-cyan" : captureRate > 30 ? "text-yellow-400" : "text-red-500")}>
                {captureRate}%
              </span>
              <div className="w-16 h-1.5 bg-brand-gray rounded-full overflow-hidden">
                <motion.div initial={{ width: "100%" }} animate={{ width: `${captureRate}%` }} className={cn("h-full transition-colors", captureRate > 70 ? "bg-brand-cyan" : captureRate > 30 ? "bg-yellow-400" : "bg-red-500")} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {wordData?.word.split('').map((char, i) => (
              <div key={i} className={cn("w-10 h-14 border-b-2 flex items-center justify-center text-3xl font-bold transition-all duration-500", guessedLetters.includes(char) || char === ' ' || char === '-' ? "border-brand-purple border-b-4 scale-110" : "border-brand-gray")}>
                {guessedLetters.includes(char) || char === ' ' || char === '-' ? char : ""}
              </div>
            ))}
          </div>

          <div className="w-full max-w-xs mb-8">
            <form onSubmit={handleDirectGuess} className="flex gap-2">
              <input type="text" placeholder="정답 직접 입력..." value={directGuess} onChange={(e) => setDirectGuess(e.target.value)} className="flex-1 bg-brand-gray border border-white/5 rounded-lg px-4 py-2 text-sm focus:border-brand-purple outline-none" />
              <button type="submit" className="bg-brand-purple/20 border border-brand-purple/50 text-brand-purple px-4 py-2 rounded-lg text-xs font-bold hover:bg-brand-purple hover:text-white transition-all uppercase">결정</button>
            </form>
          </div>

          <div className="mb-6 h-28 flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div key={hintLevel} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-center px-4">
                <p className="text-xs text-brand-cyan font-mono mb-1 uppercase tracking-widest">넥서스 감지 유형: {wordData?.category}</p>
                {hintLevel >= 2 && (
                  <div className="bg-white/5 p-2 rounded-lg border border-white/5 mt-1 border-brand-cyan/10">
                     <p className="text-[10px] text-brand-cyan/60 uppercase mb-1 font-mono">생성된 힌트</p>
                     <p className="text-sm text-gray-200 leading-tight">{wordData?.wordHint}</p>
                  </div>
                )}
                {hintLevel >= 3 && (
                  <div className="bg-white/10 p-2 rounded-lg border border-brand-purple/20 mt-2">
                    <p className="text-sm font-bold text-white neon-glow">핵심 의미: {wordData?.wordKorean}</p>
                  </div>
                )}
                {hintLevel < 3 && (
                  <button onClick={() => { setHintLevel(prev => prev + 1); setCaptureRate(prev => Math.max(10, prev - 15)); if (mode === 'Challenge') setMistakes(prev => prev + 1); }} className="text-[10px] text-brand-cyan/60 hover:text-brand-cyan mt-3 border-b border-brand-cyan/20 transition-colors py-0.5">공명 주파수 조정 (확률 -15%)</button>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-7 sm:grid-cols-9 gap-2">
            {alphabet.map((letter) => (
              <button key={letter} disabled={guessedLetters.includes(letter) || gameState !== 'playing'} onClick={() => handleGuess(letter)} className={cn("w-10 h-10 rounded font-bold transition-all border", guessedLetters.includes(letter) ? wordData?.word.includes(letter) ? "bg-brand-purple/20 border-brand-purple text-brand-purple" : "bg-red-500/10 border-red-500/20 text-gray-600" : "bg-brand-gray border-white/5 hover:border-brand-cyan hover:text-brand-cyan")}>
                {letter}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {gameState !== 'playing' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/90 backdrop-blur-md overflow-y-auto">
            <div className="glass-card max-w-3xl w-full p-4 md:p-8 text-center relative overflow-hidden my-auto">
              {gameState === 'won' ? (
                <>
                  <div className="flex flex-col md:flex-row items-center justify-between mb-2 md:mb-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-purple/20 rounded-lg border border-brand-purple/30">
                        <Trophy className="text-brand-purple" size={24} />
                      </div>
                      <h2 className="text-xl md:text-2xl font-black neon-glow tracking-[0.2em] uppercase">넥서스 실체화 성공</h2>
                    </div>
                  </div>
                  
                  {showReward && (
                     <motion.div 
                       initial={{ y: 20, opacity: 0 }} 
                       animate={{ y: 0, opacity: 1 }} 
                       transition={{ duration: 0.8 }}
                       className="mb-6 rounded-3xl bg-brand-dark/90 border border-white/20 relative group overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]"
                     >
                       <div className={cn("absolute inset-0 opacity-10 blur-[120px] transition-all duration-1000", getRarityColor(wordData?.rarity).replace('text-', 'bg-'))} />
                       
                       <div className="relative z-10 flex flex-col md:grid md:grid-cols-12 min-h-[460px]">
                          {/* Left Visual: 45% width */}
                          <div className="md:col-span-5 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/10 bg-gradient-to-b from-white/5 to-transparent">
                            <motion.div
                               initial={{ opacity: 0, y: -10 }}
                               animate={{ opacity: 1, y: 0 }}
                               className={cn("mb-8 text-[11px] font-black uppercase tracking-[0.5em] px-4 py-1.5 rounded-full bg-black/60 border border-white/5", getRarityColor(wordData?.rarity))}
                            >
                               {wordData?.rarity} UNIT
                            </motion.div>
 
                             <div className="relative mb-8 group-hover:scale-105 transition-transform duration-700">
                               <motion.div 
                                 animate={{ 
                                   y: [0, -15, 0],
                                   rotate: [0, 1, -1, 0]
                                 }}
                                 transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                                 className="w-48 h-48 md:w-64 md:h-64 bg-white/[0.02] rounded-3xl flex items-center justify-center relative overflow-hidden"
                               >
                                 {wordData?.imageUrl && !resImgError ? (
                                    <div className="w-full h-full relative">
                                      <img 
                                        src={wordData.imageUrl} 
                                        alt={wordData.characterName} 
                                        className="w-full h-full object-cover rounded-3xl"
                                        referrerPolicy="no-referrer"
                                        onError={() => setResImgError(true)}
                                      />
                                      {/* Aura Overlay */}
                                      <div className={cn("absolute inset-0 opacity-40 mix-blend-overlay", getRarityColor(wordData?.rarity).replace('text-', 'bg-'))} />
                                    </div>
                                 ) : (
                                   <span className="relative z-10 drop-shadow-[0_0_40px_rgba(255,255,255,0.4)] text-[120px] md:text-[160px] mix-blend-plus-lighter">
                                     {wordData?.visualEmoji}
                                   </span>
                                 )}
                                 
                                 <div className={cn("absolute inset-0 rounded-3xl border-2 border-dashed animate-[spin_40s_linear_infinite] opacity-20", getRarityColor(wordData?.rarity).replace('text-', 'border-'))} />
                                 <div className="absolute inset-4 rounded-3xl border border-white/5 animate-[pulse_4s_ease-in-out_infinite]" />
                                 
                                 <Sparkles className="absolute -top-6 -right-6 text-yellow-400/50 animate-pulse" size={40} />
                               </motion.div>
                             </div>
                            
                            <div className="text-center">
                              <h3 className={cn("text-2xl md:text-3xl font-black uppercase tracking-tight leading-[1.1] mb-2 drop-shadow-2xl", getRarityColor(wordData?.rarity))}>
                                {wordData?.characterName}
                              </h3>
                              <div className="flex items-center justify-center gap-4 opacity-50">
                                <div className="h-px w-6 bg-white/40" />
                                <span className="text-[10px] font-mono tracking-widest">{wordData?.category}</span>
                                <div className="h-px w-6 bg-white/40" />
                              </div>
                            </div>
                          </div>
 
                          {/* Right Content: 55% width */}
                          <div className="md:col-span-7 p-8 md:p-14 flex flex-col items-center md:items-start text-center md:text-left justify-center bg-black/30 backdrop-blur-md">
                            <div className="mb-10 w-full">
                              <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan shadow-[0_0_10px_#22d3ee]" />
                                <span className="text-[11px] font-mono text-brand-cyan uppercase tracking-[0.4em] font-bold">NEXUS ARCHIVE</span>
                              </div>
                              <div className="relative">
                                <p className="text-lg md:text-xl text-gray-300 italic leading-relaxed font-serif max-w-md">
                                  {wordData?.charDescription}
                                </p>
                              </div>
                            </div>
 
                            <div className="w-full space-y-8">
                              <div className="grid grid-cols-2 gap-12 border-t border-white/10 pt-10">
                                <div className="space-y-1">
                                  <p className="text-[10px] text-gray-500 uppercase font-mono tracking-[0.3em]">CODE_NAME</p>
                                  <p className="text-2xl font-black text-brand-cyan tracking-[0.1em]">{wordData?.word.toUpperCase()}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] text-gray-500 uppercase font-mono tracking-[0.3em]">MANIFEST_ID</p>
                                  <p className="text-2xl font-bold text-white uppercase">{wordData?.wordKorean}</p>
                                </div>
                              </div>
 
                              <div className="p-6 bg-white/5 rounded-2xl border border-white/10 group-hover:bg-white/[0.08] transition-all duration-500">
                                <p className="text-[12px] text-gray-400 leading-relaxed font-medium">
                                  {wordData?.wordDefinition}
                                </p>
                              </div>
                            </div>
                          </div>
                       </div>
 
                       {/* Animated Shine Sweep */}
                       <motion.div 
                         animate={{ x: ['-200%', '200%'] }} 
                         transition={{ duration: 4.5, repeat: Infinity, ease: "linear", repeatDelay: 2.5 }}
                         className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-45deg]" 
                       />
                     </motion.div>
                  )}
                  <div className="flex gap-4">
                    <button onClick={initGame} className="flex-1 bg-brand-purple py-3 rounded-xl font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"><RefreshCw size={18} /> 계속하기</button>
                    <button onClick={onExit} className="flex-1 bg-brand-gray py-3 rounded-xl font-bold hover:bg-gray-800 transition-all text-sm sm:text-base">캠프로 가기</button>
                  </div>
                </>
              ) : (
                <>
                   <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
                   <XCircle className="mx-auto text-red-500 mb-4" size={64} />
                   <h2 className="text-4xl font-bold mb-2 text-red-500">사냥 실패</h2>
                   <div className="flex gap-4 mt-8">
                    <button onClick={initGame} className="flex-1 bg-red-500 py-3 rounded-xl font-bold hover:brightness-110 transition-all">다시 시도</button>
                    <button onClick={onExit} className="flex-1 bg-brand-gray py-3 rounded-xl font-bold hover:bg-gray-800 transition-all">후퇴</button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HangmanFigure({ mistakes }: { mistakes: number }) {
  const centerX = 80;
  return (
    <svg width="160" height="200" viewBox="0 0 160 200" className="drop-shadow-lg">
      <line x1="20" y1="180" x2="100" y2="180" stroke="#1f2937" strokeWidth="4" />
      <line x1="40" y1="180" x2="40" y2="20" stroke="#1f2937" strokeWidth="4" />
      <line x1="40" y1="20" x2="80" y2="20" stroke="#1f2937" strokeWidth="4" />
      <line x1="80" y1="20" x2="80" y2="48" stroke="#1f2937" strokeWidth="2" />
      {mistakes >= 1 && <motion.circle initial={{ r: 0 }} animate={{ r: 16 }} cx={centerX} cy={64} r="16" stroke="#8B5CF6" strokeWidth="2" fill="#0a0a0a" />}
      {mistakes >= 2 && <motion.line initial={{ y2: 80 }} animate={{ y2: 120 }} x1={centerX} y1={80} x2={centerX} y2={120} stroke="#8B5CF6" strokeWidth="2" />}
      {mistakes >= 3 && <motion.line initial={{ x2: centerX, y2: 90 }} animate={{ x2: centerX - 25, y2: 110 }} x1={centerX} y1={90} x2={centerX - 25} y2={110} stroke="#8B5CF6" strokeWidth="2" />}
      {mistakes >= 4 && <motion.line initial={{ x2: centerX, y2: 90 }} animate={{ x2: centerX + 25, y2: 110 }} x1={centerX} y1={90} x2={centerX + 25} y2={110} stroke="#8B5CF6" strokeWidth="2" />}
      {mistakes >= 5 && <motion.line initial={{ y2: 120 }} animate={{ x2: centerX - 20, y2: 150 }} x1={centerX} y1={120} x2={centerX - 20} y2={150} stroke="#8B5CF6" strokeWidth="2" />}
      {mistakes >= 6 && <motion.line initial={{ y2: 120 }} animate={{ x2: centerX + 20, y2: 150 }} x1={centerX} y1={120} x2={centerX + 20} y2={150} stroke="#8B5CF6" strokeWidth="2" />}
    </svg>
  );
}
