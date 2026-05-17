/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import MainMenu from './components/MainMenu';
import HangmanGame from './components/HangmanGame';
import Collection from './components/Collection';
import Ranking from './components/Ranking';
import { motion, AnimatePresence } from 'motion/react';

function AppContent() {
  const { loading } = useGame();
  const [view, setView] = useState<'menu' | 'playing' | 'collection' | 'ranking'>('menu');
  const [gameMode, setGameMode] = useState<'Farming' | 'Challenge'>('Farming');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-brand-purple font-mono tracking-widest animate-pulse">워드 넥서스에 연결하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen selection:bg-brand-purple selection:text-white">
      <AnimatePresence mode="wait">
        {view === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <MainMenu 
              onStartGame={(mode) => {
                setGameMode(mode);
                setView('playing');
              }} 
              onViewCollection={() => setView('collection')}
              onViewRankings={() => setView('ranking')}
            />
          </motion.div>
        )}

        {view === 'playing' && (
          <motion.div
            key="game"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <HangmanGame 
              mode={gameMode} 
              onExit={() => setView('menu')} 
            />
          </motion.div>
        )}

        {view === 'collection' && (
          <motion.div
            key="collection"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Collection onBack={() => setView('menu')} />
          </motion.div>
        )}

        {view === 'ranking' && (
          <motion.div
            key="ranking"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Ranking onBack={() => setView('menu')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}
