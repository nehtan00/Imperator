
import { PlayerId, SpecialAbility, BoardSpace, BoardSpaceType } from './types';

export const PLAYER_COUNT = 4;
export const PIECES_PER_PLAYER = 4;
export const MAIN_CIRCUIT_SIZE = 40;
export const HOME_PATH_SIZE = 4;

// Adjusted for symmetric 11x11 grid layout
// P1 (Red): Bottom Edge. Entry at 4 (Warp). Start at 6.
// P2 (Blue): Right Edge. Entry at 14 (Warp). Start at 16.
// P3 (Yellow): Top Edge. Entry at 24 (Warp). Start at 26.
// P4 (Green): Left Edge. Entry at 34 (Warp). Start at 36.
export const PLAYER_CONFIG: Record<PlayerId, { color: string; startPosition: number; homeEntryPosition: number }> = {
  1: { color: '#ff4141', startPosition: 6, homeEntryPosition: 4 },
  2: { color: '#41a7ff', startPosition: 16, homeEntryPosition: 14 },
  3: { color: '#ffda41', startPosition: 26, homeEntryPosition: 24 },
  4: { color: '#52ff41', startPosition: 36, homeEntryPosition: 34 },
};

export const ABILITY_DIE_FACES: SpecialAbility[] = [
  SpecialAbility.SHIELD,
  SpecialAbility.PLUS_ONE,
  SpecialAbility.BACK_FORTH,
  SpecialAbility.SWORD,
  SpecialAbility.GOLD_TOKEN,
  SpecialAbility.NONE,
];

// SVG Path strings for icons
export const ABILITY_ICON_PATHS: Record<SpecialAbility, string> = {
  [SpecialAbility.SHIELD]: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286zm0 13.036h.008v.008h-.008v-.008z",
  [SpecialAbility.PLUS_ONE]: "M12 4.5v15m7.5-7.5h-15",
  [SpecialAbility.BACK_FORTH]: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h18m-7.5-10.5L21 10.5m0 0L16.5 6M21 10.5H3",
  [SpecialAbility.SWORD]: "M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V5.75A2.25 2.25 0 0018 3.5H6A2.25 2.25 0 003.75 5.75v12.5A2.25 2.25 0 006 20.25z",
  [SpecialAbility.GOLD_TOKEN]: "M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75",
  [SpecialAbility.NONE]: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
};

export const ABILITY_DESCRIPTIONS: Record<SpecialAbility, string> = {
  [SpecialAbility.SHIELD]: "SHIELD: Gain the shield. If another player lands on you, you can prevent being sent back to start.",
  [SpecialAbility.PLUS_ONE]: "+1: Add 1 to your numbered die roll.",
  [SpecialAbility.BACK_FORTH]: "SWAP: Move forward or backward.",
  [SpecialAbility.SWORD]: "SABOTAGE: Move an opponent's piece backward by your dice roll value.",
  [SpecialAbility.GOLD_TOKEN]: "SHORTCUT: Move a piece from Start to your entry space.",
  [SpecialAbility.NONE]: "NEUTRAL: No special ability this turn.",
};

export function createBoardLayout(): BoardSpace[] {
    const board: BoardSpace[] = [];
    
    // Main circuit (0-39)
    for (let i = 0; i < MAIN_CIRCUIT_SIZE; i++) {
        board.push({ position: i, type: BoardSpaceType.NORMAL });
    }

    // Start entry points
    Object.values(PLAYER_CONFIG).forEach(p => {
        board[p.startPosition].type = BoardSpaceType.START_ENTRY;
        board[p.startPosition].playerId = Object.keys(PLAYER_CONFIG).find(key => PLAYER_CONFIG[key as unknown as PlayerId] === p) as unknown as PlayerId;
    });

    // Home paths
    Object.keys(PLAYER_CONFIG).forEach(key => {
        const playerId = parseInt(key) as PlayerId;
        for (let i = 0; i < HOME_PATH_SIZE; i++) {
            const position = 100 * playerId + i + 1;
            board.push({
                position,
                type: i === HOME_PATH_SIZE - 1 ? BoardSpaceType.HOME : BoardSpaceType.HOME_PATH,
                playerId,
            });
        }
    });

    // Warps - Placed exactly before Home Entries (4, 14, 24, 34)
    // Linked symmetrically across the board
    // 4 (Bottom) <-> 24 (Top)
    // 14 (Right) <-> 34 (Left)
    
    // Warp 1: 4 -> 24
    board[4].type = BoardSpaceType.WARP;
    board[4].warpTarget = 24;

    // Warp 2: 14 -> 34
    board[14].type = BoardSpaceType.WARP;
    board[14].warpTarget = 34;

    // Warp 3: 24 -> 4
    board[24].type = BoardSpaceType.WARP;
    board[24].warpTarget = 4;

    // Warp 4: 34 -> 14
    board[34].type = BoardSpaceType.WARP;
    board[34].warpTarget = 14;

    // Go Again spots at the corners for symmetry
    const corners = [0, 10, 20, 30];
    corners.forEach(pos => {
        // Don't overwrite if something critical is there (though currently nothing conflicts with corners)
        if (board[pos].type === BoardSpaceType.NORMAL) {
            board[pos].type = BoardSpaceType.GO_AGAIN;
        }
    });

    return board;
}
