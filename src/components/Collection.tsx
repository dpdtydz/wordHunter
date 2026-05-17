import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGame } from '../context/GameContext';
import { CapturedCharacter, GameCharacter } from '../types';
import { Search, Info, X, RefreshCw, Wand2, Sparkles, BookOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { getRarityBg, getRarityBorder, getRarityColor } from '../lib/gameUtils';

interface CollectionProps {
  onBack: () => void;
}

// ─── Shimmer skeleton shown while the image URL loads ───────────────────────
function CardShimmer() {
  return (
    <div className="absolute inset-0 z-10 overflow-hidden bg-brand-gray/60">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/8 to-transparent" />
    </div>
  );
}

// ─── Fallback art when no imageUrl is available ───────────────────────────
function CardArtFallback({ char }: { char: CapturedCharacter }) {
  const keywords = ((char as any).visualKeywords || char.visualEmoji || '')
    .split(' / ')
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 select-none">
      {/* Word as the hero visual element */}
      <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.3em] mb-2">
        {char.category}
      </p>
      <div className={cn(
        'text-2xl font-black tracking-widest text-center leading-tight mb-3 drop-shadow-lg',
        getRarityColor(char.rarity),
      )}>
        {char.word.toUpperCase()}
      </div>
      <div className="text-[11px] text-gray-400 mb-4 font-medium">{char.wordKorean}</div>

      {/* Visual keyword chips */}
      {keywords.length > 0 && (
        <div className="flex flex-col items-center gap-1 w-full">
          {keywords.map((kw: string, i: number) => (
            <span
              key={i}
              className="text-[8px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-500 font-mono truncate max-w-full"
            >
              {kw.trim()}
            </span>
          ))}
        </div>
      )}

      {/* Subtle "image pending" indicator */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 opacity-40">
        <RefreshCw size={8} className="text-gray-500 animate-spin" style={{ animationDuration: '3s' }} />
      </div>
    </div>
  );
}

