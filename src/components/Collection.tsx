import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGame } from '../context/GameContext';
import { Rarity, CapturedCharacter, GameCharacter } from '../types';
import { Search, Grid, Info, X, RefreshCw, Wand2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { getRarityBg, getRarityBorder, getRarityColor } from '../lib/gameUtils';
import { generateWordData } from '../services/geminiService';

interface CollectionProps {
  onBack: () => void;
}

export default function Collection({ onBack }: CollectionProps) {
  const { collection: userChars, addCharacterToCollection } = useGame();
  const [filter, setFilter] = useState<string>("");
  const [selectedChar, setSelectedChar] = useState<CapturedCharacter | null>(null);
  const [reManifesting, setReManifesting] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Reset img error when selected character changes
  React.useEffect(() => {
    setImgError(false);
  }, [selectedChar?.id]);

  const handleReManifest = async (char: CapturedCharacter) => {
    setReManifesting(true);
    try {
      const { generateWordData, generateAndStoreCharacterImage } = await import('../services/geminiService');
      
      // 1. Fetch text data first (FAST)
      const data = await generateWordData('Farming', char.word, true);
      const textOnlyChar: GameCharacter = {
        id: char.id,
        characterId: char.id,
        name: data.characterName,
        rarity: data.rarity,
        word: char.word,
        wordKorean: data.wordKorean,
        wordDefinition: data.wordDefinition,
        wordHint: data.wordHint,
        visualEmoji: data.visualEmoji,
        category: data.category,
        description: data.charDescription,
        imageUrl: char.imageUrl || "", // Use empty string instead of undefined
        isShiny: char.isShiny || false
      };
      
      // Show text changes immediately
      const tempChar = { ...char, ...textOnlyChar } as CapturedCharacter;
      setSelectedChar(tempChar);
      await addCharacterToCollection(textOnlyChar);
      
      // 2. Fetch/Generate image in background (SLOW)
      const newImageUrl = await generateAndStoreCharacterImage(char.word, data.characterName, data.charDescription, data.rarity, true);
      if (newImageUrl) {
        const finalCharData = { ...textOnlyChar, imageUrl: newImageUrl };
        await addCharacterToCollection(finalCharData);
        setSelectedChar(prev => prev ? ({ ...prev, imageUrl: newImageUrl }) : null);
      }
    } catch (err) {
      console.error("Re-manifest failed", err);
    } finally {
      setReManifesting(false);
    }
  };

  const filteredCollection = userChars.filter(char => {
    const nameMatch = char.name?.toLowerCase().includes((filter || "").toLowerCase());
    const wordMatch = char.word?.toLowerCase().includes((filter || "").toLowerCase());
    return nameMatch || wordMatch;
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <button onClick={onBack} className="text-gray-500 hover:text-white transition-colors text-sm mb-2 flex items-center gap-1">
            ← 캠프로 돌아가기
          </button>
          <h1 className="text-4xl font-bold neon-glow">개체 도감</h1>
          <p className="text-gray-400 font-mono text-sm tracking-widest">{userChars.length}마리의 존재 포획됨</p>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="이름이나 단어로 검색..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-brand-gray border border-white/10 rounded-full py-2 pl-10 pr-4 focus:border-brand-purple outline-none transition-all"
          />
        </div>
      </header>

      {userChars.length === 0 ? (
        <div className="text-center py-20 glass-card bg-brand-dark/80 border-white/10">
          <Info className="mx-auto text-gray-500 mb-4" size={48} />
          <p className="text-gray-400">도감이 비어있습니다. 사냥을 시작하여 존재들을 포획하세요!</p>
        </div>
      ) : filteredCollection.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 italic">검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredCollection.map((char, i) => (
            <CharacterCard 
              key={char.id} 
              char={char} 
              onClick={() => setSelectedChar(char)} 
              index={i} 
            />
          ))}
        </div>
      )}

      {/* Details Modal */}
      <AnimatePresence>
        {selectedChar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/95 backdrop-blur-lg"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-card bg-brand-dark/95 max-w-2xl w-full p-8 relative overflow-hidden border border-white/20 shadow-2xl"
            >
              <button 
                onClick={() => setSelectedChar(null)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white"
              >
                <X size={24} />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className={cn("aspect-square rounded-2xl flex items-center justify-center border relative group overflow-hidden bg-brand-dark", getRarityBorder(selectedChar.rarity))}>
                  <div className={cn("absolute inset-0 opacity-20 blur-3xl rounded-full", getRarityBg(selectedChar.rarity))} />
                  {selectedChar.imageUrl && !imgError ? (
                    <img 
                      src={selectedChar.imageUrl} 
                      alt={selectedChar.name} 
                      className="w-full h-full object-cover relative z-10 transition-transform duration-700 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <motion.div 
                      animate={['Unique', 'Epic', 'Legendary'].includes(selectedChar.rarity) ? { 
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0]
                      } : {}}
                      transition={{ duration: 5, repeat: Infinity }}
                      className="text-8xl relative z-10 select-none group-hover:scale-110 transition-transform duration-700"
                    >
                      {selectedChar.visualEmoji || charToIcon(selectedChar.category)}
                    </motion.div>
                  )}
                  {selectedChar.isShiny && (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),transparent)] animate-pulse z-20 pointer-events-none" />
                  )}
                  <div className="absolute bottom-4 left-4 font-mono text-[10px] text-white/50 z-20 bg-black/40 px-2 rounded backdrop-blur-sm">ID: {selectedChar.id}</div>
                </div>

                <div className="flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <div className={cn("text-sm font-mono tracking-[0.2em]", getRarityColor(selectedChar.rarity))}>
                      {selectedChar.rarity} 개체
                    </div>
                    <div className="px-2 py-1 bg-white/10 rounded flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 font-mono">COUNT</span>
                      <span className="text-sm font-bold text-white">x{selectedChar.count || 1}</span>
                    </div>
                  </div>
                  <h2 className="text-4xl font-bold mb-4">{selectedChar.name}</h2>
                  
                  <div className="space-y-4 flex-1">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                      <p className="text-xs text-gray-500 uppercase mb-1">관련 단어</p>
                      <p className="text-2xl font-bold tracking-widest text-brand-cyan mb-2">
                        {selectedChar.word.toUpperCase()} <span className="text-sm font-normal text-gray-400">({selectedChar.wordKorean})</span>
                      </p>
                      <p className="text-[10px] text-gray-400 leading-tight mb-2">
                        {selectedChar.wordDefinition}
                      </p>
                      <div className="p-2 bg-brand-cyan/5 border border-brand-cyan/10 rounded-lg">
                        <p className="text-[9px] text-brand-cyan uppercase font-mono mb-0.5">분석 힌트</p>
                        <p className="text-[11px] text-gray-300 italic">{selectedChar.wordHint}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 uppercase mb-1">설명 및 배경서사</p>
                      <p className="text-gray-300 italic leading-relaxed text-sm">{selectedChar.description}</p>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex flex-col text-xs text-gray-500 font-mono">
                      <span>{selectedChar.capturedAt.toLocaleDateString()} 포획됨</span>
                      {selectedChar.isShiny && (
                        <span className="flex items-center gap-1 text-yellow-400 mt-1">
                          <Grid size={12} /> 특별한 색상
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handleReManifest(selectedChar)}
                      disabled={reManifesting}
                      className="flex items-center gap-2 bg-brand-purple/20 hover:bg-brand-purple/40 border border-brand-purple/50 px-4 py-2 rounded-xl text-brand-purple text-xs font-black transition-all group/btn disabled:opacity-50"
                    >
                      {reManifesting ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Wand2 size={14} className="group-hover/btn:rotate-12 transition-transform" />
                      )}
                      {reManifesting ? "차원 재공명 중..." : "넥서스 재실체화 (UI 업그레이드)"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface CharacterCardProps {
  char: CapturedCharacter;
  onClick: () => void;
  index: number;
  key?: string | number;
}

function CharacterCard({ char, onClick, index }: CharacterCardProps) {
  const isHighRarity = ['Unique', 'Epic', 'Legendary'].includes(char.rarity);
  const [localImgError, setLocalImgError] = useState(false);
  
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -8, scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "glass-card p-0 text-left group transition-all flex flex-col items-center border-t-0 border-r-0 border-l-0 border-b-4 relative overflow-hidden",
        getRarityBorder(char.rarity),
        isHighRarity && " shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]"
      )}
    >
      <div className={cn("w-full h-1", getRarityBg(char.rarity))} />

      <div className="absolute top-3 left-3 z-20 px-2 py-0.5 rounded-full bg-black/80 border border-white/10 backdrop-blur-md">
        <span className="text-[10px] font-mono font-black text-white">x{char.count || 1}</span>
      </div>

      <div className="w-full aspect-square bg-gradient-to-b from-white/5 to-transparent flex items-center justify-center group-hover:bg-white/10 transition-colors relative overflow-hidden">
        <div className={cn("absolute inset-0 opacity-20 blur-2xl rounded-full scale-50 group-hover:scale-100 transition-transform duration-700", getRarityBg(char.rarity))} />
        
        {char.imageUrl && !localImgError ? (
          <img 
            src={char.imageUrl} 
            alt={char.name} 
            className="w-full h-full object-cover relative z-10 transition-transform duration-500 group-hover:scale-110"
            referrerPolicy="no-referrer"
            onError={() => setLocalImgError(true)}
          />
        ) : (
          <motion.div
             animate={isHighRarity ? { 
               rotate: [0, 5, -5, 0], 
               scale: [1, 1.1, 1],
             } : {}}
             transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
             className="relative z-10 filter drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] text-5xl"
          >
            {char.visualEmoji || charToIcon(char.category)}
          </motion.div>
        )}
        
        {char.rarity === 'Legendary' && (
          <div className="absolute inset-0 z-0">
             <div className="absolute inset-x-0 top-0 h-full bg-[conic-gradient(from_0deg,transparent,rgba(250,204,21,0.1),transparent)] animate-[spin_4s_linear_infinite]" />
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        
        {char.isShiny && <div className="absolute top-2 right-2 text-yellow-400 font-bold text-xs animate-bounce">✨</div>}
      </div>

      <div className="w-full p-3 bg-black/40 backdrop-blur-sm mt-auto border-t border-white/5">
        <h4 className={cn("font-black text-[11px] truncate mb-0.5 tracking-tight group-hover:text-white transition-colors uppercase", isHighRarity ? getRarityColor(char.rarity) : "text-gray-300")}>
          {char.name}
        </h4>
        <div className="flex justify-between items-center">
          <p className={cn("text-[9px] font-mono font-bold tracking-[0.1em] uppercase opacity-60", getRarityColor(char.rarity))}>
            {char.rarity}
          </p>
          <p className="text-[10px] font-mono text-gray-500 uppercase">LV.{char.level || 1}</p>
        </div>
      </div>

      {isHighRarity && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 right-4 w-1 h-1 bg-white rounded-full animate-ping opacity-20" />
          <div className="absolute bottom-12 left-4 w-1 h-1 bg-white rounded-full animate-ping opacity-20 delay-700" />
        </div>
      )}
    </motion.button>
  );
}

function charToIcon(cat: string) {
  switch (cat) {
    case '생명체': return '👾';
    case '유물': return '🔮';
    case '현상': return '✨';
    case '공간': return '🌌';
    case '추상': return '🧿';
    case '상황': return '💥';
    case '관계': return '🔗';
    default: return '❓';
  }
}
