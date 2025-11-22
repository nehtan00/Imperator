
import React from 'react';
import { Player, Piece, BoardSpace, BoardSpaceType, PlayerId, PieceState } from '../types';
import { Icon } from './Icon';
import { PLAYER_CONFIG } from '../gameConstants';

interface GameBoardProps {
  board: BoardSpace[];
  players: Player[];
  onPieceClick: (piece: Piece) => void;
  selectedPiece: number | null;
  validMoves: number[] | null;
  currentPlayerId: PlayerId;
}

// Grid is 11x11. Top-Left is (1,1).
// Clockwise Movement:
// 0-10: Left Edge (Bottom to Top)
// 11-20: Top Edge (Left to Right)
// 21-30: Right Edge (Top to Bottom)
// 31-39: Bottom Edge (Right to Left)

const getTrackCoordinates = (index: number): { col: number; row: number } => {
    // Left Edge: Index 0 (BL) to 10 (TL)
    if (index <= 10) return { col: 1, row: 11 - index };
    // Top Edge: Index 11 (TL+1) to 20 (TR)
    if (index <= 20) return { col: 1 + (index - 10), row: 1 };
    // Right Edge: Index 21 (TR+1) to 30 (BR)
    if (index <= 30) return { col: 11, row: 1 + (index - 20) };
    // Bottom Edge: Index 31 (BR-1) to 39 (BL+1)
    return { col: 11 - (index - 30), row: 11 };
};

const getHomeCoordinates = (playerId: PlayerId, step: number): { col: number; row: number } => {
    // Step 1-4 inside the home path
    // P1 Red (Left Edge) -> Moves Right. Entry at 4. Path starts from Left side.
    // P2 Blue (Top Edge) -> Moves Down. Entry at 14. Path starts from Top side.
    // P3 Yellow (Right Edge) -> Moves Left. Entry at 24. Path starts from Right side.
    // P4 Green (Bottom Edge) -> Moves Up. Entry at 34. Path starts from Bottom side.

    switch (playerId) {
        case 1: // Red (Left) -> Base BL. Entry 4. Home Path Row 7 (Lower Left).
            return { col: 1 + step, row: 7 };
        case 2: // Blue (Top) -> Base TL. Entry 14. Home Path Col 5 (Upper Left).
            return { col: 5, row: 1 + step };
        case 3: // Yellow (Right) -> Base TR. Entry 24. Home Path Row 5 (Upper Right).
            return { col: 11 - step, row: 5 };
        case 4: // Green (Bottom) -> Base BR. Entry 34. Home Path Col 7 (Lower Right).
            return { col: 7, row: 11 - step };
    }
    return { col: 6, row: 6 };
};

// Helper to get style for grid placement
const getGridStyle = (col: number, row: number): React.CSSProperties => ({
    gridColumnStart: col,
    gridRowStart: row,
});

const getPlayerColor = (playerId: PlayerId, players: Player[]) => {
    const p = players.find(pl => pl.id === playerId);
    return p ? p.color : PLAYER_CONFIG[playerId].color;
};

