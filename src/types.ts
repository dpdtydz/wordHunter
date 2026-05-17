export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Unique' | 'Epic' | 'Legendary';

export interface GameCharacter {
  id: string;
  characterId: string;
  name: string;
  rarity: Rarity;
  word: string;
  wordKorean: string;
  wordDefinition?: string;
  wordHint: string;
  visualEmoji: string;
  category: '생명체' | '유물' | '현상' | '공간' | '추상' | '상황' | '관계';
  description: string;
  imageUrl?: string;
  isShiny: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  experience: number;
  level: number;
  coins: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CapturedCharacter extends GameCharacter {
  capturedAt: Date;
  count: number;
  level: number;
}

export interface UserRanking {
  userId: string;
  userName: string;
  totalWordsSolved: number;
  collectionCount: number;
  lastUpdatedAt: Date;
}

export enum GameDifficulty {
  FARMING = 'Farming',
  CHALLENGE = 'Challenge'
}

export enum ChallengeLevel {
  BRONZE = 'Bronze',
  SILVER = 'Silver',
  GOLD = 'Gold',
  DIAMOND = 'Diamond',
  MASTER = 'Master',
  NIGHTMARE = 'Nightmare'
}
