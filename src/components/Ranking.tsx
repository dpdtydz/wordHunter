import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useGame } from '../context/GameContext';
import { UserRanking } from '../types';
import { Trophy, Award, Medal, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

interface RankingProps {
  onBack: () => void;
}

export default function Ranking({ onBack }: RankingProps) {
  const { fetchRankings } = useGame();
  const [rankings, setRankings] = useState<UserRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await fetchRankings();
      setRankings(data);
      setLoading(false);
    };
    load();
  }, [fetchRankings]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <header className="mb-12">
        <button onClick={onBack} className="text-gray-500 hover:text-white transition-colors text-sm mb-2 flex items-center gap-1">
          ← 캠프로 돌아가기
        </button>
        <h1 className="text-4xl font-bold neon-glow">헌터의 전당</h1>
        <p className="text-gray-400 font-mono text-sm tracking-widest">글로벌 리더보드</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
            <RefreshCw className="text-brand-purple" size={32} />
          </motion.div>
        </div>
      ) : (
        <div className="space-y-px overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {/* Header */}
          <div className="grid grid-cols-[60px_1fr_120px_120px] items-center gap-4 p-4 bg-white/5 text-[10px] font-mono uppercase text-gray-500 tracking-widest border-b border-white/5">
            <span className="text-center">순위</span>
            <span>헌터</span>
            <span className="text-right">해결한 단어</span>
            <span className="text-right">수집한 개체</span>
          </div>

          {rankings.length === 0 ? (
            <div className="p-20 text-center text-gray-500 italic">아직 랭킹 정보가 없습니다. 첫 헌터가 되어보세요!</div>
          ) : (
            rankings.map((rank, i) => (
              <motion.div 
                key={rank.userId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "grid grid-cols-[60px_1fr_120px_120px] items-center gap-4 p-4 hover:bg-white/5 transition-colors",
                  i < 3 ? "bg-brand-purple/5" : ""
                )}
              >
                <div className="flex justify-center">
                  {i === 0 ? <Medal className="text-yellow-400" size={24} /> : 
                   i === 1 ? <Medal className="text-gray-300" size={24} /> : 
                   i === 2 ? <Medal className="text-amber-600" size={24} /> : 
                   <span className="text-gray-500 font-mono">#{i + 1}</span>}
                </div>
                
                <div className="flex flex-col">
                  <span className={cn("font-bold", i === 0 ? "text-yellow-400" : "text-white")}>
                    {rank.userName}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono italic">
                    업데이트: {rank.lastUpdatedAt.toLocaleDateString()}
                  </span>
                </div>

                <div className="text-right font-mono text-brand-purple font-bold">
                  {rank.totalWordsSolved}
                </div>

                <div className="text-right font-mono text-brand-cyan">
                  {rank.collectionCount}
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      <div className="mt-12 glass-card p-8 border-brand-cyan/20">
        <div className="flex items-start gap-4">
          <Award className="text-brand-cyan shrink-0" size={32} />
          <div>
            <h4 className="text-xl font-bold mb-2">등급 및 명성</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              사냥의 아드레날린을 느껴보세요. 더 많은 단어를 맞출수록 순위가 상승하며, 고유한 존재들을 더 많이 수집할수록 도감 명성이 높아집니다. 비밀(Secret) 등급의 개체는 랭킹에 엄청난 활력을 불어넣어 줍니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