const BoardSpaceComponent: React.FC<{ space: BoardSpace; players: Player[] }> = ({ space, players }) => {
    let coords = { col: 1, row: 1 };
    let isHomePath = false;
    
    if (space.position < 100) {
        coords = getTrackCoordinates(space.position);
    } else {
        isHomePath = true;
        const playerId = Math.floor(space.position / 100) as PlayerId;
        const step = space.position % 100;
        coords = getHomeCoordinates(playerId, step);
    }

    let bgClass = 'bg-gray-900 bg-opacity-90';
    let borderClass = 'border border-gray-700';
    let content: React.ReactNode = null;
    const style: React.CSSProperties = {
        ...getGridStyle(coords.col, coords.row)
    };

    let tooltipText: string | null = null;

    if (space.type === BoardSpaceType.START_ENTRY) {
        // Parse ID to int to ensure correct lookup
        const pId = parseInt(Object.keys(PLAYER_CONFIG).find(k => PLAYER_CONFIG[k as unknown as PlayerId].startPosition === space.position) as string) as PlayerId;
        if (pId) {
            const pColor = getPlayerColor(pId, players);
            const playerName = players.find(p => p.id === pId)?.name || `P${pId}`;
            
            // Dynamic styling based on player color
            style.boxShadow = `inset 0 0 10px ${pColor}`;
            style.borderColor = pColor;
            style.backgroundColor = `${pColor}33`; // 20% opacity background
            
            content = <span className="text-[10px] font-black tracking-tighter" style={{color: pColor}}>START</span>;
            tooltipText = `START ZONE: ${playerName}`;
        }
    } else if (space.type === BoardSpaceType.HOME_PATH) {
        const pId = Math.floor(space.position / 100) as PlayerId;
        const pColor = getPlayerColor(pId, players);
        style.borderColor = pColor;
        style.backgroundColor = `${pColor}22`; // Very faint bg
        tooltipText = `HOME PATH: P${pId}`;
    } else if (space.type === BoardSpaceType.HOME) {
         const pId = Math.floor(space.position / 100) as PlayerId;
         const pColor = getPlayerColor(pId, players);
         style.backgroundColor = pColor;
         style.borderColor = pColor;
         content = <span className="text-[10px] font-black text-black tracking-tighter">HOME</span>;
         tooltipText = `HOME BASE: P${pId}`;
    } else if (space.type === BoardSpaceType.WARP) {
        borderClass = 'border-2 border-purple-500';
        style.boxShadow = 'inset 0 0 5px #a855f7';
        // Spinning concentric circles for Warp effect
        content = <Icon name="warp" className="w-6 h-6 text-purple-500 animate-[spin_3s_linear_infinite]" />;
        const warpId = space.position === 4 ? 1 : space.position === 14 ? 2 : space.position === 24 ? 3 : 4;
        tooltipText = `WARP / ENTRY: P${warpId} (Warp + 1 = Home)`;
    } else if (space.type === BoardSpaceType.GO_AGAIN) {
        borderClass = 'border-2 border-cyan-400';
        content = <Icon name="go-again" className="w-5 h-5 text-cyan-400" />;
        tooltipText = "SURGE: Roll again!";
    }

    const isTopHalf = coords.row < 6;
    const isLeftHalf = coords.col < 6;

    return (
        <div 
            className={`w-full h-full flex items-center justify-center relative box-border ${borderClass} ${bgClass} group hover:bg-gray-800 transition-colors z-0 hover:z-50`} 
            style={style}
        >
            {content}
            <span className="absolute top-0 left-0.5 text-[7px] text-gray-500 font-mono leading-none">{space.position < 100 ? space.position : ''}</span>
            
            {tooltipText && (
                <div className={`
                    absolute 
                    ${isTopHalf ? 'top-full mt-2' : 'bottom-full mb-2'} 
                    ${isLeftHalf ? 'left-0' : 'right-0'}
                    hidden group-hover:block
                    min-w-[120px]
                    z-[999] whitespace-nowrap
                    bg-black border border-[#00ff00] 
                    text-[#00ff00] text-[12px] px-2 py-1
                    shadow-[0_0_10px_rgba(0,255,0,0.6)]
                    pointer-events-none
                `}>
                    {tooltipText}
                </div>
            )}
        </div>
    );
};

