import { Rarity } from '../types';

export function getRarityColor(rarity?: Rarity) {
  if (!rarity) return "text-white";
  const colors: Record<Rarity, string> = {
    'Common': 'text-gray-400',
    'Uncommon': 'text-emerald-400',
    'Rare': 'text-brand-cyan',
    'Unique': 'text-brand-purple',
    'Epic': 'text-pink-500',
    'Legendary': 'text-yellow-400 font-bold tracking-widest neon-glow'
  };
  return colors[rarity];
}

export function getRarityBorder(rarity?: Rarity) {
  if (!rarity) return "border-transparent";
  const colors: Record<Rarity, string> = {
    'Common': 'border-white/5',
    'Uncommon': 'border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]',
    'Rare': 'border-brand-cyan/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]',
    'Unique': 'border-brand-purple/30 shadow-[0_0_20px_rgba(168,85,247,0.15)]',
    'Epic': 'border-pink-500/40 shadow-[0_0_25px_rgba(236,72,153,0.2)]',
    'Legendary': 'border-yellow-400/50 shadow-[0_0_30px_rgba(250,204,21,0.3)]'
  };
  return colors[rarity];
}

export function getRarityBg(rarity?: Rarity) {
  if (!rarity) return "bg-transparent";
  const bgs: Record<Rarity, string> = {
    'Common': 'bg-gray-500',
    'Uncommon': 'bg-emerald-500',
    'Rare': 'bg-brand-cyan',
    'Unique': 'bg-brand-purple',
    'Epic': 'bg-pink-500',
    'Legendary': 'bg-yellow-400'
  };
  return bgs[rarity];
}
