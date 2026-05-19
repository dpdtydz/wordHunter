import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, orderBy, limit, serverTimestamp, setDoc as setFirestoreDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, CapturedCharacter, UserRanking, GameCharacter } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

interface GameContextType {
  user: User | null;
  profile: UserProfile | null;
  collection: CapturedCharacter[];
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  updateProgress: (exp: number, coins: number) => Promise<void>;
  addCharacterToCollection: (char: GameCharacter) => Promise<void>;
  fetchRankings: () => Promise<UserRanking[]>;
  prefetchCache: Record<string, any>;
  consumePrefetch: (mode: string) => any;
  triggerPrefetch: (mode: string) => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userCollection, setUserCollection] = useState<CapturedCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePrefetches, setActivePrefetches] = useState<Set<string>>(new Set());
  const [prefetchCache, setPrefetchCache] = useState<Record<string, any>>({
    Farming: null,
    Challenge: null
  });
  const [dbInstance, setDbInstance] = useState(db);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          const configDbId = (firebaseConfig as any).firestoreDatabaseId;
          const activeDbId = data.activeDatabaseId;
          
          if (activeDbId === "(default)" && configDbId && configDbId !== "(default)") {
            console.log("[Nexus] Server using (default) database. Switching client too.");
            const { getApp } = await import('firebase/app');
            const { getFirestore } = await import('firebase/firestore');
            const newDb = getFirestore(getApp());
            setDbInstance(newDb);
          }
        }
      } catch (e) {
        console.warn("[Nexus] Health check failed", e);
      }
    };
    checkHealth();
  }, []);

  const triggerPrefetch = async (mode: string) => {
    if (prefetchCache[mode] || activePrefetches.has(mode)) return;
    
    setActivePrefetches(prev => new Set(prev).add(mode));
    try {
      const { generateWordData } = await import('../services/geminiService');
      const data = await generateWordData(mode);
      setPrefetchCache(prev => ({ ...prev, [mode]: data }));
    } catch (err) {
      console.error("Prefetch failed", err);
    } finally {
      setActivePrefetches(prev => {
        const next = new Set(prev);
        next.delete(mode);
        return next;
      });
    }
  };

  const consumePrefetch = (mode: string) => {
    const data = prefetchCache[mode];
    setPrefetchCache(prev => ({ ...prev, [mode]: null }));
    return data;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await ensureUserProfile(user);
        await fetchUserCollections(user.uid);
        // Serialise prefetch calls with an even larger gap
        await triggerPrefetch('Farming');
        setTimeout(() => triggerPrefetch('Challenge'), 30000); // 30 seconds gap
      } else {
        setProfile(null);
        setUserCollection([]);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [dbInstance]);

  const ensureUserProfile = async (user: User) => {
    const userRef = doc(dbInstance, 'users', user.uid);
    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setProfile({
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as UserProfile);
      } else {
        const newProfile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName || 'Word Hunter',
          experience: 0,
          level: 1,
          coins: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await setDoc(userRef, {
          ...newProfile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setProfile(newProfile);
        
        // Initialize ranking entry
        await setFirestoreDoc(doc(dbInstance, 'rankings', user.uid), {
          userId: user.uid,
          userName: newProfile.displayName,
          totalWordsSolved: 0,
          collectionCount: 0,
          lastUpdatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    }
  };

  const fetchUserCollections = async (userId: string) => {
    try {
      const collRef = collection(dbInstance, 'users', userId, 'collection');
      const snap = await getDocs(collRef);
      const characters = snap.docs.map(d => ({
        ...d.data(),
        capturedAt: d.data().capturedAt.toDate()
      })) as CapturedCharacter[];
      setUserCollection(characters);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `users/${userId}/collection`);
    }
  };

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Sign in failed", error);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateProgress = async (expBonus: number, coinsBonus: number) => {
    if (!user || !profile) return;
    
    const newExp = profile.experience + expBonus;
    const newCoins = profile.coins + coinsBonus;
    const newLevel = Math.floor(newExp / 100) + 1; // Simple level logic
    
    const userRef = doc(dbInstance, 'users', user.uid);
    const rankingRef = doc(dbInstance, 'rankings', user.uid);

    try {
      await updateDoc(userRef, {
        experience: newExp,
        coins: newCoins,
        level: newLevel,
        updatedAt: serverTimestamp()
      });
      
      await updateDoc(rankingRef, {
        totalWordsSolved: (profile as any).totalWordsSolved ? (profile as any).totalWordsSolved + 1 : 1,
        lastUpdatedAt: serverTimestamp()
      });

      setProfile({
        ...profile,
        experience: newExp,
        coins: newCoins,
        level: newLevel,
        updatedAt: new Date()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const addCharacterToCollection = async (char: GameCharacter) => {
    if (!user || !profile) return;

    // Sanitize character data to remove undefined values for Firestore
    const sanitizedChar = Object.fromEntries(
      Object.entries(char).filter(([_, v]) => v !== undefined)
    ) as GameCharacter;

    try {
      const charRef = doc(dbInstance, 'users', user.uid, 'collection', sanitizedChar.id);
      const existingDoc = await getDoc(charRef);
      
      let finalChar: CapturedCharacter;
      
      if (existingDoc.exists()) {
        const data = existingDoc.data();
        
        // Check if this is a "Re-manifest" (changing fundamental fields) or just a duplicate capture
        const isUpdate = sanitizedChar.name !== data.name || sanitizedChar.imageUrl !== data.imageUrl;
        
        finalChar = {
          ...data,
          ...sanitizedChar,
          capturedAt: data.capturedAt instanceof Date ? data.capturedAt : data.capturedAt.toDate(),
          count: isUpdate ? (data.count || 1) : (data.count || 1) + 1,
          level: data.level || 1
        } as CapturedCharacter;
        
        await setDoc(charRef, {
          ...sanitizedChar,
          updatedAt: serverTimestamp(),
          count: finalChar.count,
          level: finalChar.level
        }, { merge: true });
        
        if (!isUpdate) {
          // Bonus coins only for actual duplicates
          await updateProgress(10, 50); 
        }
      } else {
        finalChar = {
          ...sanitizedChar,
          capturedAt: new Date(),
          count: 1,
          level: 1
        } as CapturedCharacter;
        
        await setDoc(charRef, {
          ...finalChar,
          capturedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        const rankingRef = doc(dbInstance, 'rankings', user.uid);
        const currentRank = await getDoc(rankingRef);
        const newCount = (currentRank.exists() ? currentRank.data().collectionCount : 0) + 1;
        
        await updateDoc(rankingRef, {
          collectionCount: newCount,
          lastUpdatedAt: serverTimestamp()
        });
      }

      setUserCollection(prev => {
        const exists = prev.find(p => p.id === sanitizedChar.id);
        if (exists) {
          return prev.map(p => p.id === sanitizedChar.id ? finalChar : p);
        }
        return [...prev, finalChar];
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/collection/${sanitizedChar.id}`);
    }
  };

  const fetchRankings = async () => {
    try {
      const q = query(collection(dbInstance, 'rankings'), orderBy('totalWordsSolved', 'desc'), limit(10));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        ...d.data(),
        lastUpdatedAt: d.data().lastUpdatedAt.toDate()
      })) as UserRanking[];
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'rankings');
      return [];
    }
  };

  return (
    <GameContext.Provider value={{
      user, profile, collection: userCollection, loading,
      signIn, logout, updateProgress, addCharacterToCollection, fetchRankings,
      prefetchCache, consumePrefetch, triggerPrefetch
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