const PlayerBase: React.FC<{ playerId: PlayerId; players: Player[] }> = ({ playerId, players }) => {
    // Bases are 3x3 areas in the corners.
    // Aligned to Board Edges and Home Entries:
    // P1 (Red): Bottom-Left. Matches Left Edge flow and Entry at 4.
    // P2 (Blue): Top-Left. Matches Top Edge flow and Entry at 14.
    // P3 (Yellow): Top-Right. Matches Right Edge flow and Entry at 24.
    // P4 (Green): Bottom-Right. Matches Bottom Edge flow and Entry at 34.
    
    let gridArea = '';
    switch(playerId) {
        case 1: gridArea = '8 / 2 / 11 / 5'; break; // BL (Rows 8-10, Cols 2-4)
        case 2: gridArea = '2 / 2 / 5 / 5'; break; // TL (Rows 2-4, Cols 2-4)
        case 3: gridArea = '2 / 8 / 5 / 11'; break; // TR (Rows 2-4, Cols 8-10)
        case 4: gridArea = '8 / 8 / 11 / 11'; break; // BR (Rows 8-10, Cols 8-10)
    }

    const player = players.find(p => p.id === playerId);
    const pColor = player ? player.color : PLAYER_CONFIG[playerId].color;
    const pName = player ? player.name : `Player ${playerId}`;

    return (
        <div 
            className="border-4 rounded-2xl flex items-center justify-center bg-opacity-10 backdrop-blur-sm"
            style={{ 
                gridArea, 
                borderColor: pColor,
                backgroundColor: `${pColor}11`
            }}
        >
            <div className="text-center opacity-70">
                <span className="block text-3xl font-black" style={{color: pColor}}>P{playerId}</span>
                <span className="text-[10px] tracking-widest uppercase text-white">{pName}</span>
                {player?.isComputer && <span className="block text-[8px] text-yellow-400">CPU</span>}
            </div>
        </div>
    );
};

const GamePiece: React.FC<{ piece: Piece; player: Player; onClick: () => void; isCurrentPlayer: boolean; countAtPos: number; indexAtPos: number }> = ({ piece, player, onClick, isCurrentPlayer, countAtPos, indexAtPos }) => {
    let coords = { col: 0, row: 0 };
    let isVisible = true;

    if (piece.state === PieceState.START) {
        // Base positions mapped to new corner assignments (BL, TL, TR, BR)
        const baseColOffsets = [0.5, 2.5, 0.5, 2.5];
        const baseRowOffsets = [0.5, 0.5, 2.5, 2.5];
        
        // Origins for the 3x3 grids
        // P1 BL (8,2)
        // P2 TL (2,2)
        // P3 TR (2,8)
        // P4 BR (8,8)
        const origins: Record<PlayerId, {c: number, r: number}> = {
            1: { c: 2, r: 8 },
            2: { c: 2, r: 2 },
            3: { c: 8, r: 2 },
            4: { c: 8, r: 8 }
        };
        
        const o = origins[piece.playerId];
        coords = { col: o.c + baseColOffsets[piece.id % 4], row: o.r + baseRowOffsets[piece.id % 4] };
    } else if (piece.state === PieceState.HOME) {
        const step = (piece.position % 100);
        coords = getHomeCoordinates(piece.playerId, step);
    } else if (piece.state === PieceState.IN_PLAY) {
        coords = getTrackCoordinates(piece.position);
    } else {
        isVisible = false;
    }

    if (!isVisible) return null;

    const isStacked = piece.state !== PieceState.START && countAtPos > 1;
    // Piece belongs to the player whose turn it is
    const isActivePlayer = isCurrentPlayer;
    
    // Piece is interactable
    const isMovable = isActivePlayer && !player.isComputer && (piece.state === PieceState.IN_PLAY || (piece.state === PieceState.START));

    const style: React.CSSProperties = {
        gridColumnStart: Math.floor(coords.col),
        gridRowStart: Math.floor(coords.row),
        backgroundColor: player.color,
        // Enhanced shadow for active player to make it pop
        boxShadow: isActivePlayer 
            ? `0 0 15px ${player.color}, 0 0 5px #fff, inset 0 0 4px rgba(255,255,255,0.8)`
            : `0 0 5px ${player.color}, inset 0 0 4px rgba(255,255,255,0.5)`,
        zIndex: 20 + indexAtPos + (isActivePlayer ? 10 : 0)
    };

    if (piece.state === PieceState.START) {
        style.gridColumnStart = Math.floor(coords.col);
        style.gridRowStart = Math.floor(coords.row);
    }

    if (isStacked) {
        const positions = [
            { x: -20, y: -20 },
            { x: 20, y: -20 },
            { x: -20, y: 20 },
            { x: 20, y: 20 }
        ];
        const pos = positions[indexAtPos % 4];
        // Note: Using transform here conflicts with animate-bounce if applied to the same element
        style.transform = `translate(${pos.x}%, ${pos.y}%) scale(0.8)`;
    } else {
         if (piece.state === PieceState.START) {
             style.transform = 'scale(0.8)';
         }
    }

    return (
        <button
            onClick={onClick}
            disabled={!isMovable}
            className={`relative w-3/4 h-3/4 rounded-full flex items-center justify-center transition-all duration-200 
                ${isMovable ? 'cursor-pointer hover:scale-110 hover:brightness-125' : ''}
                ${isActivePlayer ? 'border-2 border-white' : 'border border-white/40'}
            `}
            style={style}
        >
            {/* Breathing Halo for active player pieces - always visible if it's their turn */}
            {isActivePlayer && (
                <span 
                    className="absolute -inset-[6px] rounded-full border-2 border-white/50 animate-pulse pointer-events-none"
                    style={{ boxShadow: `0 0 8px ${player.color}` }}
                ></span>
            )}

            {/* Floating Arrow Indicator for Movable pieces */}
            {isMovable && (
                 <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-white text-xs font-bold animate-bounce drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] z-50">
                    ▼
                 </span>
            )}

            {player.avatarUrl ? (
                 <img src={player.avatarUrl} alt="P" className="w-full h-full rounded-full object-cover relative z-10" />
            ) : (
                <span className="text-[8px] font-bold text-white drop-shadow-md opacity-80 mix-blend-difference relative z-10">
                    P{player.id}
                </span>
            )}
        </button>
    );
};