export default function Collection({ onBack }: CollectionProps) {
  const { collection: userChars, addCharacterToCollection } = useGame();
  const [filter, setFilter] = useState('');
  const [selectedChar, setSelectedChar] = useState<CapturedCharacter | null>(null);
  const [reManifesting, setReManifesting] = useState(false);
  const [modalImgLoaded, setModalImgLoaded] = useState(false);
  const [modalImgError, setModalImgError] = useState(false);

  React.useEffect(() => {
    setModalImgLoaded(false);
    setModalImgError(false);
  }, [selectedChar?.id]);

  const handleReManifest = async (char: CapturedCharacter) => {
    setReManifesting(true);
    try {
      const { generateWordData, generateAndStoreCharacterImage } = await import('../services/geminiService');

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
        visualEmoji: (data as any).visualKeywords || data.visualEmoji,
        category: data.category,
        description: data.charDescription,
        imageUrl: '',
        isShiny: char.isShiny || false,
      };

      setSelectedChar({ ...char, ...textOnlyChar } as CapturedCharacter);
      setModalImgLoaded(false);
      await addCharacterToCollection(textOnlyChar);

      const newImageUrl = await generateAndStoreCharacterImage(
        char.word,
        data.characterName,
        data.charDescription,
        data.rarity,
        (data as any).visualKeywords || data.visualEmoji,
        data.wordKorean,
        true,
      );
      if (newImageUrl) {
        const final = { ...textOnlyChar, imageUrl: newImageUrl };
        await addCharacterToCollection(final);
        setSelectedChar(prev => prev ? { ...prev, imageUrl: newImageUrl } : null);
      }
    } catch (err) {
      console.error('Re-manifest failed', err);
    } finally {
      setReManifesting(false);
    }
  };

  const filteredCollection = userChars.filter(char => {
    const q = (filter || '').toLowerCase();
    return char.name?.toLowerCase().includes(q) || char.word?.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <button onClick={onBack} className="text-gray-500 hover:text-white transition-colors text-sm mb-2 flex items-center gap-1">
            ← 캠프로 돌아가기
          </button>
          <h1 className="text-4xl font-bold neon-glow">개체 도감</h1>
          <p className="text-gray-400 font-mono text-sm tracking-widest">
            {userChars.length}마리의 존재 포획됨
          </p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="이름이나 단어로 검색..."
            value={filter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
            className="w-full bg-brand-gray border border-white/10 rounded-full py-2 pl-10 pr-4 focus:border-brand-purple outline-none transition-all"
          />
        </div>
      </header>

      {/* Card grid */}
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

      {/* Detail modal */}
      <AnimatePresence>
        {selectedChar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/95 backdrop-blur-xl"
            onClick={() => setSelectedChar(null)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 24 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
              className={cn(
                'relative w-full max-w-2xl rounded-3xl overflow-hidden border shadow-2xl bg-[#0d0d10]',
                getRarityBorder(selectedChar.rarity),
              )}
            >
              {/* Top rarity bar */}
              <div className={cn('h-1 w-full', getRarityBg(selectedChar.rarity))} />

              <button
                onClick={() => setSelectedChar(null)}
                className="absolute top-4 right-4 z-30 p-1 rounded-full bg-black/50 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Art panel */}
                <div className="relative min-h-[320px] md:min-h-[480px] bg-black/40 overflow-hidden flex items-center justify-center">
                  <div className={cn('absolute inset-0 opacity-15 blur-3xl scale-75', getRarityBg(selectedChar.rarity))} />

                  {selectedChar.imageUrl && !modalImgError ? (
                    <>
                      {!modalImgLoaded && (
                        <div className="absolute inset-0 bg-brand-gray/60 overflow-hidden">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/8 to-transparent" />
                        </div>
                      )}
                      <motion.img
                        src={selectedChar.imageUrl}
                        alt={selectedChar.name}
                        referrerPolicy="no-referrer"
                        onLoad={() => setModalImgLoaded(true)}
                        onError={() => setModalImgError(true)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: modalImgLoaded ? 1 : 0 }}
                        transition={{ duration: 0.6 }}
                        className="w-full h-full object-cover absolute inset-0"
                      />
                    </>
                  ) : (
                    <ModalArtFallback char={selectedChar} />
                  )}

                  {/* Rarity badge overlay */}
                  <div className="absolute top-4 left-4 z-10">
                    <span className={cn(
                      'text-[10px] font-mono font-black tracking-[0.3em] px-3 py-1 rounded-full bg-black/70 border border-white/10 backdrop-blur-sm uppercase',
                      getRarityColor(selectedChar.rarity),
                    )}>
                      {selectedChar.rarity}
                    </span>
                  </div>

                  {/* Shiny overlay */}
                  {selectedChar.isShiny && (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.08),transparent_60%)] pointer-events-none z-20 animate-pulse" />
                  )}

                  {/* Bottom gradient for text legibility */}
                  <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none" />
                  <div className="absolute bottom-4 left-4 z-20">
                    <p className="text-[9px] font-mono text-white/40">ID: {selectedChar.id}</p>
                  </div>
                </div>

                {/* Info panel */}
                <div className="flex flex-col p-6 bg-[#0d0d10]">
                  <div className="flex justify-between items-center mb-1">
                    <span className={cn('text-[10px] font-mono tracking-[0.25em] uppercase', getRarityColor(selectedChar.rarity))}>
                      {selectedChar.category} 개체
                    </span>
                    <span className="px-2 py-0.5 bg-white/8 rounded text-[10px] font-mono text-gray-400">
                      x{selectedChar.count || 1} 보유
                    </span>
                  </div>

                  <h2 className="text-3xl font-black mb-1 leading-tight">{selectedChar.name}</h2>
                  <p className="text-[10px] font-mono text-gray-600 mb-4">LV.{selectedChar.level || 1}</p>

                  {/* Word info */}
                  <div className="rounded-2xl bg-white/4 border border-white/8 p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen size={12} className="text-brand-cyan" />
                      <span className="text-[9px] font-mono text-brand-cyan uppercase tracking-widest">관련 단어</span>
                    </div>
                    <p className="text-xl font-black tracking-widest text-brand-cyan">
                      {selectedChar.word.toUpperCase()}
                      <span className="text-sm font-normal text-gray-400 ml-2 tracking-normal">
                        {selectedChar.wordKorean}
                      </span>
                    </p>
                    <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                      {selectedChar.wordDefinition}
                    </p>
                    {selectedChar.wordHint && (
                      <div className="mt-2 p-2 bg-brand-cyan/5 border border-brand-cyan/10 rounded-lg">
                        <p className="text-[8px] text-brand-cyan/60 uppercase font-mono mb-0.5">힌트</p>
                        <p className="text-[10px] text-gray-400 italic">{selectedChar.wordHint}</p>
                      </div>
                    )}
                  </div>

                  {/* Lore */}
                  <div className="flex-1 mb-4">
                    <p className="text-[9px] font-mono text-gray-600 uppercase tracking-widest mb-2">배경 서사</p>
                    <p className="text-gray-300 text-sm leading-relaxed italic">{selectedChar.description}</p>
                  </div>

                  <div className="pt-4 border-t border-white/8 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <p className="text-[10px] text-gray-600 font-mono">
                      {selectedChar.capturedAt.toLocaleDateString()} 포획
                      {selectedChar.isShiny && (
                        <span className="ml-2 text-yellow-400">
                          <Sparkles size={10} className="inline" /> 특별한 색상
                        </span>
                      )}
                    </p>
                    <button
                      onClick={() => handleReManifest(selectedChar)}
                      disabled={reManifesting}
                      className="flex items-center gap-2 bg-brand-purple/15 hover:bg-brand-purple/35 border border-brand-purple/40 px-4 py-2 rounded-xl text-brand-purple text-xs font-black transition-all group/btn disabled:opacity-40 whitespace-nowrap"
                    >
                      {reManifesting
                        ? <RefreshCw size={13} className="animate-spin" />
                        : <Wand2 size={13} className="group-hover/btn:rotate-12 transition-transform" />}
                      {reManifesting ? '재실체화 중...' : '넥서스 재실체화'}
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

// ─── Detail modal fallback art ────────────────────────────────────────────────
function ModalArtFallback({ char }: { char: CapturedCharacter }) {
  const keywords = ((char as any).visualKeywords || char.visualEmoji || '')
    .split(' / ')
    .filter(Boolean);

  return (
    <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-8 text-center">
      <p className={cn('text-6xl font-black tracking-widest mb-3', getRarityColor(char.rarity))}>
        {char.word.toUpperCase()}
      </p>
      <p className="text-gray-500 text-base mb-6">{char.wordKorean}</p>
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {keywords.map((kw: string, i: number) => (
            <span key={i} className="text-[10px] px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-500 font-mono">
              {kw.trim()}
            </span>
          ))}
        </div>
      )}
      <div className="mt-6 flex items-center gap-2 text-gray-600 text-[10px] font-mono">
        <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '3s' }} />
        이미지 생성 중
      </div>
    </div>
  );
}

