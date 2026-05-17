import React from 'react';
import { motion } from 'motion/react';
import { Play, Book, Trophy, LogOut, Sword, Search } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { cn } from '../lib/utils';

interface MainMenuProps {
  onStartGame: (mode: 'Farming' | 'Challenge') => void;
  onViewCollection: () => void;
  onViewRankings: () => void;
}

export default function MainMenu({ onStartGame, onViewCollection, onViewRankings }: MainMenuProps) {
  const { user, profile, signIn, logout, collection } = useGame();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-6xl font-bold mb-4 neon-glow tracking-tighter">워드 헌터</h1>
          <p className="text-gray-400 max-w-md">실체화된 단어들의 세계, 워드 넥서스. 단어를 맞추고 넥서스의 존재들을 포획하여 위대한 헌터가 되세요.</p>
        </motion.div>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={signIn}
          className="bg-brand-purple px-8 py-4 rounded-full font-bold text-lg flex items-center gap-2 shadow-lg shadow-purple-500/20"
        >
          <Play className="fill-current" />
          여정 시작하기
        </motion.button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <header className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-purple flex items-center justify-center text-2xl font-bold border-2 border-brand-cyan">
             {profile?.level || 1}
          </div>
          <div>
            <h2 className="text-xl font-bold">{profile?.displayName}</h2>
            <p className="text-sm text-brand-cyan font-mono">레벨 {profile?.level} • {profile?.experience} 경험치</p>
          </div>
        </div>
        <button onClick={logout} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
          <LogOut size={20} />
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MenuCard
          title="파밍 존"
          description="기본적인 개체 포획 구역입니다. 쉬운 단어와 안정적인 보상이 제공됩니다."
          icon={<Search className="text-brand-cyan" size={32} />}
          onClick={() => onStartGame('Farming')}
          color="cyan"
        />
        <MenuCard
          title="도전 존"
          description="고위험 고수익 구역입니다. 더 강력한 정체와 희귀한 개체가 등장합니다."
          icon={<Sword className="text-brand-purple" size={32} />}
          onClick={() => onStartGame('Challenge')}
          color="purple"
        />
        <MenuCard
          title="도감"
          description={`현재 포획량: ${collection.length} / ???`}
          icon={<Book className="text-yellow-400" size={32} />}
          onClick={onViewCollection}
          color="yellow"
        />
        <MenuCard
          title="랭킹"
          description="전 세계 헌터들 사이에서 당신의 명성을 확인하세요."
          icon={<Trophy className="text-emerald-400" size={32} />}
          onClick={onViewRankings}
          color="green"
        />
      </div>
    </div>
  );
}

function MenuCard({ title, description, icon, onClick, color }: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  color: 'cyan' | 'purple' | 'yellow' | 'green';
}) {
  const colorMap = {
    cyan: 'hover:border-brand-cyan/50 shadow-brand-cyan/10',
    purple: 'hover:border-brand-purple/50 shadow-brand-purple/10',
    yellow: 'hover:border-yellow-400/50 shadow-yellow-400/10',
    green: 'hover:border-emerald-400/50 shadow-emerald-400/10',
  };

  return (
    <motion.button
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "glass-card p-8 text-left transition-all group border-transparent",
        colorMap[color]
      )}
    >
      <div className="mb-4">{icon}</div>
      <h3 className="text-2xl font-bold mb-2 group-hover:text-white transition-colors">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </motion.button>
  );
}