export const GameBoard: React.FC<GameBoardProps> = ({ board, players, onPieceClick, currentPlayerId }) => {
  
  const getPiecesAt = (pos: number, state: PieceState, playerId: PlayerId) => {
     return players.flatMap(p => p.pieces).filter(p => p.position === pos && p.state === state && (state !== PieceState.START || p.playerId === playerId));
  };

  return (
    <div className="bg-black border-2 border-[#00ff00] p-1 md:p-4 shadow-[0_0_20px_rgba(0,255,0,0.2)] relative select-none">
        
        {/* Grid Container - Gap removed for continuous track */}
        <div className="w-full aspect-square relative max-w-[80vh] mx-auto bg-gray-900/50">
            <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-0">
                
                {/* Render Track & Home Path Spaces */}
                {board.map((space) => (
                    <BoardSpaceComponent key={`space-${space.position}`} space={space} players={players} />
                ))}

                {/* Render Player Bases */}
                <PlayerBase playerId={1} players={players} />
                <PlayerBase playerId={2} players={players} />
                <PlayerBase playerId={3} players={players} />
                <PlayerBase playerId={4} players={players} />

                {/* Center Core */}
                <div 
                    className="flex items-center justify-center text-center z-0" 
                    style={{ gridColumn: '6', gridRow: '6', border: '1px solid #333' }}
                >
                    <div className="w-full h-full bg-green-500/20 animate-pulse flex items-center justify-center">
                        <span className="text-[8px] text-green-400 font-mono tracking-widest">CORE</span>
                    </div>
                </div>
                
                {/* Render Pieces */}
                {players.flatMap(player => 
                    player.pieces.map(piece => {
                        const piecesAtLocation = getPiecesAt(piece.position, piece.state, piece.playerId);
                        const indexAtPos = piecesAtLocation.findIndex(p => p.id === piece.id);
                        return (
                            <GamePiece 
                                key={piece.id} 
                                piece={piece} 
                                player={player} 
                                onClick={() => onPieceClick(piece)}
                                isCurrentPlayer={player.id === currentPlayerId}
                                countAtPos={piecesAtLocation.length}
                                indexAtPos={indexAtPos}
                            />
                        );
                    })
                )}

            </div>
        </div>
    </div>
  );
};