// ─── Collection card ──────────────────────────────────────────────────────────
interface CharacterCardProps {
  char: CapturedCharacter;
  onClick: () => void;
  index: number;
  key?: React.Key;
}

function CharacterCard({ char, onClick, index }: CharacterCardProps) {
  const isHighRarity = ['Unique', 'Epic', 'Legendary'].includes(char.rarity);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const hasImage = !!char.imageUrl && !imgError;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', damping: 20 }}
      whileHover={{ y: -6, scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        'relative text-left group overflow-hidden rounded-2xl flex flex-col border',
        'bg-[#0d0d10] transition-shadow duration-300',
        getRarityBorder(char.rarity),
        isHighRarity && 'shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)]',
      )}
    >
      {/* Top rarity stripe */}
      <div className={cn('w-full h-[3px] flex-shrink-0', getRarityBg(char.rarity))} />

      {/* Count badge */}
      <div className="absolute top-3 left-3 z-20 px-1.5 py-0.5 rounded-full bg-black/80 border border-white/10 backdrop-blur-sm">
        <span className="text-[9px] font-mono font-black text-white">×{char.count || 1}</span>
      </div>

      {/* Shiny badge */}
      {char.isShiny && (
        <div className="absolute top-3 right-3 z-20">
          <Sparkles size={12} className="text-yellow-400 animate-pulse" />
        </div>
      )}

      {/* Art area */}
      <div className="relative w-full aspect-square overflow-hidden bg-black/30">
        {/* Rarity glow */}
        <div className={cn(
          'absolute inset-0 opacity-0 group-hover:opacity-25 transition-opacity duration-500 blur-2xl',
          getRarityBg(char.rarity),
        )} />

        {hasImage ? (
          <>
            {!imgLoaded && <CardShimmer />}
            <motion.img
              src={char.imageUrl!}
              alt={char.name}
              referrerPolicy="no-referrer"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              animate={{ opacity: imgLoaded ? 1 : 0, scale: imgLoaded ? 1 : 1.05 }}
              transition={{ duration: 0.5 }}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          </>
        ) : (
          <CardArtFallback char={char} />
        )}

        {/* Legendary spin effect */}
        {char.rarity === 'Legendary' && (
          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent,rgba(250,204,21,0.06),transparent)] animate-[spin_6s_linear_infinite]" />
          </div>
        )}

        {/* Hover shine sweep */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/6 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
      </div>

      {/* Info strip */}
      <div className="w-full px-3 py-2.5 bg-black/50 backdrop-blur-sm border-t border-white/5 mt-auto">
        <h4 className={cn(
          'font-black text-[11px] truncate mb-0.5 tracking-tight',
          isHighRarity ? getRarityColor(char.rarity) : 'text-gray-200',
          'group-hover:text-white transition-colors',
        )}>
          {char.name}
        </h4>
        <div className="flex justify-between items-center">
          <span className={cn('text-[8px] font-mono font-bold tracking-widest uppercase opacity-50', getRarityColor(char.rarity))}>
            {char.rarity}
          </span>
          <span className="text-[9px] font-mono text-gray-600">LV.{char.level || 1}</span>
        </div>
      </div>

      {/* High-rarity particle sparks */}
      {isHighRarity && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute top-2 right-5 w-0.5 h-0.5 bg-white rounded-full animate-ping opacity-30" />
          <div className="absolute bottom-10 left-3 w-0.5 h-0.5 bg-white rounded-full animate-ping opacity-20 [animation-delay:700ms]" />
        </div>
      )}
    </motion.button>
  );
}
