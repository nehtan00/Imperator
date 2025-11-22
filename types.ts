export type PlayerId = 1 | 2 | 3 | 4;

export enum PieceState {
  START = 'START',
  IN_PLAY = 'IN_PLAY',
  HOME = 'HOME',
}

export interface Piece {
  id: number; // 0-15 unique piece id
  playerId: PlayerId;
  state: PieceState;
  position: number; // -1 for start, 0-55 for board, 101+ for home
}

export interface Player {
  id: PlayerId;
  name: string;
  color: string;
  pieces: Piece[];
  avatarUrl: string | null;
  hasShield: boolean;
  isComputer: boolean;
}

export enum GameState {
  LANDING = 'LANDING',
  SETUP = 'SETUP',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export type GameMode = 'SINGLE_PLAYER' | 'LOCAL_MULTI' | 'HOST_ONLINE' | 'JOIN_ONLINE';

export enum SpecialAbility {
  SHIELD = 'SHIELD',
  PLUS_ONE = 'PLUS_ONE',
  BACK_FORTH = 'BACK_FORTH',
  SWORD = 'SWORD',
  GOLD_TOKEN = 'GOLD_TOKEN',
  NONE = 'NONE',
}

export enum BoardSpaceType {
    NORMAL = 'NORMAL',
    WARP = 'WARP',
    GO_AGAIN = 'GO_AGAIN',
    START_ENTRY = 'START_ENTRY',
    HOME_PATH = 'HOME_PATH',
    HOME = 'HOME',
    START = 'START'
}

export interface BoardSpace {
    position: number;
    type: BoardSpaceType;
    playerId?: PlayerId;
    warpTarget?: number;
}

export type PendingAction =
  | { type: 'roll' }
  | { type: 'move'; pieceId: number | null; validMoves: number[] | null }
  | { type: 'use_ability'; ability: SpecialAbility }
  | { type: 'shield_defense'; attackerId: PlayerId; defenderId: PlayerId; position: number }
  | { type: 'initializing' }
  | { type: 'game_over' }
  | null;