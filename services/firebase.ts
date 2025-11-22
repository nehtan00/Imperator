
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update, get, child, push } from "firebase/database";
import { getAuth, signInAnonymously } from "firebase/auth";
import { Player, GameState, PlayerId } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyBu5x6bh-LjlvAqg5ai15R5Qj8hUelGHFU",
  authDomain: "imperator-4b67f.firebaseapp.com",
  projectId: "imperator-4b67f",
  storageBucket: "imperator-4b67f.firebasestorage.app",
  messagingSenderId: "513246777598",
  appId: "1:513246777598:web:2b21d08ec07c9cbf5595af",
  measurementId: "G-X7B2EWGGD7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Helper to ensure we are authenticated before making DB calls
const ensureAuth = async () => {
    if (auth.currentUser) return auth.currentUser;
    try {
        const credential = await signInAnonymously(auth);
        return credential.user;
    } catch (error) {
        console.error("Error signing in anonymously:", error);
        throw error;
    }
};

export interface GameSession {
    gameId: string;
    players: Player[];
    gameState: GameState;
    currentPlayerId: PlayerId;
    dice: [number, number] | null;
    ability: string | null;
    pendingAction: any;
    winners: PlayerId[];
    lastUpdate?: number;
}

export const createGameSession = async (hostPlayer: Player): Promise<string> => {
    await ensureAuth();
    const gameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const gameRef = ref(db, 'games/' + gameId);
    
    const initialSession: GameSession = {
        gameId,
        players: [hostPlayer],
        gameState: GameState.SETUP,
        currentPlayerId: 1,
        dice: null,
        ability: null,
        pendingAction: null,
        winners: [],
        lastUpdate: Date.now()
    };

    await set(gameRef, initialSession);
    return gameId;
};

export const getGameSession = async (gameId: string): Promise<GameSession | null> => {
    await ensureAuth();
    const gameRef = ref(db, 'games/' + gameId);
    const snapshot = await get(gameRef);
    if (snapshot.exists()) {
        return snapshot.val() as GameSession;
    }
    return null;
};

export const joinGameSession = async (gameId: string, player: Player): Promise<boolean> => {
    await ensureAuth();
    const gameRef = ref(db, 'games/' + gameId);
    const snapshot = await get(gameRef);
    
    if (!snapshot.exists()) {
        return false;
    }

    const session = snapshot.val() as GameSession;
    
    // Check if player already exists
    const existingPlayerIndex = session.players.findIndex(p => p.id === player.id);
    let updatedPlayers = [...(session.players || [])];
    
    if (existingPlayerIndex >= 0) {
        updatedPlayers[existingPlayerIndex] = player;
    } else {
        updatedPlayers.push(player);
    }

    await update(gameRef, { players: updatedPlayers });
    return true;
};

export const subscribeToGame = (gameId: string, callback: (data: GameSession) => void) => {
    // onValue handles auth state changes automatically, but we trigger ensureAuth just in case
    ensureAuth().catch(console.error);
    
    const gameRef = ref(db, 'games/' + gameId);
    return onValue(gameRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        }
    });
};

export const updateRemoteGameState = async (gameId: string, updates: Partial<GameSession>) => {
    if (!auth.currentUser) await ensureAuth();
    const gameRef = ref(db, 'games/' + gameId);
    await update(gameRef, { ...updates, lastUpdate: Date.now() });
};
